import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolutionResult {
  id: string | null;
  match: any | null;
  candidates: any[];
  confidence: number; 
  mode: 'EXACT' | 'FUZZY' | 'AMBIGUOUS' | 'NOT_FOUND';
}

@Injectable()
export class AiEntityResolutionService {
  private readonly logger = new Logger(AiEntityResolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a human-readable name or a UUID to a database ID.
   * Tries exact UUID match first, then case-insensitive fuzzy match.
   */
  async resolveId(
    entity: 'tenant' | 'property' | 'unit' | 'company' | 'landlord' | 'lease' | 'invoice',
    identifier: string,
    companyId?: string,
    unitHint?: string,
  ): Promise<ResolutionResult> {
    if (!identifier?.trim()) return { id: null, match: null, candidates: [], confidence: 0, mode: 'NOT_FOUND' };
    const q = identifier.trim();

    // 1. Check if it's already a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    if (isUuid) {
      const exists = await this.checkExistence(entity, q, companyId);
      if (exists) return { id: q, match: { id: q }, candidates: [], confidence: 1.0, mode: 'EXACT' };
    }

    // 2. Name-based resolution
    switch (entity) {
      case 'tenant':
        return this.resolveTenant(q, companyId, unitHint);
      case 'unit':
        return this.resolveUnitRes(q, companyId);
      default:
        const id = await this.resolveGeneric(entity, q, companyId);
        return { id, match: id ? { id } : null, candidates: [], confidence: id ? 0.9 : 0, mode: id ? 'FUZZY' : 'NOT_FOUND' };
    }
  }

  private async resolveTenant(name: string, companyId?: string, unitHint?: string): Promise<ResolutionResult> {
    const q = name.trim();
    const cid = companyId && companyId !== 'NONE' ? companyId : undefined;

    // 1. Try exact full name match
    const exact = await this.prisma.tenantProfile.findFirst({
      where: { name: { equals: q, mode: 'insensitive' }, companyId: cid },
      include: { unit: true }
    });
    if (exact) return { id: exact.id, match: exact, candidates: [], confidence: 1.0, mode: 'EXACT' };

    // 2. Unit-Based Hint (High Confidence Fuzzy)
    if (unitHint) {
      const unitMatch = await this.prisma.unit.findFirst({
        where: { unitNumber: { equals: unitHint, mode: 'insensitive' }, property: { companyId: cid } },
        include: { tenantProfiles: true }
      });
      if (unitMatch && unitMatch.tenantProfiles.length > 0) {
        const best = unitMatch.tenantProfiles.find(t => t.name.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(t.name.toLowerCase()));
        if (best) return { id: best.id, match: best, candidates: [], confidence: 0.95, mode: 'FUZZY' };
        
        // If no name match but it's the only tenant in the unit, it's a very strong candidate
        if (unitMatch.tenantProfiles.length === 1) {
            return { id: unitMatch.tenantProfiles[0].id, match: unitMatch.tenantProfiles[0], candidates: [], confidence: 0.92, mode: 'FUZZY' };
        }
      }
    }

    // 3. Tokenized Fuzzy Match
    const tokens = q.split(/\s+/).filter(t => t.length > 2);
    const fuzzyMatches = await this.prisma.tenantProfile.findMany({
      where: {
        companyId: cid,
        OR: tokens.flatMap(t => [
          { name: { contains: t, mode: 'insensitive' } }
        ])
      },
      include: { unit: true },
      take: 5
    });

    if (fuzzyMatches.length === 1) return { id: fuzzyMatches[0].id, match: fuzzyMatches[0], candidates: [], confidence: 0.88, mode: 'FUZZY' };
    if (fuzzyMatches.length > 1) {
      return { id: null, match: null, candidates: fuzzyMatches, confidence: 0.6, mode: 'AMBIGUOUS' };
    }

    return { id: null, match: null, candidates: [], confidence: 0, mode: 'NOT_FOUND' };
  }

  private async resolveUnitRes(query: string, companyId?: string): Promise<ResolutionResult> {
    const q = query.trim();
    const cid = companyId && companyId !== 'NONE' ? companyId : undefined;

    const exact = await this.prisma.unit.findFirst({
      where: { unitNumber: { equals: q, mode: 'insensitive' }, property: { companyId: cid } },
      include: { property: true }
    });
    if (exact) return { id: exact.id, match: exact, candidates: [], confidence: 1.0, mode: 'EXACT' };

    const candidates = await this.prisma.unit.findMany({
      where: { unitNumber: { contains: q, mode: 'insensitive' }, property: { companyId: cid } },
      include: { property: true },
      take: 5
    });

    if (candidates.length === 1) return { id: candidates[0].id, match: candidates[0], candidates: [], confidence: 0.9, mode: 'FUZZY' };
    if (candidates.length > 1) return { id: null, match: null, candidates, confidence: 0.7, mode: 'AMBIGUOUS' };

    return { id: null, match: null, candidates: [], confidence: 0, mode: 'NOT_FOUND' };
  }

  private async resolveGeneric(entity: string, query: string, companyId?: string): Promise<string | null> {
    const q = query.trim();
    const cid = companyId && companyId !== 'NONE' ? companyId : undefined;
    const where: any = { companyId: cid };
    
    if (entity === 'property') where.name = { contains: q, mode: 'insensitive' };
    else if (entity === 'landlord') where.firstName = { contains: q, mode: 'insensitive' };
    else return null;

    const match = await (this.prisma[entity as any] as any).findFirst({ where, select: { id: true } });
    return match?.id ?? null;
  }

  private async checkExistence(entity: string, id: string, companyId?: string): Promise<boolean> {
    const where: any = { id };
    if (companyId && companyId !== 'NONE') {
      if (['tenant', 'property', 'landlord'].includes(entity)) {
        where.companyId = companyId;
      }
    }
    try {
      const count = await (this.prisma[entity as any] as any).count({ where });
      return count > 0;
    } catch (e) {
      return false;
    }
  }

  private async resolveLandlord(name: string, companyId?: string): Promise<string | null> {
    const q = name.trim();
    const match = await this.prisma.landlord.findFirst({
      where: {
        companyId: companyId && companyId !== 'NONE' ? companyId : undefined,
        deletedAt: null,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return match?.id ?? null;
  }

  private async resolveCompany(name: string): Promise<string | null> {
    const q = name.trim();
    const match = await this.prisma.company.findFirst({
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return match?.id ?? null;
  }
}
