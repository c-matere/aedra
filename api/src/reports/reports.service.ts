import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) { }

    private getWhere(actor: AuthenticatedUser) {
        if (actor.role === 'SUPER_ADMIN') {
            return {};
        }
        if (!actor.companyId) {
            throw new ForbiddenException('Your account is not linked to a company.');
        }
        return { companyId: actor.companyId };
    }

    async getSummary(actor: AuthenticatedUser) {
        const where = this.getWhere(actor);

        const [propertyCount, unitCount, tenantCount, leaseCount] = await Promise.all([
            this.prisma.property.count({ where }),
            this.prisma.unit.count({
                where: actor.role === 'SUPER_ADMIN' ? {} : { property: { companyId: actor.companyId } }
            }),
            this.prisma.tenant.count({ where }),
            this.prisma.lease.count({
                where: actor.role === 'SUPER_ADMIN' ? {} : { property: { companyId: actor.companyId } }
            }),
        ]);

        return {
            properties: propertyCount,
            units: unitCount,
            tenants: tenantCount,
            activeLeases: leaseCount,
        };
    }

    async getOccupancy(actor: AuthenticatedUser) {
        const where = actor.role === 'SUPER_ADMIN' ? {} : { property: { companyId: actor.companyId } };

        const statusCounts = await this.prisma.unit.groupBy({
            by: ['status'],
            where,
            _count: {
                id: true,
            },
        });

        const result = {
            VACANT: 0,
            OCCUPIED: 0,
            UNDER_MAINTENANCE: 0,
        };

        statusCounts.forEach((item) => {
            result[item.status] = item._count.id;
        });

        return result;
    }

    async getRevenue(actor: AuthenticatedUser) {
        const where = actor.role === 'SUPER_ADMIN' ? {} : { lease: { property: { companyId: actor.companyId } } };

        const totalRevenue = await this.prisma.payment.aggregate({
            where,
            _sum: {
                amount: true,
            },
        });

        return {
            totalRevenue: totalRevenue._sum.amount || 0,
        };
    }
}
