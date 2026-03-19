import { Test, TestingModule } from '@nestjs/testing';
import { QueryEnrichmentService } from './query-enrichment.service';

describe('QueryEnrichmentService', () => {
    let service: QueryEnrichmentService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [QueryEnrichmentService],
        }).compile();

        service = module.get<QueryEnrichmentService>(QueryEnrichmentService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should not enrich long messages', async () => {
        const longMessage = 'This is a very long and detailed message that should definitely not be enriched by the service because it already has enough information.';
        const result = await service.enrich(longMessage, [], { role: 'COMPANY_ADMIN' });
        expect(result).toBe(longMessage);
    });

    it('should enrich vague messages like "payment history maggy"', async () => {
        const vagueMessage = 'payment history maggy';
        
        // Mocking the GenAI response
        const mockResponse = {
            response: {
                text: () => 'Please show me the payment history for the tenant named Maggie.'
            }
        };
        const spy = jest.spyOn((service as any).genAI, 'getGenerativeModel').mockReturnValue({
            generateContent: jest.fn().mockResolvedValue(mockResponse)
        } as any);

        const result = await service.enrich(vagueMessage, [], { role: 'COMPANY_ADMIN', companyId: 'comp_123' });
        
        expect(result).toContain('Maggie');
        expect(result).toContain('payment history');
        expect(spy).toHaveBeenCalled();
    });

    it('should handle "who hasn\'t paid"', async () => {
        const vagueMessage = "who hasn't paid";
        
        const mockResponse = {
            response: {
                text: () => 'Generate an arrears report for all tenants who have not paid their rent for the current month.'
            }
        };
        jest.spyOn((service as any).genAI, 'getGenerativeModel').mockReturnValue({
            generateContent: jest.fn().mockResolvedValue(mockResponse)
        } as any);

        const result = await service.enrich(vagueMessage, [], { role: 'COMPANY_ADMIN', companyId: 'comp_123' });
        
        expect(result.toLowerCase()).toContain('arrears');
        expect(result.toLowerCase()).toContain('not paid');
    });
});
