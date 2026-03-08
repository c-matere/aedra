import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';

export interface UpdateCompanyDto {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    logo?: string;
}

@Injectable()
export class CompaniesService {
    constructor(private readonly prisma: PrismaService) { }

    async findOne(id: string, actor: AuthenticatedUser) {
        if (actor.role !== 'SUPER_ADMIN' && actor.companyId !== id) {
            throw new ForbiddenException('You cannot access this company profile.');
        }

        const company = await this.prisma.company.findUnique({
            where: { id },
        });

        if (!company) {
            throw new NotFoundException('Company not found.');
        }

        return company;
    }

    async update(id: string, data: UpdateCompanyDto, actor: AuthenticatedUser) {
        if (actor.role !== 'SUPER_ADMIN' && actor.companyId !== id) {
            throw new ForbiddenException('You cannot update this company profile.');
        }

        // Only SUPER_ADMIN and COMPANY_ADMIN should be able to update
        if (actor.role === 'COMPANY_STAFF') {
            throw new ForbiddenException('Staff members cannot update company profile.');
        }

        const company = await this.prisma.company.findUnique({
            where: { id },
        });

        if (!company) {
            throw new NotFoundException('Company not found.');
        }

        return this.prisma.company.update({
            where: { id },
            data,
        });
    }
}
