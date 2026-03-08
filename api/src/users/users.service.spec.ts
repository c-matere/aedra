import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../auth/roles.enum';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UsersService } from './users.service';

describe('UsersService security policy', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const superAdmin: AuthenticatedUser = {
    id: 'sa',
    role: UserRole.SUPER_ADMIN,
  };

  const companyAdmin: AuthenticatedUser = {
    id: 'ca',
    role: UserRole.COMPANY_ADMIN,
    companyId: 'company-a',
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as never);
  });

  it('scopes company admin list results to their company and excludes password', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.findAll(companyAdmin);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a' }),
      }),
    );

    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.select.password).toBeUndefined();
  });

  it('blocks company admin from creating super admin users', async () => {
    await expect(
      service.create(companyAdmin, {
        email: 'x@example.com',
        password: 'test1234',
        firstName: 'X',
        lastName: 'Y',
        role: UserRole.SUPER_ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('blocks company admin from reading users from another company', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'other@example.com',
      firstName: 'Other',
      lastName: 'User',
      phone: null,
      role: UserRole.COMPANY_ADMIN,
      companyId: 'company-b',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.findOne(companyAdmin, 'u-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks company admin from updating a super admin user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-2',
      role: UserRole.SUPER_ADMIN,
      companyId: null,
    });

    await expect(
      service.update(companyAdmin, 'u-2', { firstName: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('lets super admin query users globally', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.findAll(superAdmin);

    // Super admin has no companyId restriction — where will be an empty object or undefined
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() }),
    );
  });

  it('returns not found for unknown user id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne(superAdmin, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
