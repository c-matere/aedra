import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { ReportsService } from '../reports/reports.service';
import { UserRole } from '../auth/roles.enum';
import { getSessionUid } from './ai-tool-selector.util';
import {
    formatPropertyList,
    formatTenantList,
    formatCompanyList,
    formatUnitList,
    formatLeaseList,
    formatPaymentList,
    formatInvoiceList,
    formatMaintenanceRequestList,
    formatLandlordList,
    formatStaffList,
    formatPropertyDetails,
    formatTenantDetails,
    formatLeaseDetails,
    formatUnitDetails,
    formatMaintenanceRequestDetails,
    formatLandlordDetails,
    formatStaffDetails,
    formatExpenseList,
    formatCompanySummary,
    formatTenantStatement,
} from './ai.formatters';
import { validateEnum } from './ai.validation';
import {
    ALLOWED_INVOICE_STATUS,
    ALLOWED_LEASE_STATUS,
    ALLOWED_MAINTENANCE_STATUS,
    ALLOWED_UNIT_STATUS,
} from './ai.constants';
import { EmbeddingsService } from './embeddings.service';
import { MenuRouterService } from './menu-router.service';

@Injectable()
export class AiReadToolService {
    private readonly logger = new Logger(AiReadToolService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly unitsService: UnitsService,
        private readonly reportsService: ReportsService,
        private readonly embeddings: EmbeddingsService,
        private readonly menuRouter: MenuRouterService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    async executeReadTool(name: string, args: any, context: any, role: UserRole, language: string): Promise<any> {
        try {
            switch (name) {
                case 'list_properties':
                    const properties = await this.prisma.property.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            ...(role === UserRole.LANDLORD ? { landlordId: context.userId } : {}),
                            ...(role === UserRole.TENANT ? { tenants: { some: { id: context.userId } } } : {}),
                        },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        include: { landlord: true },
                    });

                    // Cache for deterministic selection
                    const propUid = getSessionUid(context);
                    const propSessionKey = `ai_session:${propUid}`;
                    const propSession: any = await this.cacheManager.get(propSessionKey) || {};
                    propSession.lastResults = properties.map(p => ({ id: p.id, name: p.name, type: 'property' }));
                    propSession.lastIntent = 'list_properties';
                    propSession.awaitingSelection = 'property';
                    await this.cacheManager.set(propSessionKey, propSession, 3600 * 1000);

                    const pListKey = `list:${propUid}`;
                    await this.cacheManager.set(pListKey, { items: propSession.lastResults, chatId: context.chatId, action: 'list_properties', idField: 'propertyId' }, 300 * 1000);

                    return properties;

                case 'list_companies': {
                    const isSuperAdmin = context.isSuperAdmin ?? role === UserRole.SUPER_ADMIN;
                    let whereClause = {};
                    if (!isSuperAdmin) {
                        whereClause = {
                            OR: [
                                { users: { some: { id: context.userId } } },
                                { landlords: { some: { id: context.userId } } },
                                { tenants: { some: { id: context.userId } } }
                            ]
                        };
                    }
                let companies = await this.prisma.company.findMany({
                    where: whereClause,
                    orderBy: { updatedAt: 'desc' },
                    take: args?.limit || 20,
                    select: { id: true, name: true },
                });

                // Deduplicate by ID and Name as a safety net
                const seenNames = new Set();
                companies = companies.filter(c => {
                    if (seenNames.has(c.name.toLowerCase())) return false;
                    seenNames.add(c.name.toLowerCase());
                    return true;
                });
                companies = Array.from(new Map(companies.map(c => [c.id, c])).values());

                // Cache for deterministic selection
                const uid = getSessionUid(context);
                const sessionKey = `ai_session:${uid}`;
                let session: any = await this.cacheManager.get(sessionKey) || {};
                
                session.userId = session.userId || uid;
                session.lastIntent = 'list_companies';
                session.lastResults = companies.map(c => ({ id: c.id, name: c.name, type: 'company' }));
                session.awaitingSelection = 'company';
                await this.cacheManager.set(sessionKey, session, 3600 * 1000); // 1 hour



                // Also cache a short-lived selection list for direct digit replies
                const listKey = `list:${uid}`;
                await this.cacheManager.set(listKey, { items: session.lastResults, chatId: context.chatId }, 300 * 1000); // 5 minutes
                await this.menuRouter.setCompanyMenu(uid, companies);

                return formatCompanyList(companies, undefined, 1, language as any);
            }

                case 'search_companies': {
                    const isSuperAdmin = context.isSuperAdmin ?? role === UserRole.SUPER_ADMIN;
                    const terms = (args.query || '').trim().split(/\s+/).filter(Boolean);
                    const andConditions = terms.map((term: string) => ({
                        name: { contains: term, mode: 'insensitive' }
                    }));

                    let whereClause: any = {
                        AND: andConditions,
                    };
                    if (!isSuperAdmin) {
                        whereClause = {
                            ...whereClause,
                            OR: [
                                { users: { some: { id: context.userId } } },
                                { landlords: { some: { id: context.userId } } },
                                { tenants: { some: { id: context.userId } } }
                            ]
                        };
                    }
                    let companies = await this.prisma.company.findMany({
                        where: whereClause,
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        select: { id: true, name: true },
                    });
                    
                    // Deduplicate by ID and Name as a safety net
                    const seenNamesSearch = new Set();
                    companies = companies.filter(c => {
                        if (seenNamesSearch.has(c.name.toLowerCase())) return false;
                        seenNamesSearch.add(c.name.toLowerCase());
                        return true;
                    });
                    companies = Array.from(new Map(companies.map(c => [c.id, c])).values());

                    return formatCompanyList(companies, args.query, 1, language as any);
                }

                case 'get_portfolio_arrears': {
                    const snapshot = await this.unitsService.getPortfolioSnapshot(context, args?.propertyId);
                    
                    let response = '# MONTHLY COLLECTION STATUS\n\n';
                    for (const [propId, data] of Object.entries(snapshot)) {
                        const d = data as any;
                        response += `## Property: ${d.name}\n`;
                        response += `- Expected: KES ${d.total_expected.toLocaleString()}\n`;
                        response += `- Collected: KES ${d.total_collected.toLocaleString()}\n`;
                        response += `- Rate: ${d.collection_rate}%\n\n`;
                        
                        if (d.unpaid_this_month.length > 0) {
                            response += '### Unpaid/Partial Units:\n';
                            for (const u of d.unpaid_this_month) {
                                const balance = u.expected - u.collected;
                                response += `- ${u.number} (${u.tenant}): KES ${balance.toLocaleString()} pending\n`;
                            }
                        } else {
                            response += '✓ All units paid for this property.\n';
                        }
                        response += '\n---\n';
                    }
                    return response;
                }

                case 'import_tenants': {
                    return { 
                        success: true, 
                        data: "To import tenants from a spreadsheet (Excel/CSV), please use the Web Dashboard at https://aedra.re/dashboard/imports. \n\nYou can also upload the file here on WhatsApp, and I will extract the data for you!" 
                    };
                }

                case 'check_rent_status': {
                    // Alias for portfolio arrears
                    return await this.executeReadTool('get_portfolio_arrears', args, context, role, language);
                }

                case 'get_property_details':
                    await this.resolveCompanyId(context, args.propertyId, 'property');
                    const property = await this.prisma.property.findFirst({
                        where: { 
                            id: args.propertyId, 
                            companyId: context.companyId ?? undefined, 
                            deletedAt: null,
                            ...(role === UserRole.LANDLORD ? { landlordId: context.userId } : {}),
                            ...(role === UserRole.TENANT ? { tenants: { some: { id: context.userId } } } : {}),
                        },
                        include: {
                            units: { where: { deletedAt: null } },
                            landlord: true,
                        },
                    });
                    if (!property) return { error: 'Property not found.' };
                    return property;

                case 'get_tenant_details': {
                    await this.resolveCompanyId(context, args.tenantId, 'tenant');
                    const tenant = await this.prisma.tenant.findFirst({
                        where: {
                            id: args.tenantId,
                            companyId: context.companyId ?? undefined,
                            deletedAt: null,
                        },
                        include: {
                            property: true,
                            leases: {
                                where: { deletedAt: null },
                                orderBy: { createdAt: 'desc' },
                                take: 1,
                                include: { unit: true }
                            }
                        }
                    });
                    if (!tenant) return { error: 'Tenant not found.' };
                    return tenant;
                }

                case 'select_company': {
                    if (!args.companyId) return { error: 'Company ID is required' };
                    const company = await this.prisma.company.findUnique({ where: { id: args.companyId } });
                    if (!company) return { error: `Company not found with ID: ${args.companyId}` };

                    if (!context.isSuperAdmin) {
                        const user = await this.prisma.user.findFirst({
                            where: { id: context.userId, companyId: company.id }
                        });
                        if (!user) return { error: 'You do not have access to this company.' };
                    }

                    const chatId = context.chatId;
                    if (chatId) {
                        await this.prisma.chatHistory.update({
                            where: { id: chatId },
                            data: { companyId: company.id },
                        }).catch(() => {});
                    }
                    context.companyId = company.id;

                    const [propCount, tenantCount] = await Promise.all([
                        this.prisma.property.count({ where: { companyId: company.id, deletedAt: null } }),
                        this.prisma.tenant.count({ where: { companyId: company.id, deletedAt: null } })
                    ]);

                    return { 
                        success: true, 
                        data: `✅ Workspace set to ${company.name}\n\n${propCount} properties and ${tenantCount} tenants identified for this company.`,
                        company: { id: company.id, name: company.name } 
                    };
                }

                case 'list_vacant_units': {
                    const isGeneric = this.isGenericQuery(args.query);
                    const vectorIds = (!isGeneric && args.query) ? await this.vectorSearch('UNIT', args.query, context.companyId) : [];
                    const vacantUnits = await this.prisma.unit.findMany({
                        where: {
                            status: 'VACANT',
                            deletedAt: null,
                            property: { deletedAt: null, companyId: context.companyId },
                            id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
                            ...(args.query && vectorIds.length === 0 ? {
                                OR: [
                                    { unitNumber: { contains: args.query, mode: 'insensitive' } },
                                    { semanticTags: { contains: args.query, mode: 'insensitive' } },
                                ]
                            } : {}),
                        },
                        include: { property: { select: { name: true, address: true } } },
                        take: args?.limit || 20,
                    });

                    // Cache for deterministic selection
                    const unitUid = getSessionUid(context);
                    const unitSessionKey = `ai_session:${unitUid}`;
                    const unitSession: any = await this.cacheManager.get(unitSessionKey) || {};
                    unitSession.lastResults = vacantUnits.map(u => ({ id: u.id, name: u.unitNumber, type: 'unit' }));
                    unitSession.lastIntent = 'list_units';
                    unitSession.awaitingSelection = 'unit';
                    await this.cacheManager.set(unitSessionKey, unitSession, 3600 * 1000);

                    const uListKey = `list:${unitUid}`;
                    await this.cacheManager.set(uListKey, { items: unitSession.lastResults, chatId: context.chatId, action: 'list_units', idField: 'unitId' }, 300 * 1000);

                    return vacantUnits;
                }

                case 'search_properties': {
                    const isGeneric = this.isGenericQuery(args.query);
                    const vectorIds = (!isGeneric && args.query) ? await this.vectorSearch('PROPERTY', args.query, context.companyId) : [];
                    const foundProperties = await this.prisma.property.findMany({
                        where: {
                            id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
                            companyId: context.companyId,
                            deletedAt: null,
                            ...(vectorIds.length === 0 ? {
                                OR: [
                                    { name: { contains: args.query, mode: 'insensitive' } },
                                    { address: { contains: args.query, mode: 'insensitive' } },
                                ],
                            } : {}),
                        },
                        include: { landlord: true },
                        take: args?.limit || 20,
                    });
                    return foundProperties;
                }

                case 'list_units': {
                    const statusValue = validateEnum(args?.status, ALLOWED_UNIT_STATUS, 'status');
                    if (statusValue && typeof statusValue === 'object') return statusValue;
                    const units = await this.prisma.unit.findMany({
                        where: {
                            deletedAt: null,
                            property: { 
                                companyId: context.companyId, 
                                deletedAt: null,
                                ...(args?.propertyId ? { id: args.propertyId } : {}),
                            },
                            ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
                        },
                        include: { property: true },
                        take: args?.limit || 20,
                    });
                    return units;
                }

                case 'get_unit_details': {
                    await this.resolveCompanyId(context, args.unitId, 'unit');
                    const unit = await this.prisma.unit.findFirst({
                        where: {
                            id: args.unitId,
                            deletedAt: null,
                            property: { companyId: context.companyId, deletedAt: null },
                        },
                        include: { property: true, leases: { include: { tenant: true } } },
                    });
                    return unit;
                }

                case 'list_tenants': {
                    const tenants = await this.prisma.tenant.findMany({
                        where: { companyId: context.companyId, deletedAt: null },
                        include: { property: true },
                        take: args?.limit || 20,
                    });

                    // Cache for deterministic selection
                    const tenantUid = getSessionUid(context);
                    const tenantSessionKey = `ai_session:${tenantUid}`;
                    const tenantSession: any = await this.cacheManager.get(tenantSessionKey) || {};
                    tenantSession.lastResults = tenants.map(t => ({ id: t.id, name: `${t.firstName} ${t.lastName}`, type: 'tenant' }));
                    tenantSession.lastIntent = 'list_tenants';
                    tenantSession.awaitingSelection = 'tenant';
                    await this.cacheManager.set(tenantSessionKey, tenantSession, 3600 * 1000);

                    const tListKey = `list:${tenantUid}`;
                    await this.cacheManager.set(tListKey, { items: tenantSession.lastResults, chatId: context.chatId, action: 'list_tenants', idField: 'tenantId' }, 300 * 1000);

                    return tenants;
                }

                case 'search_tenants': {
                    const isGeneric = this.isGenericQuery(args.query);
                    const vectorIds = (!isGeneric && args.query) ? await this.vectorSearch('TENANT', args.query, context.companyId) : [];
                    const foundTenants = await this.prisma.tenant.findMany({
                        where: {
                            id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
                            companyId: context.companyId,
                            deletedAt: null,
                            ...(vectorIds.length === 0 ? {
                                OR: [
                                    { firstName: { contains: args.query, mode: 'insensitive' } },
                                    { lastName: { contains: args.query, mode: 'insensitive' } },
                                ],
                            } : {}),
                        },
                        include: { property: true },
                        take: args?.limit || 20,
                    });

                    // Cache for deterministic selection
                    const sTenantUid = getSessionUid(context);
                    const sTenantSessionKey = `ai_session:${sTenantUid}`;
                    const sTenantSession: any = await this.cacheManager.get(sTenantSessionKey) || {};
                    sTenantSession.lastResults = foundTenants.map(t => ({ id: t.id, name: `${t.firstName} ${t.lastName}`, type: 'tenant' }));
                    sTenantSession.lastIntent = 'list_tenants';
                    await this.cacheManager.set(sTenantSessionKey, sTenantSession, 3600 * 1000);

                    return foundTenants;
                }

                case 'get_company_summary': {
                    if (!context.companyId || context.companyId === 'NONE') return { error: 'Please select a company workspace first.' };
                    const { start, end } = this.getDateRange(args);
                    const [props, units, tenants, company] = await Promise.all([
                        this.prisma.property.count({ where: { companyId: context.companyId, deletedAt: null } }),
                        this.prisma.unit.count({ where: { property: { companyId: context.companyId } } }),
                        this.prisma.tenant.count({ where: { companyId: context.companyId } }),
                        this.prisma.company.findUnique({ where: { id: context.companyId } }),
                    ]);
                    return formatCompanySummary({
                        companyName: company?.name,
                        dateRange: { from: start.toISOString(), to: end.toISOString() },
                        properties: props,
                        units: { total: units, occupied: 0, vacant: units }, // Simplification
                        tenants: tenants,
                        activeLeases: 0,
                        totals: { payments: 0, expenses: 0, invoices: 0, overdueInvoices: 0 }
                    });
                }

                case 'list_maintenance_requests': {
                    const statusValue = validateEnum(args?.status, ALLOWED_MAINTENANCE_STATUS, 'status');
                    const requests = await this.prisma.maintenanceRequest.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
                        },
                        include: { property: true, unit: true, assignedTo: true },
                        take: args?.limit || 20,
                    });
                    return requests;
                }

                case 'list_payments': {
                    const payments = await this.prisma.payment.findMany({
                        where: {
                            lease: { property: { companyId: context.companyId } },
                            deletedAt: null,
                        },
                        include: { lease: { include: { tenant: true, property: true } } },
                        take: args?.limit || 20,
                    });
                    return payments;
                }

                case 'list_invoices': {
                    const invoices = await this.prisma.invoice.findMany({
                        where: {
                            lease: { property: { companyId: context.companyId } },
                            deletedAt: null,
                        },
                        include: { lease: { include: { tenant: true, property: true } } },
                        take: args?.limit || 20,
                    });
                    return invoices;
                }

                case 'list_expenses': {
                    const expenses = await this.prisma.expense.findMany({
                        where: { companyId: context.companyId, deletedAt: null },
                        include: { property: true, unit: true },
                        take: args?.limit || 20,
                    });
                    return expenses;
                }

                case 'get_tenant_statement': {
                    const tenant = await this.prisma.tenant.findUnique({
                        where: { id: args.tenantId },
                        include: {
                            leases: {
                                include: {
                                    invoices: { orderBy: { createdAt: 'desc' } },
                                    payments: { orderBy: { paidAt: 'desc' } },
                                },
                            },
                        },
                    });
                    if (!tenant) return { error: 'Tenant not found.' };
                    
                    // Flatten invoices and payments from all leases
                    const invoices = tenant.leases.flatMap(l => l.invoices);
                    const payments = tenant.leases.flatMap(l => l.payments);
                    
                    return { tenant, invoices, payments };
                }

                case 'search_units': {
                    const isGeneric = this.isGenericQuery(args.query);
                    const vectorIds = (!isGeneric && args.query) ? await this.vectorSearch('UNIT', args.query, context.companyId) : [];
                    const units = await this.prisma.unit.findMany({
                        where: {
                            deletedAt: null,
                            property: { companyId: context.companyId, deletedAt: null },
                            id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
                            ...(args.query && vectorIds.length === 0 ? {
                                OR: [
                                    { unitNumber: { contains: args.query, mode: 'insensitive' } },
                                    { semanticTags: { contains: args.query, mode: 'insensitive' } },
                                ]
                            } : {}),
                        },
                        include: { property: true },
                        take: args?.limit || 20,
                    });
                    return units;
                }

                case 'list_leases': {
                    const statusValue = validateEnum(args?.status, ALLOWED_LEASE_STATUS, 'status');
                    const leases = await this.prisma.lease.findMany({
                        where: {
                            deletedAt: null,
                            property: { companyId: context.companyId, deletedAt: null },
                            ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
                        },
                        include: { tenant: true, property: true, unit: true },
                        take: args?.limit || 20,
                    });
                    return leases;
                }

                case 'get_lease_details': {
                    const lease = await this.prisma.lease.findFirst({
                        where: {
                            id: args.leaseId,
                            deletedAt: null,
                            property: { companyId: context.companyId, deletedAt: null },
                        },
                        include: { tenant: true, property: true, unit: true, invoices: true, payments: true },
                    });
                    return lease;
                }

                case 'list_landlords': {
                    const landlords = await this.prisma.landlord.findMany({
                        where: { companyId: context.companyId, deletedAt: null },
                        take: args?.limit || 20,
                    });
                    return landlords;
                }

                case 'search_landlords': {
                    const landlords = await this.prisma.landlord.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            OR: [
                                { firstName: { contains: args.query, mode: 'insensitive' } },
                                { lastName: { contains: args.query, mode: 'insensitive' } },
                                { email: { contains: args.query, mode: 'insensitive' } },
                            ],
                        },
                        take: args?.limit || 20,
                    });
                    return landlords;
                }

                case 'list_staff': {
                    const staff = await this.prisma.user.findMany({
                        where: { companyId: context.companyId, role: UserRole.COMPANY_STAFF, isActive: true },
                        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
                        take: args?.limit || 20,
                    });
                    return staff;
                }

                case 'search_staff': {
                    const staff = await this.prisma.user.findMany({
                        where: {
                            companyId: context.companyId,
                            role: UserRole.COMPANY_STAFF,
                            isActive: true,
                            OR: [
                                { firstName: { contains: args.query, mode: 'insensitive' } },
                                { lastName: { contains: args.query, mode: 'insensitive' } },
                                { email: { contains: args.query, mode: 'insensitive' } },
                            ],
                        },
                        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
                        take: args?.limit || 20,
                    });
                    return staff;
                }

                case 'generate_execution_plan': {
                    return { success: true, data: "Execution plan generated based on your request. I will proceed with the listed steps." };
                }

                default:
                    return { error: `Read tool ${name} not implemented` };
            }
        } catch (error) {
            this.logger.error(`Error executing tool ${name}: ${error.message}`);
            return { error: error.message };
        }
    }

    private async resolveCompanyId(context: any, targetId: string | undefined, type: 'property' | 'tenant' | 'unit' | 'lease'): Promise<string> {
        if (context.companyId && context.companyId !== 'NONE') return context.companyId;
        if (!targetId) throw new BadRequestException('Company context is missing and no target ID provided.');

        let companyId: string | null = null;
        switch (type) {
            case 'property':
                const p = await this.prisma.property.findUnique({ where: { id: targetId }, select: { companyId: true } });
                companyId = p?.companyId || null;
                break;
            case 'tenant':
                const t = await this.prisma.tenant.findUnique({ where: { id: targetId }, select: { companyId: true } });
                companyId = t?.companyId || null;
                break;
            case 'unit':
                const u = await this.prisma.unit.findUnique({ where: { id: targetId }, include: { property: { select: { companyId: true } } } });
                companyId = u?.property?.companyId || null;
                break;
            case 'lease':
                const l = await this.prisma.lease.findUnique({ where: { id: targetId }, include: { property: { select: { companyId: true } } } });
                companyId = l?.property?.companyId || null;
                break;
        }

        if (!companyId) throw new BadRequestException(`Could not resolve company context from ${type} ID: ${targetId}`);
        context.companyId = companyId;
        return companyId;
    }

    private async vectorSearch(type: string, query: string, companyId?: string): Promise<string[]> {
        try {
            const results = await this.embeddings.search(query, {
                topK: 15,
                filters: {
                    type: type.toUpperCase() as any,
                    ...(companyId && companyId !== 'NONE' ? { companyId } : {})
                }
            });
            return results.map((r: any) => r.id);
        } catch (e) {
            this.logger.error(`Vector search failed for ${type}: ${e.message}`);
            return [];
        }
    }

    private isGenericQuery(query?: string): boolean {
        if (!query) return true;
        const lower = query.toLowerCase().trim();
        const genericTerms = ['all', 'list', 'show', 'everything', 'give me', 'any', 'the', 'my', 'active', 'vacant'];
        return genericTerms.some(t => lower.includes(t)) || lower.length < 3;
    }

    private getDateRange(args?: { dateFrom?: string; dateTo?: string }, defaultDays = 30) {
        const start = args?.dateFrom ? new Date(args.dateFrom) : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
        const end = args?.dateTo ? new Date(args.dateTo) : new Date();
        return { start, end };
    }
}
