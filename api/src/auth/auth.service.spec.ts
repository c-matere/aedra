import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRole } from './roles.enum';
import { AuthService } from './auth.service';

describe('AuthService password handling', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SESSION_SECRET =
      '12345678901234567890123456789012-test-secret';
    service = new AuthService(prisma as never);
  });

  it('rejects plaintext persisted passwords', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      password: 'plain-text-pass',
      role: UserRole.COMPANY_ADMIN,
      companyId: 'company-a',
      isActive: true,
    });

    await expect(
      service.login('user@example.com', 'plain-text-pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid bcrypt password hashes', async () => {
    const hash = await bcrypt.hash('S3cure!Pass', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      email: 'user2@example.com',
      password: hash,
      role: UserRole.COMPANY_STAFF,
      companyId: 'company-a',
      isActive: true,
    });

    const result = await service.login('user2@example.com', 'S3cure!Pass');

    expect(result.accessToken).toContain('.');
    expect(result.user).toEqual(
      expect.objectContaining({
        id: 'u2',
        role: UserRole.COMPANY_STAFF,
        companyId: 'company-a',
      }),
    );
  });
});
