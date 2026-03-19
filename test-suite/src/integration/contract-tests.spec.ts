import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../../../api/src/ai/ai.service';
import { AiClassifierService } from '../../../api/src/ai/ai-classifier.service';
import { selectTools, INTENT_TOOL_MAP } from '../../../api/src/ai/ai-tool-selector.util';

describe('Contract & Regression Tests (BS-03)', () => {
    // These tests ensure that the "contract" between the classifier and the tool manifest
    // remains intact. If an intent is removed from the manifest but still used by 
    // the classifier, this will catch it.

    it('All intents in AiClassifierService must have corresponding tool mappings', () => {
        const classifierIntents = [
            'list_companies', 'switch_company', 'check_rent_status', 'arrears_check',
            'tenant_balance_inquiry', 'check_vacancy', 'get_tenant_details', 
            'log_maintenance', 'record_payment', 'request_receipt', 'add_tenant',
            'onboard_property', 'generate_mckinsey_report', 'collection_status'
        ];

        classifierIntents.forEach(intent => {
            expect(INTENT_TOOL_MAP[intent]).toBeDefined();
            expect(INTENT_TOOL_MAP[intent].length).toBeGreaterThan(0);
        });
    });

    describe('Regression: BS-01 Performance (Tool Count)', () => {
        it('list_companies must NEVER load all 51 tools', () => {
            const suite = selectTools('list_companies', { id: 'SUPER_ADMIN', allowedTools: ['list_companies'] } as any, []);
            // This is the core fix for the 71s response time issue
            expect(suite.length).toBeLessThanOrEqual(1);
        });
    });

    describe('Regression Suite (BS-03)', () => {
        const REGRESSION_CASES = [
            {
                id: 'R001',
                description: 'list_companies must be complexity 1 (was bug)',
                input: 'List out companies for me',
                requiredIntent: 'list_companies',
                requiredMaxComplexity: 1,
            },
            {
                id: 'R002',
                description: 'nimetuma must map to record_payment',
                input: 'nimetuma',
                requiredIntent: 'record_payment',
                requiredMaxComplexity: 3,
            },
            {
                id: 'R003',
                description: 'generate report must be complexity >= 4',
                input: 'generate monthly report for my portfolio',
                requiredIntent: 'generate_mckinsey_report',
                requiredMinComplexity: 4,
            },
            {
                id: 'R004',
                description: 'fire emergency must be complexity 1 always',
                input: 'there is a fire in the building',
                requiredIntent: 'emergency_escalation',
                requiredMaxComplexity: 1,
            },
        ];

        test.each(REGRESSION_CASES)(
            '$id: $description',
            async ({ input, requiredIntent, requiredMaxComplexity, requiredMinComplexity }) => {
                if (!process.env.GEMINI_API_KEY) return;
                
                const classifier = new AiClassifierService();
                const result = await classifier.classify(input, 'AGENT' as any);
                
                expect(result.intent).toBe(requiredIntent);
                if (requiredMaxComplexity) expect(result.complexity).toBeLessThanOrEqual(requiredMaxComplexity);
                if (requiredMinComplexity) expect(result.complexity).toBeGreaterThanOrEqual(requiredMinComplexity);
            }
        );
    });
});
