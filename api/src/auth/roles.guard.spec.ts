import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createSessionToken } from './session-token';
import { RolesGuard } from './roles.guard';
import { UserRole } from './roles.enum';

function mockContext(authHeader?: string): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
    switchToHttp: () =>
      ({
        getRequest: () => ({
          header: (name: string) =>
            name.toLowerCase() === 'authorization' ? authHeader : undefined,
        }),
      }) as never,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET =
      '12345678901234567890123456789012-test-secret';

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    guard = new RolesGuard(reflector);
  });

  it('allows when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('rejects when role is required and token is missing', () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([UserRole.COMPANY_ADMIN]) // required roles
      .mockReturnValueOnce(false); // isPublic flag

    expect(() => guard.canActivate(mockContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('allows required role with valid token', () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([UserRole.COMPANY_ADMIN])
      .mockReturnValueOnce(false);

    const token = createSessionToken({
      userId: 'u1',
      role: UserRole.COMPANY_ADMIN,
      companyId: 'company-a',
    });

    expect(guard.canActivate(mockContext(`Bearer ${token}`))).toBe(true);
  });

  it('forbids role mismatch', () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([UserRole.COMPANY_ADMIN])
      .mockReturnValueOnce(false);

    const token = createSessionToken({
      userId: 'u2',
      role: UserRole.COMPANY_STAFF,
      companyId: 'company-a',
    });

    expect(() => guard.canActivate(mockContext(`Bearer ${token}`))).toThrow(
      ForbiddenException,
    );
  });

  it('allows super admin regardless of required role', () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([UserRole.COMPANY_STAFF])
      .mockReturnValueOnce(false);

    const token = createSessionToken({
      userId: 'u3',
      role: UserRole.SUPER_ADMIN,
    });

    expect(guard.canActivate(mockContext(`Bearer ${token}`))).toBe(true);
  });
});
