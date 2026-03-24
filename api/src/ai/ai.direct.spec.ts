import { tryDirectTool } from './ai.direct';

describe('tryDirectTool property interest', () => {
  it('looks up property by house number and calls get_property_details', async () => {
    const prisma = {
      property: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', name: 'House No. 032' },
        ]),
      },
    };
    const executeTool = jest.fn().mockResolvedValue({ ok: true, id: 'p1' });
    const cache = new Map<string, any>();
    const cacheManager = {
      get: jest.fn(async (k: string) => cache.get(k)),
      set: jest.fn(async (k: string, v: any) => cache.set(k, v)),
    } as any;

    const context = {
      userId: 'u1',
      role: 'COMPANY_ADMIN',
      companyId: 'c1',
      phone: '254700000000',
    };

    const res = await tryDirectTool(
      'im intrested in house 32:"House No. 032"',
      context,
      prisma,
      executeTool,
      'en',
      cacheManager,
    );

    expect(prisma.property.findMany).toHaveBeenCalled();
    expect(executeTool).toHaveBeenCalledWith(
      'get_property_details',
      { propertyId: 'p1' },
      context,
    );
    expect(res).toEqual({ ok: true, id: 'p1' });
  });
});

