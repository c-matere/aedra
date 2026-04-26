import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiEntityResolutionService {
  private readonly logger = new Logger(AiEntityResolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveId(type: string, query: string, companyId?: string, unitNumber?: string): Promise<{ id?: string; error?: string; matches?: any[]; match?: any; candidates?: any[]; message?: string; mode?: string }> {
    if (!query || query === 'unspecified') return {};

    // If it's already a UUID, return it
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(query)) return { id: query };

    this.logger.log(`[Resolution] Resolving ${type} for query: ${query}`);

    switch (type) {
      case 'property': {
        const results = await this.prisma.property.findMany({
          where: {
            companyId,
            name: { contains: query, mode: 'insensitive' },
            deletedAt: null,
          }
        });
        if (results.length === 1) return { id: results[0].id, match: results[0] };
        if (results.length > 1) return { error: 'AMBIGUOUS_MATCH', matches: results, candidates: results, mode: 'AMBIGUOUS' };
        return { error: 'NOT_FOUND', message: `Could not find property ${query}` };
      }
      case 'unit': {
        const results = await this.prisma.unit.findMany({
          where: {
            property: { companyId },
            unitNumber: { equals: query, mode: 'insensitive' },
            deletedAt: null,
          }
        });
        if (results.length === 1) return { id: results[0].id, match: results[0] };
        return { error: 'NOT_FOUND', message: `Could not find unit ${query}` };
      }
      case 'tenant': {
        const results = await this.prisma.tenant.findMany({
          where: {
            companyId,
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
            deletedAt: null,
          }
        });
        if (results.length === 1) return { id: results[0].id, match: results[0] };
        if (results.length > 1) return { error: 'AMBIGUOUS_MATCH', matches: results, candidates: results, mode: 'AMBIGUOUS' };
        return { error: 'NOT_FOUND', message: `Could not find tenant ${query}` };
      }
      default:
        return { error: 'UNSUPPORTED_TYPE' };
    }
  }
}
