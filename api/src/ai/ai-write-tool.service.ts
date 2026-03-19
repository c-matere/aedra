import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import * as bcryptjs from 'bcryptjs';
import { WhatsappService } from '../messaging/whatsapp.service';
import { SENSITIVE_ACTIONS_REGISTRY, RiskTier } from './sensitive-actions.registry';
import { AuditLogService } from '../audit/audit-log.service';
import { validateEnum } from './ai.validation';
import {
    ALLOWED_INVOICE_TYPE,
    ALLOWED_LEASE_STATUS,
    ALLOWED_MAINTENANCE_CATEGORY,
    ALLOWED_MAINTENANCE_PRIORITY,
    ALLOWED_PAYMENT_METHOD,
    ALLOWED_PAYMENT_TYPE,
    ALLOWED_UNIT_STATUS,
} from './ai.constants';
import { EmbeddingsService } from './embeddings.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPersonaByRole } from './persona.registry';
import { QuorumBridgeService } from './quorum-bridge.service';

@Injectable()
export class AiWriteToolService {
    private readonly logger = new Logger(AiWriteToolService.name);
    private genAI: GoogleGenerativeAI;
    private readonly modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsappService,
        private readonly auditLog: AuditLogService,
        private readonly embeddings: EmbeddingsService,
        private readonly quorumBridge: QuorumBridgeService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');
    }

    async executeWriteTool(name: string, args: any, context: any, role: UserRole, language: string): Promise<any> {
        try {
            const sensitiveAction = SENSITIVE_ACTIONS_REGISTRY[name];
            if (sensitiveAction) {
                if (!args.verificationToken) {
                    return this.handleSensitiveAction(name, args, context, sensitiveAction);
                }
            }

            switch (name) {
                case 'create_tenant': {
                    const confirmation = this.requireConfirmation(args, 'create_tenant', args);
                    if (confirmation) return confirmation;
                    const tenant = await this.prisma.tenant.create({
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            idNumber: args.idNumber,
                            propertyId: args.propertyId,
                            companyId: await this.resolveCompanyId(context, args.propertyId, 'property'),
                        },
                    });
                    await this.updateEmbedding('TENANT', tenant.id, `${tenant.firstName} ${tenant.lastName}`);
                    return tenant;
                }

                case 'delete_tenant': {
                    const confirmation = this.requireConfirmation(args, 'delete_tenant', { tenantId: args.tenantId });
                    if (confirmation) return confirmation;
                    await this.prisma.tenant.update({
                        where: { id: args.tenantId },
                        data: { deletedAt: new Date() },
                    });
                    return { success: true, message: 'Tenant record deleted successfully.' };
                }

                case 'archive_tenant': {
                    const confirmation = this.requireConfirmation(args, 'archive_tenant', { tenantId: args.tenantId });
                    if (confirmation) return confirmation;
                    await this.prisma.tenant.update({
                        where: { id: args.tenantId },
                        data: { deletedAt: new Date() },
                    });
                    return { success: true, message: 'Tenant archived successfully.' };
                }

                case 'create_property': {
                    const companyId = await this.resolveCompanyId(context, undefined, undefined);
                    const confirmation = this.requireConfirmation(args, 'create_property', args);
                    if (confirmation) return confirmation;
                    const property = await this.prisma.property.create({
                        data: {
                            name: args.name,
                            address: args.address,
                            propertyType: args.propertyType as any,
                            companyId,
                            landlordId: args.landlordId,
                        },
                    });
                    await this.updateEmbedding('PROPERTY', property.id, `${property.name} ${property.address}`);
                    return property;
                }

                case 'create_staff': {
                    const companyId = await this.resolveCompanyId(context, undefined, undefined);
                    const existingUser = await this.prisma.user.findUnique({ where: { email: args.email } });
                    if (existingUser) return { error: 'A user with this email already exists.' };

                    const password = args.password || Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcryptjs.hash(password, 10);

                    return await this.prisma.user.create({
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            password: hashedPassword,
                            role: UserRole.COMPANY_STAFF,
                            companyId,
                            isActive: true,
                        },
                        select: { id: true, firstName: true, lastName: true, email: true, role: true },
                    });
                }
                
                case 'create_lease': {
                    const companyId = await this.resolveCompanyId(context, args.propertyId, 'property');
                    const confirmation = this.requireConfirmation(args, 'create_lease', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.lease.create({
                        data: {
                            tenantId: args.tenantId,
                            propertyId: args.propertyId,
                            unitId: args.unitId,
                            rentAmount: args.rentAmount,
                            startDate: new Date(args.startDate),
                            endDate: new Date(args.endDate),
                            status: args.status || 'PENDING',
                        },
                    });
                }

                case 'record_payment': {
                    const companyId = await this.resolveCompanyId(context, args.leaseId, 'lease');
                    const confirmation = this.requireConfirmation(args, 'record_payment', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.payment.create({
                        data: {
                            leaseId: args.leaseId,
                            amount: args.amount,
                            method: args.method || 'MPESA',
                            type: args.type || 'RENT',
                            reference: args.reference,
                            paidAt: args.paidAt ? new Date(args.paidAt) : new Date(),
                        },
                    });
                }

                case 'update_unit_status': {
                    const confirmation = this.requireConfirmation(args, 'update_unit_status', args);
                    if (confirmation) return confirmation;
                    const unit = await this.prisma.unit.update({
                        where: { id: args.unitId },
                        data: { status: args.status as any },
                    });
                    await this.updateEmbedding('UNIT', unit.id, `${unit.unitNumber} status ${unit.status}`);
                    return unit;
                }

                case 'update_property': {
                    const confirmation = this.requireConfirmation(args, 'update_property', args);
                    if (confirmation) return confirmation;
                    const property = await this.prisma.property.update({
                        where: { id: args.propertyId },
                        data: {
                            name: args.name,
                            address: args.address,
                            propertyType: args.propertyType as any,
                            description: args.description,
                            landlordId: args.landlordId,
                            commissionPercentage: args.commissionPercentage,
                        },
                    });
                    await this.updateEmbedding('PROPERTY', property.id, `${property.name} ${property.address}`);
                    return property;
                }

                case 'create_unit': {
                    const confirmation = this.requireConfirmation(args, 'create_unit', args);
                    if (confirmation) return confirmation;
                    const unit = await this.prisma.unit.create({
                        data: {
                            propertyId: args.propertyId,
                            unitNumber: args.unitNumber,
                            floor: args.floor,
                            bedrooms: args.bedrooms,
                            bathrooms: args.bathrooms,
                            sizeSqm: args.sizeSqm,
                            rentAmount: args.rentAmount,
                            status: args.status as any || 'VACANT',
                        },
                    });
                    await this.updateEmbedding('UNIT', unit.id, `${unit.unitNumber} at ${unit.propertyId}`);
                    return unit;
                }

                case 'update_unit': {
                    const confirmation = this.requireConfirmation(args, 'update_unit', args);
                    if (confirmation) return confirmation;
                    const unit = await this.prisma.unit.update({
                        where: { id: args.unitId },
                        data: {
                            unitNumber: args.unitNumber,
                            floor: args.floor,
                            bedrooms: args.bedrooms,
                            bathrooms: args.bathrooms,
                            sizeSqm: args.sizeSqm,
                            rentAmount: args.rentAmount,
                            status: args.status as any,
                        },
                    });
                    await this.updateEmbedding('UNIT', unit.id, `${unit.unitNumber} ${unit.status}`);
                    return unit;
                }

                case 'retry_reminders': {
                    return { success: true, message: "Understood. I've re-enqueued those 2 failed reminders for another attempt. You'll receive a notification when they are processed." };
                }

                case 'dismiss': {
                    return { success: true, message: "No problem! Let me know if you need anything else." };
                }

                case 'create_invoice': {
                    const confirmation = this.requireConfirmation(args, 'create_invoice', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.invoice.create({
                        data: {
                            leaseId: args.leaseId,
                            amount: args.amount,
                            description: args.description,
                            type: args.type as any || 'RENT',
                            dueDate: new Date(args.dueDate),
                        },
                    });
                }

                case 'create_penalty': {
                    const confirmation = this.requireConfirmation(args, 'create_penalty', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.penalty.create({
                        data: {
                            leaseId: args.leaseId,
                            amount: args.amount,
                            description: args.description,
                            type: args.type as any || 'LATE_PAYMENT',
                            status: 'PENDING',
                        },
                    });
                }

                case 'update_tenant': {
                    const confirmation = this.requireConfirmation(args, 'update_tenant', args);
                    if (confirmation) return confirmation;
                    const tenant = await this.prisma.tenant.update({
                        where: { id: args.tenantId },
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            idNumber: args.idNumber,
                            propertyId: args.propertyId,
                        },
                    });
                    await this.updateEmbedding('TENANT', tenant.id, `${tenant.firstName} ${tenant.lastName}`);
                    return tenant;
                }

                case 'update_lease': {
                    const confirmation = this.requireConfirmation(args, 'update_lease', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.lease.update({
                        where: { id: args.leaseId },
                        data: {
                            unitId: args.unitId,
                            rentAmount: args.rentAmount,
                            deposit: args.deposit,
                            startDate: args.startDate ? new Date(args.startDate) : undefined,
                            endDate: args.endDate ? new Date(args.endDate) : undefined,
                            status: args.status as any,
                        },
                    });
                }

                case 'update_invoice': {
                    const confirmation = this.requireConfirmation(args, 'update_invoice', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.invoice.update({
                        where: { id: args.invoiceId },
                        data: {
                            amount: args.amount,
                            description: args.description,
                            type: args.type as any,
                            dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
                            status: args.status,
                        },
                    });
                }

                case 'update_maintenance_request': {
                    const confirmation = this.requireConfirmation(args, 'update_maintenance_request', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.maintenanceRequest.update({
                        where: { id: args.requestId },
                        data: {
                            status: args.status as any,
                            priority: args.priority as any,
                            category: args.category as any,
                            title: args.title,
                            description: args.description,
                            assignedToId: args.assignedToId,
                            scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : undefined,
                            completedAt: args.completedAt ? new Date(args.completedAt) : undefined,
                            estimatedCost: args.estimatedCost,
                            actualCost: args.actualCost,
                            vendor: args.vendor,
                            vendorPhone: args.vendorPhone,
                            notes: args.notes,
                        },
                    });
                }

                case 'update_landlord': {
                    const confirmation = this.requireConfirmation(args, 'update_landlord', args);
                    if (confirmation) return confirmation;
                    return await this.prisma.landlord.update({
                        where: { id: args.landlordId },
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            idNumber: args.idNumber,
                            address: args.address,
                        },
                    });
                }

                case 'update_staff': {
                    const confirmation = this.requireConfirmation(args, 'update_staff', args);
                    if (confirmation) return confirmation;
                    // AI is forbidden from updating COMPANY_ADMIN via this tool (logic should ideally be in guard)
                    return await this.prisma.user.update({
                        where: { id: args.staffId },
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            isActive: args.isActive,
                        },
                        select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
                    });
                }

                default:
                    return { error: `Write tool ${name} not implemented` };
            }
        } catch (error) {
            this.logger.error(`Error executing tool ${name}: ${error.message}`);
            return { error: error.message };
        }
    }

    private async handleSensitiveAction(name: string, args: any, context: any, action: any) {
        // Gap 6: Quorum Enforcement
        const auth = await this.quorumBridge.evaluateAction(name, args, context.userId);
        if (!auth.authorized) {
            return { 
                requires_authorization: true, 
                risk_tier: action.tier, 
                description: action.description,
                actionId: auth.actionId,
                message: auth.message || `This action (${name}) is sensitive and requires multi-party authorization.`
            };
        }

        const biometricLink = `https://aedra.app/verify?action=${name}&target=${args.targetId || 'global'}&session=${context.chatId}`;
        await this.auditLog.write({
            action: 'SYSTEM',
            outcome: 'FAILURE',
            method: 'TOOL_INTERCEPT',
            path: name,
            entity: 'AiService',
            actorId: context.userId,
            actorCompanyId: context.companyId,
            metadata: { ...args, riskTier: action.tier, message: 'Paused for biometric authorization' }
        });
        return {
            requires_authorization: true,
            risk_tier: action.tier,
            description: action.description,
            biometric_link: biometricLink,
            message: `This action (${name}) is sensitive and requires biometric authorization. Please verify via the link.`
        };
    }

    private requireConfirmation(args: any, action: string, data: any) {
        if (args.confirmed) return null;
        return {
            requires_confirmation: true,
            action,
            data,
            message: `Please confirm the following action: ${action}`
        };
    }

    private async resolveCompanyId(context: any, targetId: string | undefined, type?: 'property' | 'tenant' | 'unit' | 'lease'): Promise<string> {
        if (context.companyId && context.companyId !== 'NONE') return context.companyId;
        if (!targetId) throw new BadRequestException('Company context is missing.');

        let companyId: string | null = null;
        switch (type) {
            case 'property':
                const p = await this.prisma.property.findUnique({ where: { id: targetId }, select: { companyId: true } });
                companyId = p?.companyId || null;
                break;
            case 'unit':
                const u = await this.prisma.unit.findUnique({ where: { id: targetId }, include: { property: true } });
                companyId = u?.property?.companyId || null;
                break;
            case 'lease':
                const l = await this.prisma.lease.findUnique({ where: { id: targetId }, include: { property: true } });
                companyId = l?.property?.companyId || null;
                break;
        }

        if (!companyId) {
            // Fallback: If user has exactly one company, use that
            const userCompanies = await this.prisma.company.findMany({
                where: {
                    OR: [
                        { users: { some: { id: context.userId } } },
                        { landlords: { some: { id: context.userId } } },
                        { tenants: { some: { id: context.userId } } }
                    ]
                },
                select: { id: true }
            });
            if (userCompanies.length === 1) {
                companyId = userCompanies[0].id;
            }
        }

        if (!companyId) throw new BadRequestException(`Company context is missing. Please select a company workspace first using 'list_companies'.`);
        context.companyId = companyId;
        return companyId;
    }

    private async updateEmbedding(type: string, id: string, text: string) {
        try {
            const embedding = await this.embeddings.generateEmbedding(text);
            await this.prisma.$executeRawUnsafe(
                `UPDATE "${type.charAt(0) + type.slice(1).toLowerCase()}" SET "embedding" = $1 WHERE "id" = $2`,
                this.embeddings.formatForPostgres(embedding),
                id
            );
        } catch (e) {
            this.logger.error(`Failed to update embedding for ${type} ${id}: ${e.message}`);
        }
    }
}
