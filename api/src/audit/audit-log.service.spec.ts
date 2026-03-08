import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.create.mockResolvedValue({});
    service = new AuditLogService(prisma as never);
  });

  it('redacts sensitive fields before persisting', async () => {
    const entry = await service.write({
      action: 'CREATE',
      outcome: 'SUCCESS',
      method: 'POST',
      path: '/users',
      metadata: {
        email: 'user@example.com',
        password: 'secret',
        nested: {
          token: 'abc',
        },
      },
    });

    expect(entry.metadata).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('falls back to memory logs when database read fails', async () => {
    prisma.auditLog.findMany.mockRejectedValue(new Error('db unavailable'));

    await service.write({
      action: 'READ',
      outcome: 'SUCCESS',
      method: 'GET',
      path: '/users',
      entity: 'users',
      actorId: 'actor-1',
    });

    const logs = await service.read({ entity: 'users', actorId: 'actor-1' });
    expect(logs).toHaveLength(1);
    expect(logs[0].entity).toBe('users');
    expect(logs[0].actorId).toBe('actor-1');
  });
});
