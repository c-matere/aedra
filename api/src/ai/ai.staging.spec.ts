import { AiService } from './ai.service';
import { AiStagingService } from './ai-staging.service';
import { UserRole } from '../auth/roles.enum';

jest.mock('../common/utils/language.util', () => ({
    detectLanguage: jest.fn(() => 'en'),
    DetectedLanguage: {
        EN: 'en',
        SW: 'sw',
        MIXED: 'mixed',
    }
}));

describe('AiService Staging Tools', () => {
    let aiService: AiService;
    let mockPrisma: any;
    let mockStaging: any;
    let mockReportsGenerator: any;

    beforeEach(() => {
        mockPrisma = {
            tenant: { findMany: jest.fn() },
            payment: { findMany: jest.fn() },
            invoice: { findMany: jest.fn() },
        };
        mockStaging = {
            stage: jest.fn(),
            retrieve: jest.fn(),
        };
        mockReportsGenerator = {
            generatePremiumPdf: jest.fn(),
        };

        // We use a mock AiService but pull the actual executeTool logic from the prototype
        aiService = {
            prisma: mockPrisma,
            staging: mockStaging,
            reportsGenerator: mockReportsGenerator,
            logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), logTiming: jest.fn() },
            executeTool: (AiService.prototype as any).executeTool,
            resolveCompanyId: jest.fn().mockResolvedValue('test-company'),
        } as any;
    });

    describe('list_tenants_staged', () => {
        it('should fetch tenants and stage them', async () => {
            const tenants = [{ id: 't1', unitIdentifier: '1A' }];
            mockPrisma.tenant.findMany.mockResolvedValue(tenants);
            mockStaging.stage.mockResolvedValue('tenants');

            const result = await (aiService as any).executeTool('list_tenants_staged', { 
                propertyId: 'p1', 
                jobId: 'job123' 
            }, { userRole: UserRole.COMPANY_ADMIN });

            expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith({
                where: { propertyId: 'p1' },
                include: { property: true }
            });
            expect(mockStaging.stage).toHaveBeenCalledWith('job123', 'tenants', tenants);
            expect(result).toEqual({ status: 'staged', key: 'tenants', count: 1 });
        });
    });

    describe('list_payments_staged', () => {
        it('should fetch payments and stage them', async () => {
            const payments = [{ id: 'p1', amount: 100 }];
            mockPrisma.payment.findMany.mockResolvedValue(payments);
            mockStaging.stage.mockResolvedValue('payments');

            const result = await (aiService as any).executeTool('list_payments_staged', { 
                propertyId: 'prop1', 
                jobId: 'job123' 
            }, { userRole: UserRole.COMPANY_ADMIN });

            expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
                where: { lease: { propertyId: 'prop1' } },
            });
            expect(mockStaging.stage).toHaveBeenCalledWith('job123', 'payments', payments);
            expect(result).toEqual({ status: 'staged', key: 'payments', count: 1 });
        });
    });

    describe('list_invoices_staged', () => {
        it('should fetch invoices and stage them', async () => {
            const invoices = [{ id: 'i1', amount: 150 }];
            mockPrisma.invoice.findMany.mockResolvedValue(invoices);
            mockStaging.stage.mockResolvedValue('invoices');

            const result = await (aiService as any).executeTool('list_invoices_staged', { 
                propertyId: 'prop1', 
                jobId: 'job123' 
            }, { userRole: UserRole.COMPANY_ADMIN });

            expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
                where: { lease: { propertyId: 'prop1' } },
                include: { lease: { include: { tenant: true } } },
            });
            expect(mockStaging.stage).toHaveBeenCalledWith('job123', 'invoices', invoices);
            expect(result).toEqual({ status: 'staged', key: 'invoices', count: 1 });
        });
    });

    describe('process_risk_analysis', () => {
        it('should retrieve staged tenants and return minified risk analysis', async () => {
            const tenants = [
                { id: 't1', unitIdentifier: '1A', missedPayments: 2, lateRate: 0.6, paymentTrend: 'worsening' }
            ];
            mockStaging.retrieve.mockResolvedValue(tenants);

            const result = await (aiService as any).executeTool('process_risk_analysis', { 
                jobId: 'job123', 
                inputKey: 'tenants' 
            }, { userRole: UserRole.COMPANY_ADMIN });

            expect(mockStaging.retrieve).toHaveBeenCalledWith('job123', 'tenants');
            expect(result.status).toBe('success');
            expect(result.insights.flagged_tenants).toHaveLength(1);
            expect(result.insights.flagged_tenants[0].unit).toBe('1A');
        });

        it('should return error if staged data is missing', async () => {
            mockStaging.retrieve.mockResolvedValue(null);

            const result = await (aiService as any).executeTool('process_risk_analysis', { 
                jobId: 'job123', 
                inputKey: 'missing' 
            }, { userRole: UserRole.COMPANY_ADMIN });

            expect(result.error).toBeDefined();
        });
    });

    describe('assemble_report_staged', () => {
        it('should assemble report from multiple staged data sources', async () => {
            const tenants = [{ unitIdentifier: '1A', missedPayments: 1, lateRate: 0.1 }];
            const payments = [{ amount: 1000 }];
            const invoices = [{ amount: 1100 }];

            mockStaging.retrieve
                .mockImplementation((jobId: string, key: string) => {
                    if (key === 'tenants') return Promise.resolve(tenants);
                    if (key === 'payments') return Promise.resolve(payments);
                    if (key === 'invoices') return Promise.resolve(invoices);
                    return Promise.resolve(null);
                });

            mockReportsGenerator.generatePremiumPdf.mockResolvedValue('http://report.url');

            const result = await (aiService as any).executeTool('assemble_report_staged', { 
                jobId: 'job123' 
            }, { userRole: UserRole.COMPANY_ADMIN });

            expect(mockStaging.retrieve).toHaveBeenCalledWith('job123', 'tenants');
            expect(mockStaging.retrieve).toHaveBeenCalledWith('job123', 'payments');
            expect(mockStaging.retrieve).toHaveBeenCalledWith('job123', 'invoices');
            expect(mockReportsGenerator.generatePremiumPdf).toHaveBeenCalled();
            expect(result).toEqual({ status: 'success', url: 'http://report.url' });
        });
    });
});
