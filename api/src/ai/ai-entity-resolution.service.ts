import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  ): Promise<string | null> {
    if (!identifier?.trim()) return null;
    const q = identifier.trim();

    // 1. Check if it's already a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    if (isUuid) {
      // Basic existence check to ensure it belongs to the right company if provided
      const exists = await this.checkExistence(entity, q, companyId);
      if (exists) return q;
      return null;
    }

    // 2. Name-based resolution
    switch (entity) {
      case 'tenant':
        return this.resolveTenant(q, companyId);
      case 'property':
        return this.resolveProperty(q, companyId);
      case 'unit':
        return this.resolveUnit(q, companyId);
      case 'landlord':
        return this.resolveLandlord(q, companyId);
      case 'company':
        return this.resolveCompany(q);
      default:
        return null;
    }
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
      this.logger.error(`Existence check failed for ${entity}: ${e.message}`);
      return false;
    }
  }

  private async resolveTenant(name: string, companyId?: string): Promise<string | null> {
    const parts = name.split(/\s+/);
    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : undefined;

    const orConditions: any[] = [
      { firstName: { contains: first, mode: 'insensitive' } },
      { lastName: { contains: first, mode: 'insensitive' } },
    ];
    if (last) {
      orConditions.push({ firstName: { contains: last, mode: 'insensitive' } });
      orConditions.push({ lastName: { contains: last, mode: 'insensitive' } });
    }

    const match = await this.prisma.tenant.findFirst({
      where: {
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
        OR: orConditions,
      },
      select: { id: true },
    });
    return match?.id ?? null;
  }

  private async resolveProperty(name: string, companyId?: string): Promise<string | null> {
    const match = await this.prisma.property.findFirst({
      where: {
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
        name: { contains: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return match?.id ?? null;
  }

  private async resolveUnit(number: string, companyId?: string): Promise<string | null> {
    const match = await this.prisma.unit.findFirst({
      where: {
        deletedAt: null,
        property: {
          ...(companyId ? { companyId } : {}),
          deletedAt: null,
        },
        OR: [
          { unitNumber: { contains: number, mode: 'insensitive' } },
          { semanticTags: { contains: number, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return match?.id ?? null;
  }

  private async resolveLandlord(name: string, companyId?: string): Promise<string | null> {
    const match = await this.prisma.landlord.findFirst({
      where: {
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return match?.id ?? null;
  }

  private async resolveCompany(name: string): Promise<string | null> {
    const match = await this.prisma.company.findFirst({
      where: {
        name: { contains: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return match?.id ?? null;
  }
}
