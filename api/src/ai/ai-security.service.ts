import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '../auth/roles.enum';

@Injectable()
export class AiSecurityService {
  private readonly logger = new Logger(AiSecurityService.name);

  /**
   * Checks if a message contains adversarial or unauthorized administrative requests.
   * Returns true if a violation is detected.
   */
  isSecurityViolation(message: string, role?: UserRole): boolean {
    const m = message.toLowerCase();
    const flags = [
      'grant',
      'access',
      'super',
      'admin',
      'password',
      'delete_all',
      'delete all',
      'internal_config',
      'ignore_instructions',
      'ignore previous instructions',
      'nipe pin',
      'nipe_pin',
      'mpesa',
      'drop table',
      'drop_table',
      'database',
      'select *',
      'wipe data',
      'wipe_data',
    ];

    if (flags.some((f) => m.includes(f))) {
      // P0: Direct blocks for credentials regardless of context
      // EXCEPTION: Allow passwords during registration for unidentified users
      if (
        (m.includes('password') || m.includes('pin') || m.includes('credential')) &&
        role !== UserRole.UNIDENTIFIED
      ) {
        return true;
      }

      // Intentional block for specific dangerous combinations
      if (
        m.includes('super_admin') ||
        m.includes('super admin') ||
        (m.includes('grant') && m.includes('access'))
      )
        return true;
      if (m.includes('nipe') && m.includes('pin')) return true;
      if (
        m.includes('mpesa') &&
        (m.includes('pin') || m.includes('code'))
      )
        return true;
      if (
        m.includes('delete') &&
        (m.includes('all') || m.includes('record') || m.includes('data'))
      )
        return true;
      if (
        m.includes('ignore') &&
        (m.includes('instruction') || m.includes('previous'))
      )
        return true;
      if (m.includes('drop') && m.includes('table')) return true;
      if (m.includes('select') && m.includes('*')) return true;
    }

    return false;
  }

  getRefusalMessage(): string {
    return 'I apologize, but I am only authorized to assist with property management tasks (v2.2-REFUSAL).';
  }
}
