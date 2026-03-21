import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SKILLS_REGISTRY } from './skills.registry';
import { withRetry } from '../common/utils/retry';

export interface CriticVerdict {
  pass: boolean;
  feedback: string[];
}

@Injectable()
export class CriticService {
  private readonly logger = new Logger(CriticService.name);
  private genAI: GoogleGenerativeAI;
  private criticModelName =
    (process.env.GEMINI_MODEL || '').trim() || 'gemini-2.5-flash'; // Default to Gemini 2.5 Flash for critiquing

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || 'dummy-key';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Evaluates the draft output against a skill's rubric.
   */
  async evaluate(
    skillId: string,
    draftJson: string,
    context: string,
  ): Promise<CriticVerdict> {
    const skill = SKILLS_REGISTRY.find((s) => s.skill_id === skillId);
    if (!skill) {
      return { pass: true, feedback: [] }; // Fallback
    }

    const model = this.genAI.getGenerativeModel({
      model: this.criticModelName,
    });

    const rubricList = skill.rubric
      .map((r: string, i: number) => `${i + 1}. ${r}`)
      .join('\n');

    const prompt = `
[ROLE]
You are a meticulous Supervisor Critic for an AI Agent system. Your job is to evaluate a DRAFT structured output against a specific RUBRIC and CONTEXT.

[CONTEXT]
${context}

[SKILL]
${skill.name}: ${skill.objective}

[RUBRIC]
${rubricList}

[DRAFT OUTPUT]
${draftJson}

[TASK]
Evaluate the DRAFT OUTPUT against the RUBRIC above. 
You must produce a JSON verdict.
- If it passes all criteria, set "pass": true.
- If it fails ANY criteria, set "pass": false and provide a detailed "feedback" array with specific, actionable instructions for the generator to fix the output.

[OUTPUT FORMAT]
JSON ONLY:
{
  "pass": boolean,
  "feedback": string[]
}
`;

    try {
      const result = await withRetry(() => model.generateContent(prompt));
      const response = await result.response;
      const text = response.text().trim();
      const cleaned = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const verdict = JSON.parse(cleaned) as CriticVerdict;
      this.logger.log(
        `Critic verdict for ${skillId}: ${verdict.pass ? 'PASS' : 'FAIL'}`,
      );
      if (!verdict.pass) {
        this.logger.warn(`Critic feedback: ${verdict.feedback.join(' | ')}`);
      }
      return verdict;
    } catch (error) {
      this.logger.error(`Critic evaluation failed: ${error.message}`);
      // If the critic fails, we might want to fail-open or fail-closed based on risk.
      // For now, we fail-open but log the error.
      return { pass: true, feedback: [] };
    }
  }
}
