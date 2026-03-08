export const AUTH_ROLE_COOKIE = 'aedra_role';
export const AUTH_SESSION_COOKIE = 'aedra_session';

export const USER_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_STAFF'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string | undefined): value is UserRole {
  return !!value && USER_ROLES.includes(value as UserRole);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'COMPANY_ADMIN':
      return 'Company Admin';
    case 'COMPANY_STAFF':
      return 'Company Staff';
  }
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (!pathname.startsWith('/admin')) {
    return true;
  }

  if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') {
    return true;
  }

  if (role === 'COMPANY_STAFF') {
    if (
      pathname === '/admin' ||
      pathname.startsWith('/admin/properties') ||
      pathname.startsWith('/admin/tenants') ||
      pathname.startsWith('/admin/payments') ||
      pathname.startsWith('/admin/maintenance') ||
      pathname.startsWith('/admin/leases') ||
      pathname.startsWith('/admin/units') ||
      pathname.startsWith('/admin/landlords') ||
      pathname.startsWith('/admin/notifications') ||
      pathname.startsWith('/admin/documents') ||
      pathname.startsWith('/admin/support')
    ) {
      return true;
    }
  }

  return false;
}
