import { MenuRouterService } from './menu-router.service';

describe('MenuRouterService', () => {
  it('routes button action "get_tenant_arrears:<uuid>" to get_tenant_arrears tool with tenantId', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const uuid = '007805c2-ee65-4d9d-b2f4-5956a6811175';
    const res = await service.routeMessage(
      'uid_1',
      `get_tenant_arrears:${uuid}`,
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({
      name: 'get_tenant_arrears',
      args: { tenantId: uuid },
    });
  });

  it('routes "list tenants" directly to list_tenants tool', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage('uid_1', 'list tenants', 'en');
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({ name: 'list_tenants', args: { limit: 20 } });
  });

  it('routes "List of properties." to list_properties tool', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage(
      'uid_1',
      'List of properties.',
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({ name: 'list_properties' });
  });

  it('routes "List our properties" to list_properties tool', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage(
      'uid_1',
      'List our properties',
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({ name: 'list_properties' });
  });

  it('routes "show me the list of our properties" to list_properties tool', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage(
      'uid_1',
      'show me the list of our properties',
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({ name: 'list_properties' });
  });

  it('routes list_reply property id to get_property_details when awaitingSelection=property', async () => {
    const cacheManagerMock: any = {
      get: jest.fn().mockResolvedValue({
        awaitingSelection: 'property',
        lastResults: [
          { id: 'bench-prop-palmgrove', name: 'Palm Grove', type: 'property' },
        ],
      }),
      set: jest.fn(),
    };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage(
      'uid_1',
      'bench-prop-palmgrove',
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({
      name: 'get_property_details',
      args: { propertyId: 'bench-prop-palmgrove' },
    });
  });

  it('routes "report" directly to generate_report_file tool', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage('uid_1', 'report', 'en');
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({
      name: 'generate_report_file',
      args: { reportType: 'Summary', format: 'pdf', scope: 'company' },
    });
  });

  it('routes "report platform" to platform scope', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage('uid_1', 'report platform', 'en');
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({
      name: 'generate_report_file',
      args: { reportType: 'Summary', format: 'pdf', scope: 'platform' },
    });
  });

  it('routes "report property Palm Grove" to property scope with propertyName', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage(
      'uid_1',
      'report property Palm Grove',
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({
      name: 'generate_report_file',
      args: {
        reportType: 'Summary',
        format: 'pdf',
        scope: 'property',
        propertyName: 'palm grove',
      },
    });
  });

  it('routes "generate full portfolio report" to generate_report_file tool', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage(
      'uid_1',
      'generate full portfolio report',
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({
      name: 'generate_report_file',
      args: { reportType: 'Summary', format: 'pdf', scope: 'company' },
    });
  });

  it('routes "how are our properties doing" to a company-scope report', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage(
      'uid_1',
      'how are our properties doing',
      'en',
    );
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({
      name: 'generate_report_file',
      args: { reportType: 'Summary', format: 'pdf', scope: 'company' },
    });
  });

  it('routes "report status" to get_report_status tool', async () => {
    const cacheManagerMock: any = { get: jest.fn(), set: jest.fn() };
    const formatterMock: any = {};
    const mainMenuMock: any = {};

    const service = new MenuRouterService(
      cacheManagerMock,
      formatterMock,
      mainMenuMock,
    );

    const res = await service.routeMessage('uid_1', 'report status', 'en');
    expect(res.handled).toBe(true);
    expect(res.tool).toEqual({ name: 'get_report_status', args: {} });
  });
});
