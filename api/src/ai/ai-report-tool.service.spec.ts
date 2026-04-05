import { AiReportToolService } from './ai-report-tool.service';
import { UserRole } from '../auth/roles.enum';

describe('AiReportToolService - Scoping', () => {
  const makeService = (overrides?: Partial<any>) => {
    const prisma: any = {
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const reportsGenerator: any = {};
    const reportIntelligence: any = { generatePremiumInsights: jest.fn() };
    const whatsappService: any = {};
    const staging: any = {};
    const authService: any = {};
    const resolutionService: any = {
      resolveId: jest.fn(),
    };
    const backgroundQueue: any = { add: jest.fn() };

    const service = new AiReportToolService(
      prisma,
      reportsGenerator,
      reportIntelligence,
      whatsappService,
      staging,
      authService,
      resolutionService,
      backgroundQueue,
    );

    return { service, prisma, resolutionService, backgroundQueue, ...(overrides || {}) };
  };

  it('defaults to company scope and requires companyId', async () => {
    const { service } = makeService();
    const res = await service.executeReportTool(
      'get_financial_report',
      { include: 'all', groupBy: 'none' },
      { role: UserRole.SUPER_ADMIN }, // no companyId
      UserRole.SUPER_ADMIN,
      'en',
    );
    expect(res).toEqual(
      expect.objectContaining({
        error: 'MISSING_COMPANY',
      }),
    );
  });

  it('platform scope omits companyId filter for payments', async () => {
    const { service, prisma } = makeService();
    await service.executeReportTool(
      'get_financial_report',
      { include: 'payments', groupBy: 'none', scope: 'platform' },
      { role: UserRole.SUPER_ADMIN },
      UserRole.SUPER_ADMIN,
      'en',
    );

    const where = prisma.payment.findMany.mock.calls[0][0].where;
    expect(where.lease.property.companyId).toBeUndefined();
    expect(where.lease.property.deletedAt).toBeNull();
  });

  it('property scope resolves propertyName to propertyId', async () => {
    const { service, resolutionService, backgroundQueue } = makeService();
    resolutionService.resolveId.mockResolvedValue({ id: 'prop-123' });

    const res = await service.executeReportTool(
      'generate_report_file',
      { scope: 'property', propertyName: 'Palm Grove', format: 'pdf' },
      { role: UserRole.COMPANY_STAFF, companyId: 'c1', phone: '254700000000' },
      UserRole.COMPANY_STAFF,
      'en',
    );

    expect(res).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Report generation started'),
      }),
    );
    expect(backgroundQueue.add).toHaveBeenCalledWith(
      'generate_report_pdf',
      expect.objectContaining({
        companyId: 'c1',
        filters: expect.objectContaining({ propertyId: 'prop-123' }),
      }),
    );
  });
});

