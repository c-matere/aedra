import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, Prisma } from '@prisma/client';
import type { UserRole } from '../auth/roles.enum';

interface UserContext {
    id: string;
    role: UserRole;
    companyId?: string;
}

@Injectable()
export class DocumentsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(user: UserContext, page = 1, limit = 10, search?: string) {
        const skip = (page - 1) * limit;
        const take = limit;

        const where: Prisma.DocumentWhereInput = {
            ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ]
            } : {}),
        };

        const [data, total] = await Promise.all([
            this.prisma.document.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.document.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string, user: UserContext) {
        const doc = await this.prisma.document.findUnique({
            where: { id },
        });

        if (!doc) {
            throw new NotFoundException('Document not found');
        }

        if (user.role !== 'SUPER_ADMIN' && doc.companyId !== user.companyId) {
            throw new NotFoundException('Document not found');
        }

        return doc;
    }

    async create(
        data: {
            name: string;
            fileUrl: string;
            type?: 'AGREEMENT' | 'COMPLIANCE' | 'ID_PROOF' | 'INVOICE_COPY' | 'OTHER';
            description?: string;
            propertyId?: string;
            unitId?: string;
            tenantId?: string;
            leaseId?: string;
        },
        user: UserContext,
    ) {
        let companyId = user.companyId;

        if (user.role === 'SUPER_ADMIN') {
            // For Super Admins creating docs, we need to infer the company if possible.
            // Easiest heuristic is falling back to the target entity's companyId.
            if (!companyId) {
                if (data.propertyId) {
                    const p = await this.prisma.property.findUnique({ where: { id: data.propertyId } });
                    if (p) companyId = p.companyId;
                } else if (data.tenantId) {
                    const t = await this.prisma.tenant.findUnique({ where: { id: data.tenantId } });
                    if (t) companyId = t.companyId;
                } else if (data.leaseId) {
                    const l = await this.prisma.lease.findUnique({
                        where: { id: data.leaseId },
                        include: { property: true },
                    });
                    if (l) companyId = l.property.companyId;
                }
            }
            if (!companyId) {
                throw new Error('Could not determine company context for document');
            }
        }

        return this.prisma.document.create({
            data: {
                ...data,
                companyId: companyId as string,
            },
        });
    }

    async update(id: string, data: any, user: UserContext) {
        const doc = await this.findOne(id, user);

        return this.prisma.document.update({
            where: { id: doc.id },
            data,
        });
    }

    async remove(id: string, user: UserContext) {
        const doc = await this.findOne(id, user);

        await this.prisma.document.delete({
            where: { id: doc.id },
        });

        return { deleted: true };
    }
}
