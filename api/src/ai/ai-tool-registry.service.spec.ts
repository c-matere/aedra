import { AiToolRegistryService } from './ai-tool-registry.service';
import { UserRole } from '../auth/roles.enum';

describe('AiToolRegistryService - Routing', () => {
  it('routes generate_report_file to reportTools (not readTools)', async () => {
    const readTools: any = { executeReadTool: jest.fn() };
    const writeTools: any = { executeWriteTool: jest.fn() };
    const reportTools: any = {
      executeReportTool: jest.fn().mockResolvedValue({ ok: true }),
    };
    const historyTools: any = { executeHistoryTool: jest.fn() };
    const autonomousAgentService: any = {};

    const service = new AiToolRegistryService(
      readTools,
      writeTools,
      reportTools,
      historyTools,
      autonomousAgentService,
    );

    await service.executeTool(
      'generate_report_file',
      { reportType: 'Summary', format: 'pdf' },
      { companyId: 'c1', phone: '254700000000', role: UserRole.COMPANY_STAFF },
      UserRole.COMPANY_STAFF,
      'en',
    );

    expect(reportTools.executeReportTool).toHaveBeenCalledWith(
      'generate_report_file',
      expect.any(Object),
      expect.any(Object),
      UserRole.COMPANY_STAFF,
      'en',
    );
    expect(readTools.executeReadTool).not.toHaveBeenCalled();
  });

  it('routes get_financial_report to reportTools (not readTools)', async () => {
    const readTools: any = { executeReadTool: jest.fn() };
    const writeTools: any = { executeWriteTool: jest.fn() };
    const reportTools: any = {
      executeReportTool: jest.fn().mockResolvedValue({ ok: true }),
    };
    const historyTools: any = { executeHistoryTool: jest.fn() };
    const autonomousAgentService: any = {};

    const service = new AiToolRegistryService(
      readTools,
      writeTools,
      reportTools,
      historyTools,
      autonomousAgentService,
    );

    await service.executeTool(
      'get_financial_report',
      { include: 'all', groupBy: 'none' },
      { companyId: 'c1', role: UserRole.SUPER_ADMIN },
      UserRole.SUPER_ADMIN,
      'en',
    );

    expect(reportTools.executeReportTool).toHaveBeenCalledWith(
      'get_financial_report',
      expect.any(Object),
      expect.any(Object),
      UserRole.SUPER_ADMIN,
      'en',
    );
    expect(readTools.executeReadTool).not.toHaveBeenCalled();
  });
});
