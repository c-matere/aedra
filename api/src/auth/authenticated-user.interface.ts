import { UserRole } from './roles.enum';

export interface AuthenticatedUser {
  id: string;
  companyId?: string;
  role: UserRole;
}
