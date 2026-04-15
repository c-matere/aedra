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
    const backgroundQueue: any = { add: jest.fn(), getJob: jest.fn() };

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

    return {
      service,
      prisma,
      resolutionService,
      backgroundQueue,
      ...(overrides || {}),
    };
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
    backgroundQueue.add.mockResolvedValue({ id: 'job-001' });

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
        jobId: 'job-001',
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

  it('downgrades accidental propertyName phrases to company scope', async () => {
    const { service, resolutionService } = makeService();

    const res = await service.executeReportTool(
      'get_financial_report',
      { scope: 'property', propertyName: 'status with the report.' },
      { role: UserRole.COMPANY_STAFF, companyId: 'c1' },
      UserRole.COMPANY_STAFF,
      'en',
    );

    expect(resolutionService.resolveId).not.toHaveBeenCalled();
    expect(res).not.toEqual(
      expect.objectContaining({
        error: 'PROPERTY_NOT_FOUND',
      }),
    );
  });

  it('returns report job status for a known jobId', async () => {
    const { service, backgroundQueue } = makeService();
    const mockJob: any = {
      getState: jest.fn().mockResolvedValue('completed'),
      timestamp: Date.now() - 1000,
      processedOn: Date.now() - 900,
      finishedOn: Date.now() - 100,
      returnvalue: { url: 'https://example.com/report.pdf' },
    };
    backgroundQueue.getJob.mockResolvedValue(mockJob);

    const res = await service.executeReportTool(
      'get_report_status',
      { jobId: 'job-xyz' },
      { role: UserRole.COMPANY_STAFF, companyId: 'c1' },
      UserRole.COMPANY_STAFF,
      'en',
    );

    expect(res).toEqual(
      expect.objectContaining({
        jobId: 'job-xyz',
        state: 'completed',
      }),
    );
    expect(String(res.message)).toContain('Report status');
    expect(String(res.message)).toContain('job-xyz');
  });
});
