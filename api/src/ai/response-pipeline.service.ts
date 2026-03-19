import { Injectable, Logger } from '@nestjs/common';
import { renderTemplate } from './templates';
import { SKILLS_REGISTRY } from './skills.registry';

export interface PipelineResult {
    success: boolean;
    output?: string;
    structuredData?: any;
    errors?: string[];
}

@Injectable()
export class ResponsePipelineService {
    private readonly logger = new Logger(ResponsePipelineService.name);

    /**
     * Orchestrates the response transformation pipeline.
     */
    async processResponse(skillId: string, rawJson: string): Promise<PipelineResult> {
        try {
            // Stage 1: Extraction & Parsing
            const parsedData = JSON.parse(rawJson);
            const skill = SKILLS_REGISTRY.find(s => s.skill_id === skillId);
            
            if (!skill) {
                return { success: false, errors: ['Something went wrong. Please try again.'] };
            }

            // Stage 2: Deterministic Validation (Schema & Safety)
            const validationErrors = this.validate(skill, parsedData);
            if (validationErrors.length > 0) {
                return { success: false, structuredData: parsedData, errors: validationErrors };
            }

            // Stage 3: Template Rendering
            const language = parsedData.language || 'EN';
            const renderedText = renderTemplate(skillId, language, parsedData, parsedData.tone);

            if (!renderedText) {
                return { success: false, structuredData: parsedData, errors: ['Failed to render template.'] };
            }

            // Stage 4: Delivery Formatting (WhatsApp Markdown)
            const formattedText = this.applyWhatsAppFormatting(renderedText);

            return {
                success: true,
                output: formattedText,
                structuredData: parsedData,
            };
        } catch (error) {
            this.logger.error(`Pipeline processing failed: ${error.message}`, (error as any)?.stack);
            return { success: false, errors: ['Something went wrong. Please try again.'] };
        }
    }

    private validate(skill: any, data: any): string[] {
        const errors: string[] = [];
        
        // Simple schema presence check for now (can expand to AJV if needed)
        const required = skill.outputSchema.required || [];
        for (const field of required) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Safety: Check for PII or prohibited patterns (Placeholder for now)
        // In a real Anthropic-like system, this would be a robust regex/substring check
        const prohibited = ['password', 'secret', 'token'];
        const dataString = JSON.stringify(data).toLowerCase();
        for (const word of prohibited) {
            if (dataString.includes(word)) {
                errors.push(`Safety violation: Output contains prohibited term "${word}".`);
            }
        }

        return errors;
    }

    private applyWhatsAppFormatting(text: string): string {
        // WhatsApp specific rendering rules:
        // Bold: *text* (Already often used by models, but we ensure it here)
        // Italic: _text_
        // Monospace: ```text```
        
        // For now, we assume the templates might use markdown-like syntax
        // but we can enforce or transform technical patterns here.
        // Example: Ensure KES followed by numbers is bolded for readability
        return text.replace(/(KES\s?\d+(?:,\d+)*(?:\.\d+)?)/g, '*$1*');
    }
}
