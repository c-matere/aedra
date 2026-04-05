import { GoogleGenerativeAI } from '@google/generative-ai';
import { AedraSkill } from './skills.registry';
import { MASTER_PERSONAS } from './persona.registry';
import { withRetry } from '../common/utils/retry';

export class PromptCompiler {
  private genAI: GoogleGenerativeAI;
  // Policy: Gemini 2.0 Flash only (Gemini 1.5 is discontinued).
  private compilerModel = 'gemini-2.0-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || 'dummy-key';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Compiles a skill definition into an optimized prompt for a target model.
   */
  async compile(skill: AedraSkill, targetModel: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.compilerModel });

    const prompt = `
[ROLE]
You are a Meta-Prompt Engineer. Your task is to write an OPTIMIZED SYSTEM PROMPT for a specific AI model (${targetModel}) to execute a specific skill reliably.

[SKILL DEFINITION]
ID: ${skill.skill_id}
Name: ${skill.name}
Description: ${skill.description}
Persona: ${MASTER_PERSONAS[skill.persona_id].constitution}
Objective: ${skill.objective}
Output Schema: ${JSON.stringify(skill.outputSchema, null, 2)}

[TARGET MODEL CONTEXT]
The target model (${targetModel}) is capable but benefits from:
1. Clear, numbered instructions.
2. Explicit formatting rules.
3. Negative constraints (what NOT to do).
4. Few-shot examples (if necessary).

[TASK]
Generate a system prompt that ensures the model ${targetModel} produces high-quality, structured JSON output matching the schema. 
The prompt MUST include:
- A clear persona.
- Step-by-step reasoning instructions.
- Strict JSON output enforcement instructions.
- A marker like "JSON_STRUCTURED_OUTPUT:" before the payload.

Output ONLY the compiled system prompt.
`;

    try {
      const result = await withRetry(() => model.generateContent(prompt));
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error(
        `Prompt compilation failed for ${skill.skill_id}: ${error.message}`,
      );
      return `Persona: ${MASTER_PERSONAS[skill.persona_id].constitution}\nObjective: ${skill.objective}\nOutput JSON matching: ${JSON.stringify(skill.outputSchema)}`;
    }
  }
}
