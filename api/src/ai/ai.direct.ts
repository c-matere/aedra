import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import { ActionResult } from './next-step-orchestrator.service';
import { Cache } from 'cache-manager';

/**
 * Fast-path execution for common property management queries.
 * This function intercepts obvious intents (like balance or profile)
 * and executes the corresponding tools directly, saving LLM tokens and time.
 *
 * @returns A string response, an ActionResult, or null if no direct match was found.
 */
export async function tryDirectTool(
  text: string,
  context: any,
  prisma: PrismaService,
  executeTool: (
    name: string,
    args: any,
    context: any,
    role?: string,
    language?: string,
  ) => Promise<any>,
  language: string = 'en',
  cache: Cache,
): Promise<any | null> {
  const raw = (text || '').trim().toLowerCase();
  if (!raw) return null;

  const role = context.role;
  const userId = context.userId;
  const companyId = context.companyId;

  // 1. Balance / Arrears Queries
  const balanceRegex =
    /^(balance|deni|balansi|nadhai unanilinda kiasi gani|deni langu|kiasi gani|how much|amount due)$/i;
  if (balanceRegex.test(raw) && role === UserRole.TENANT) {
    if (!userId || userId === 'unidentified') return null;

    return await executeTool(
      'get_tenant_arrears',
      { tenantId: userId },
      context,
      role,
      language,
    );
  }

  // 2. Profile / Identity Queries
  const profileRegex =
    /^(my profile|info yangu|wasifu|details zangu|who am i|mimi ni nani)$/i;
  if (profileRegex.test(raw)) {
    if (!userId || userId === 'unidentified') return null;

    return await executeTool(
      'get_tenant_details',
      { id: userId },
      context,
      role,
      language,
    );
  }

  // 3. Admin: List Companies (Super Admin only)
  const listCompaniesRegex =
    /^(list companies|orodha ya makampuni|makampuni yote)$/i;
  if (listCompaniesRegex.test(raw) && role === UserRole.SUPER_ADMIN) {
    return await executeTool(
      'list_properties', // Often used as a proxy for company listing in simple contexts or property list
      {},
      context,
      role,
      language,
    );
  }

  // 4. Greetings (Fast echo)
  const greetingRegex = /^(hi|hello|mambo|vipi|greeting|habari|sasa)$/i;
  if (greetingRegex.test(raw)) {
    const greeting =
      language === 'sw'
        ? `Habari ${context.userName || ''}! Niko hapa kukusaidia. Unaweza kuuliza kuhusu deni lako, wasifu wako, au kuripoti tatizo.`
        : `Hi ${context.userName || ''}! I'm here to help. You can ask about your balance, your profile, or report an issue.`;
    return greeting;
  }

  // No direct match found
  return null;
}
