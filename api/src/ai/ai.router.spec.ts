import { selectModelKey } from './ai.router';

describe('selectModelKey', () => {
    const mockGenAI = {
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: jest.fn().mockRejectedValue(new Error('Mock failure - trigger fallback'))
        })
    } as any;

    it('routes by explicit prefix (sync check)', async () => {
        expect((await selectModelKey(mockGenAI, '/write create tenant')).intent).toBe('write');
        expect((await selectModelKey(mockGenAI, '/report revenue summary')).intent).toBe('report');
        expect((await selectModelKey(mockGenAI, '/read list properties')).intent).toBe('read');
    });

    it('routes by intent hints (fallback)', async () => {
        expect((await selectModelKey(mockGenAI, 'create a tenant')).intent).toBe('write');
        expect((await selectModelKey(mockGenAI, 'monthly revenue report')).intent).toBe('report');
        expect((await selectModelKey(mockGenAI, 'what properties do we have')).intent).toBe('read');
    });

    it('routes by LLM classification when confidence is high', async () => {
        const mockSuccessGenAI = {
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: jest.fn().mockResolvedValue({
                    response: {
                        text: () => JSON.stringify({ intent: 'report', confidence: 0.9, reason: 'Test' })
                    }
                })
            })
        } as any;

        expect((await selectModelKey(mockSuccessGenAI, 'give me a breakdown')).intent).toBe('report');
    });
});
