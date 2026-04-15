import { AiEntityResolutionService } from './ai-entity-resolution.service';

describe('AiEntityResolutionService', () => {
  it('resolves property exact match', async () => {
    const prisma: any = {
      property: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'p1', name: 'Palm Grove' }),
        findMany: jest.fn(),
      },
    };
    const svc = new AiEntityResolutionService(prisma);

    const res = await svc.resolveId('property', 'Palm Grove', 'c1');
    expect(res).toEqual(
      expect.objectContaining({
        id: 'p1',
        mode: 'EXACT',
        confidence: 1,
      }),
    );
    expect(prisma.property.findFirst).toHaveBeenCalled();
  });

  it('returns AMBIGUOUS for property contains matches', async () => {
    const prisma: any = {
      property: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', name: 'Palm Grove' },
          { id: 'p2', name: 'Palm Grove Phase 2' },
        ]),
      },
    };
    const svc = new AiEntityResolutionService(prisma);

    const res = await svc.resolveId('property', 'Palm Grove', 'c1');
    expect(res.mode).toBe('AMBIGUOUS');
    expect(res.id).toBeNull();
    expect(res.candidates.length).toBeGreaterThan(0);
  });
});
