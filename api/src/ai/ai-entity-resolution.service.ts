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

  private isPlaceholderValue(value: any): boolean {
    if (value === undefined || value === null) return true;
    const raw = String(value).trim().toLowerCase();
    if (!raw) return true;
    return [
      'unspecified',
      'unknown',
      'n/a',
      'na',
      'none',
      'null',
      'not provided',
      'not_specified',
      'not-specified',
      'pending',
      'undefined',
    ].includes(raw);
  }

  /**
   * Resolve a human-readable name or a UUID to a database ID.
   * Tries exact UUID match first, then case-insensitive fuzzy match.
   */
  async resolveId(
    entity:
      | 'tenant'
      | 'property'
      | 'unit'
      | 'company'
      | 'landlord'
      | 'lease'
      | 'invoice',
    identifier: string,
    companyId?: string,
    unitHint?: string,
    strict: boolean = false,
  ): Promise<ResolutionResult> {
    if (!identifier?.trim() || this.isPlaceholderValue(identifier)) {
      return {
        id: null,
        match: null,
        candidates: [],
        confidence: 0,
        mode: 'NOT_FOUND',
      };
    }
    const q = identifier.trim();
    this.logger.log(
      `[EntityResolution] Resolving ${entity}: "${q}" (strict=${strict})`,
    );

    // 1. Check if it's already a valid UUID
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    if (isUuid) {
      const exists = await this.checkExistence(entity, q, companyId);
      if (exists)
        return {
          id: q,
          match: { id: q },
          candidates: [],
          confidence: 1.0,
          mode: 'EXACT',
        };
    }

    // 2. Name-based resolution
    switch (entity) {
      case 'tenant':
        return this.resolveTenant(q, companyId, unitHint, strict);
      case 'unit':
        return this.resolveUnitRes(q, companyId, strict);
      case 'landlord':
        const lid = await this.resolveLandlord(q, companyId);
        return {
          id: lid,
          match: lid ? { id: lid } : null,
          candidates: [],
          confidence: lid ? 0.95 : 0,
          mode: lid ? 'FUZZY' : 'NOT_FOUND',
        };
      case 'company':
        const compId = await this.resolveCompany(q);
        return {
          id: compId,
          match: compId ? { id: compId } : null,
          candidates: [],
          confidence: compId ? 0.95 : 0,
          mode: compId ? 'EXACT' : 'NOT_FOUND',
        };
      case 'property':
        return this.resolveProperty(q, companyId, strict);
      default:
        const id = await this.resolveGeneric(entity, q, companyId);
        return {
          id,
          match: id ? { id } : null,
          candidates: [],
          confidence: id ? 0.9 : 0,
          mode: id ? 'FUZZY' : 'NOT_FOUND',
        };
    }
  }

  private async resolveProperty(
    query: string,
    companyId?: string,
    strict: boolean = false,
  ): Promise<ResolutionResult> {
    const q = query.trim();
    const cid = companyId && companyId !== 'NONE' ? companyId : undefined;

    const exact = await this.prisma.property.findFirst({
      where: { companyId: cid, name: { equals: q, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (exact) {
      return {
        id: exact.id,
        match: exact,
        candidates: [],
        confidence: 1.0,
        mode: 'EXACT',
      };
    }

    const matches = await this.prisma.property.findMany({
      where: { companyId: cid, name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true },
      take: 10,
    });

    if (matches.length === 0) {
      return {
        id: null,
        match: null,
        candidates: [],
        confidence: 0,
        mode: 'NOT_FOUND',
      };
    }
    if (matches.length === 1) {
      return {
        id: matches[0].id,
        match: matches[0],
        candidates: [],
        confidence: 0.9,
        mode: 'FUZZY',
      };
    }

    // In strict mode, force explicit disambiguation.
    if (strict) {
      return {
        id: null,
        match: null,
        candidates: matches.slice(0, 5),
        confidence: 0.6,
        mode: 'AMBIGUOUS',
      };
    }

    const qLower = q.toLowerCase();
    const scored = matches
      .map((m: any) => {
        const n = (m.name || '').toLowerCase();
        let score = 0.6;
        if (n === qLower) score = 1.0;
        else if (n.startsWith(qLower)) score = 0.9;
        else if (n.includes(qLower)) score = 0.8;
        return { ...m, _score: score };
      })
      .sort((a: any, b: any) => b._score - a._score);

    const top = scored[0];
    const second = scored[1];
    const isClearlyBest =
      top._score >= 0.85 && (!second || top._score - second._score >= 0.15);
    if (isClearlyBest) {
      return {
        id: top.id,
        match: top,
        candidates: [],
        confidence: Math.min(0.95, top._score),
        mode: 'FUZZY',
      };
    }

    return {
      id: null,
      match: null,
      candidates: scored.slice(0, 5),
      confidence: 0.7,
      mode: 'AMBIGUOUS',
    };
  }

  private async resolveTenant(
    name: string,
    companyId?: string,
    unitHint?: string,
    strict: boolean = false,
  ): Promise<ResolutionResult> {
    const q = name.trim();
    const cid = companyId && companyId !== 'NONE' ? companyId : undefined;

    // 1. Try phone-based resolution first if it looks like a phone number
    const normalizedPhone = this.normalizePhone(q);
    if (normalizedPhone) {
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          phone: { contains: normalizedPhone.slice(-9) },
          companyId: cid,
        },
        include: {
          leases: {
            include: { unit: true },
            where: { status: 'ACTIVE', deletedAt: null },
          },
        },
      });
      if (tenant)
        return {
          id: tenant.id,
          match: tenant,
          candidates: [],
          confidence: 1.0,
          mode: 'EXACT',
        };
    }

    // 2. Try exact full name match
    const exact = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { firstName: { equals: q, mode: 'insensitive' } },
          { lastName: { equals: q, mode: 'insensitive' } },
          {
            AND: [
              {
                firstName: {
                  equals: q.split(/\s+/)[0] || '',
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  equals: q.split(/\s+/).slice(1).join(' ') || '',
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
        companyId: cid,
      },
      include: {
        leases: {
          include: { unit: true },
          where: { status: 'ACTIVE', deletedAt: null },
        },
      },
    });
    if (exact)
      return {
        id: exact.id,
        match: exact,
        candidates: [],
        confidence: 1.0,
        mode: 'EXACT',
      };

    // 3. UNIT-FIRST FALLBACK: Only if name looks like a unit number (e.g. "B4", "Unit 10")
    // Logic: length <= 5 AND contains at least one digit OR has 'unit' prefix
    const isUnitLike =
      / unit /i.test(q) || (q.length <= 5 && /\d/.test(q)) || unitHint;
    const potentialUnit =
      unitHint || (isUnitLike ? q.replace(/unit/i, '').trim() : undefined);

    if (potentialUnit) {
      const unitMatch = await this.prisma.unit.findFirst({
        where: {
          unitNumber: { equals: potentialUnit, mode: 'insensitive' },
          property: { companyId: cid },
        },
        include: {
          leases: {
            where: { status: 'ACTIVE', deletedAt: null },
            include: { tenant: true },
          },
        },
      });
      if (unitMatch && unitMatch.leases.length > 0) {
        const tenants = unitMatch.leases.map((l) => l.tenant);

        if (
          q.toLowerCase().includes(unitMatch.unitNumber.toLowerCase()) &&
          tenants.length === 1
        ) {
          this.logger.log(
            `[EntityResolution] Unit-First match: Resolved "${q}" to tenant ${tenants[0].firstName} via unit ${unitMatch.unitNumber}`,
          );
          return {
            id: tenants[0].id,
            match: { ...tenants[0], unitNumber: unitMatch.unitNumber },
            candidates: [],
            confidence: 0.98,
            mode: 'EXACT',
          };
        }

        const best = tenants.find((t) =>
          `${t.firstName} ${t.lastName}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        );
        if (best)
          return {
            id: best.id,
            match: { ...best, unitNumber: unitMatch.unitNumber },
            candidates: [],
            confidence: 0.95,
            mode: 'FUZZY',
          };
      }
    }

    // 4. Tokenized Fuzzy Match (Name-based) with Scoring
    const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
    if (tokens.length === 0)
      return {
        id: null,
        match: null,
        candidates: [],
        confidence: 0,
        mode: 'NOT_FOUND',
      };

    const fuzzyMatches = await this.prisma.tenant.findMany({
      where: {
        companyId: cid,
        OR: tokens.flatMap((t) => [
          { firstName: { contains: t, mode: 'insensitive' } },
          { lastName: { contains: t, mode: 'insensitive' } },
        ]),
      },
      include: {
        leases: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: { unit: true },
        },
      },
      take: 10,
    });

    if (fuzzyMatches.length === 0)
      return {
        id: null,
        match: null,
        candidates: [],
        confidence: 0,
        mode: 'NOT_FOUND',
      };

    const scored = fuzzyMatches
      .map((t) => {
        const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
        let score = 0;
        tokens.forEach((tok) => {
          if (fullName.includes(tok.toLowerCase()))
            score += tok.length / q.length;
        });
        return { ...t, _score: Math.min(score, 1) };
      })
      .sort((a, b) => b._score - a._score);

    const top = scored[0];
    if (top._score >= 0.7 || (scored.length === 1 && top._score >= 0.4)) {
      return {
        id: top.id,
        match: top,
        candidates: [],
        confidence: 0.8 + top._score * 0.15,
        mode:
          scored.length > 1 && scored[1]._score > top._score - 0.2
            ? 'AMBIGUOUS'
            : 'FUZZY',
      };
    }

    if (scored.length > 1) {
      return {
        id: null,
        match: null,
        candidates: scored.slice(0, 3),
        confidence: 0.6,
        mode: 'AMBIGUOUS',
      };
    }

    return {
      id: null,
      match: null,
      candidates: [],
      confidence: 0,
      mode: 'NOT_FOUND',
    };
  }

  private normalizePhone(q: string): string | null {
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 13) return digits;
    return null;
  }

  private async resolveUnitRes(
    query: string,
    companyId?: string,
    strict: boolean = false,
  ): Promise<ResolutionResult> {
    const q = query.trim();
    const cid = companyId && companyId !== 'NONE' ? companyId : undefined;

    // 1. Try exact unit number match
    const exact = await this.prisma.unit.findFirst({
      where: {
        unitNumber: { equals: q, mode: 'insensitive' },
        property: { companyId: cid },
      },
      include: { property: true },
    });
    if (exact)
      return {
        id: exact.id,
        match: exact,
        candidates: [],
        confidence: 1.0,
        mode: 'EXACT',
      };

    // 2. Handle "Property Name Unit X" pattern or "Unit X of Property"
    const complexMatch =
      q.match(/^(.*?)\s+(?:unit|in|of)\s+([a-z0-9-]+)$/i) ||
      q.match(/^unit\s+([a-z0-9-]+)\s+(?:in|of|at)\s+(.*)$/i);
    if (complexMatch) {
      const pName = q.match(/unit/i)
        ? q.startsWith('unit')
          ? complexMatch[2]
          : complexMatch[1]
        : complexMatch[1];
      const uNum = q.startsWith('unit') ? complexMatch[1] : complexMatch[2];

      const unit = await this.prisma.unit.findFirst({
        where: {
          unitNumber: { equals: uNum, mode: 'insensitive' },
          property: {
            name: { contains: pName, mode: 'insensitive' },
            companyId: cid,
          },
        },
        include: { property: true },
      });
      if (unit)
        return {
          id: unit.id,
          match: unit,
          candidates: [],
          confidence: 0.98,
          mode: 'FUZZY',
        };
    }

    if (strict)
      return {
        id: null,
        match: null,
        candidates: [],
        confidence: 0,
        mode: 'NOT_FOUND',
      };

    // 3. Contains match with better specificity
    const candidates = await this.prisma.unit.findMany({
      where: {
        unitNumber: { contains: q, mode: 'insensitive' },
        property: { companyId: cid },
      },
      include: { property: true },
      take: 10,
    });

    if (candidates.length === 1)
      return {
        id: candidates[0].id,
        match: candidates[0],
        candidates: [],
        confidence: 0.9,
        mode: 'FUZZY',
      };
    if (candidates.length > 1) {
      // Prefer exact match within the list if it exists
      const exactInList = candidates.find(
        (c) => c.unitNumber.toLowerCase() === q.toLowerCase(),
      );
      if (exactInList)
        return {
          id: exactInList.id,
          match: exactInList,
          candidates: [],
          confidence: 0.95,
          mode: 'EXACT',
        };
      return {
        id: null,
        match: null,
        candidates,
        confidence: 0.7,
        mode: 'AMBIGUOUS',
      };
    }

    return {
      id: null,
      match: null,
      candidates: [],
      confidence: 0,
      mode: 'NOT_FOUND',
    };
  }

  private async resolveGeneric(
    entity: string,
    query: string,
    companyId?: string,
  ): Promise<string | null> {
    const q = query.trim();
    const cid = companyId && companyId !== 'NONE' ? companyId : undefined;
    const where: any = { companyId: cid };

    if (entity === 'property')
      where.name = { contains: q, mode: 'insensitive' };
    else if (entity === 'landlord')
      where.firstName = { contains: q, mode: 'insensitive' };
    else return null;

    const match = await (this.prisma[entity as any] as any).findFirst({
      where,
      select: { id: true },
    });
    return match?.id ?? null;
  }

  private async checkExistence(
    entity: string,
    id: string,
    companyId?: string,
  ): Promise<boolean> {
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

  private async resolveLandlord(
    name: string,
    companyId?: string,
  ): Promise<string | null> {
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
