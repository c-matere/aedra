import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
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

  async executeReadTool(
    name: string,
    args: any,
    context: any,
    role: UserRole,
    language: string,
  ): Promise<any> {
    try {
      switch (name) {
        case 'list_properties':
          const properties = await this.prisma.property.findMany({
            where: {
              companyId: context.companyId,
              deletedAt: null,
              ...(role === UserRole.LANDLORD
                ? { landlordId: context.userId }
                : {}),
              ...(role === UserRole.TENANT
                ? { tenants: { some: { id: context.userId } } }
                : {}),
            },
            orderBy: { updatedAt: 'desc' },
            take: this.resolveSmartLimit(args, 10, 20),
            include: { landlord: true },
          });

          // Cache for deterministic selection
          const propUid = getSessionUid(context);
          const propSessionKey = `ai_session:${propUid}`;
          const propSession: any =
            (await this.cacheManager.get(propSessionKey)) || {};
          propSession.lastResults = properties.map((p) => ({
            id: p.id,
            name: p.name,
            type: 'property',
          }));
          propSession.lastIntent = 'list_properties';
          propSession.awaitingSelection = 'property';
          await this.cacheManager.set(propSessionKey, propSession, 3600 * 1000);

          const pListKey = `list:${propUid}`;
          await this.cacheManager.set(
            pListKey,
            {
              items: propSession.lastResults,
              chatId: context.chatId,
              action: 'list_properties',
              idField: 'propertyId',
            },
            300 * 1000,
          );

          return properties;

        case 'list_companies': {
          const isSuperAdmin =
            context.isSuperAdmin ?? role === UserRole.SUPER_ADMIN;
          let whereClause = {};
          if (!isSuperAdmin) {
            whereClause = {
              OR: [
                { users: { some: { id: context.userId } } },
                { landlords: { some: { id: context.userId } } },
                { tenants: { some: { id: context.userId } } },
              ],
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
          companies = companies.filter((c) => {
            if (seenNames.has(c.name.toLowerCase())) return false;
            seenNames.add(c.name.toLowerCase());
            return true;
          });
          companies = Array.from(
            new Map(companies.map((c) => [c.id, c])).values(),
          );

          // Cache for deterministic selection
          const uid = getSessionUid(context);
          const sessionKey = `ai_session:${uid}`;
          const session: any = (await this.cacheManager.get(sessionKey)) || {};

          session.userId = session.userId || uid;
          session.lastIntent = 'list_companies';
          session.lastResults = companies.map((c) => ({
            id: c.id,
            name: c.name,
            type: 'company',
          }));
          session.awaitingSelection = 'company';
          await this.cacheManager.set(sessionKey, session, 3600 * 1000); // 1 hour

          // Also cache a short-lived selection list for direct digit replies
          const listKey = `list:${uid}`;
          await this.cacheManager.set(
            listKey,
            { items: session.lastResults, chatId: context.chatId },
            300 * 1000,
          ); // 5 minutes
          await this.menuRouter.setCompanyMenu(uid, companies);

          return formatCompanyList(companies, undefined, 1, language as any);
        }

        case 'search_companies': {
          const isSuperAdmin =
            context.isSuperAdmin ?? role === UserRole.SUPER_ADMIN;
          const terms = (args.query || '').trim().split(/\s+/).filter(Boolean);
          const andConditions = terms.map((term: string) => ({
            name: { contains: term, mode: 'insensitive' },
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
                { tenants: { some: { id: context.userId } } },
              ],
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
          companies = companies.filter((c) => {
            if (seenNamesSearch.has(c.name.toLowerCase())) return false;
            seenNamesSearch.add(c.name.toLowerCase());
            return true;
          });
          companies = Array.from(
            new Map(companies.map((c) => [c.id, c])).values(),
          );

          return formatCompanyList(companies, args.query, 1, language as any);
        }

        case 'get_portfolio_arrears': {
          const snapshot = await this.unitsService.getPortfolioSnapshot(
            context,
            args?.propertyId,
          );

          let response = '# MONTHLY COLLECTION STATUS\n\n';
          for (const [propId, data] of Object.entries(snapshot)) {
            const d = data;
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
            data: 'To import tenants from a spreadsheet (Excel/CSV), please use the Web Dashboard at https://aedra.re/dashboard/imports. \n\nYou can also upload the file here on WhatsApp, and I will extract the data for you!',
          };
        }

        case 'check_rent_status': {
          // Alias for portfolio arrears
          return await this.executeReadTool(
            'get_portfolio_arrears',
            args,
            context,
            role,
            language,
          );
        }

        case 'get_property_details':
          await this.resolveCompanyId(context, args.propertyId, 'property');
          const property = await this.prisma.property.findFirst({
            where: {
              id: args.propertyId,
              companyId: context.companyId ?? undefined,
              deletedAt: null,
              ...(role === UserRole.LANDLORD
                ? { landlordId: context.userId }
                : {}),
              ...(role === UserRole.TENANT
                ? { tenants: { some: { id: context.userId } } }
                : {}),
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
                include: { unit: true },
              },
            },
          });
          if (!tenant) return { error: 'Tenant not found.' };
          return tenant;
        }

        case 'select_company': {
          let targetId = args.companyId;

          // If ID is missing or looks like a name (not a UUID), try resolving it
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              targetId || '',
            );

          if (!isUuid && (args.companyName || targetId)) {
            const resolvedId = await this.resolveEntityName(
              'company',
              args.companyName || targetId,
              'ANY', // Companies are global/top-level
            );
            if (resolvedId) targetId = resolvedId;
          }

          if (!targetId) return { error: 'Company ID or name is required' };

          const company = await this.prisma.company.findFirst({
            where: {
              OR: [{ id: targetId }, { name: { equals: targetId, mode: 'insensitive' } }],
            },
          });

          if (!company)
            return {
              error: `Company not found with identifier: ${targetId || args.companyName}`,
            };

          if (!context.isSuperAdmin) {
            const user = await this.prisma.user.findFirst({
              where: { id: context.userId, companyId: company.id },
            });
            if (!user)
              return { error: 'You do not have access to this company.' };
          }

          const chatId = context.chatId;
          if (chatId) {
            await this.prisma.chatHistory
              .update({
                where: { id: chatId },
                data: { companyId: company.id },
              })
              .catch(() => {});
          }
          context.companyId = company.id;

          const [propCount, tenantCount] = await Promise.all([
            this.prisma.property.count({
              where: { companyId: company.id, deletedAt: null },
            }),
            this.prisma.tenant.count({
              where: { companyId: company.id, deletedAt: null },
            }),
          ]);

          return {
            success: true,
            data: `✅ Workspace set to ${company.name}\n\n${propCount} properties and ${tenantCount} tenants identified for this company.`,
            company: { id: company.id, name: company.name },
          };
        }

        case 'list_vacant_units': {
          const isGeneric = this.isGenericQuery(args.query);
          const vectorIds =
            !isGeneric && args.query
              ? await this.vectorSearch('UNIT', args.query, context.companyId)
              : [];
          const vacantUnits = await this.prisma.unit.findMany({
            where: {
              status: 'VACANT',
              deletedAt: null,
              property: { deletedAt: null, companyId: context.companyId },
              id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
              ...(args.query && vectorIds.length === 0
                ? {
                    OR: [
                      {
                        unitNumber: {
                          contains: args.query,
                          mode: 'insensitive',
                        },
                      },
                      {
                        semanticTags: {
                          contains: args.query,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: { property: { select: { name: true, address: true } } },
            take: args?.limit || 20,
          });

          // Cache for deterministic selection
          const unitUid = getSessionUid(context);
          const unitSessionKey = `ai_session:${unitUid}`;
          const unitSession: any =
            (await this.cacheManager.get(unitSessionKey)) || {};
          unitSession.lastResults = vacantUnits.map((u) => ({
            id: u.id,
            name: u.unitNumber,
            type: 'unit',
          }));
          unitSession.lastIntent = 'list_units';
          unitSession.awaitingSelection = 'unit';
          await this.cacheManager.set(unitSessionKey, unitSession, 3600 * 1000);

          const uListKey = `list:${unitUid}`;
          await this.cacheManager.set(
            uListKey,
            {
              items: unitSession.lastResults,
              chatId: context.chatId,
              action: 'list_units',
              idField: 'unitId',
            },
            300 * 1000,
          );

          return vacantUnits;
        }

        case 'search_properties': {
          const isGeneric = this.isGenericQuery(args.query);
          const vectorIds =
            !isGeneric && args.query
              ? await this.vectorSearch(
                  'PROPERTY',
                  args.query,
                  context.companyId,
                )
              : [];
          const foundProperties = await this.prisma.property.findMany({
            where: {
              id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
              companyId: context.companyId,
              deletedAt: null,
              ...(vectorIds.length === 0
                ? {
                    OR: [
                      { name: { contains: args.query, mode: 'insensitive' } },
                      {
                        address: { contains: args.query, mode: 'insensitive' },
                      },
                    ],
                  }
                : {}),
            },
            include: { landlord: true },
            take: args?.limit || 20,
          });
          return foundProperties;
        }

        case 'list_units': {
          const statusValue = validateEnum(
            args?.status,
            ALLOWED_UNIT_STATUS,
            'status',
          );
          if (statusValue && typeof statusValue === 'object')
            return statusValue;
          const units = await this.prisma.unit.findMany({
            where: {
              deletedAt: null,
              property: {
                companyId: context.companyId,
                deletedAt: null,
                ...(args?.propertyId ? { id: args.propertyId } : {}),
              },
              ...(typeof statusValue === 'string'
                ? { status: statusValue }
                : {}),
            } as any,
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
          // Resolve name → ID if user passed a name instead of UUID
          let resolvedPropertyId = args?.propertyId;
          if (!resolvedPropertyId && args?.propertyName) {
            resolvedPropertyId = await this.resolveEntityName(
              'property', args.propertyName, context.companyId,
            );
          }
          let resolvedTenantId = args?.tenantId;
          if (!resolvedTenantId && args?.tenantName) {
            resolvedTenantId = await this.resolveEntityName(
              'tenant', args.tenantName, context.companyId,
            );
          }

          // If tenantId resolved, just return that specific tenant
          if (resolvedTenantId) {
            const t = await this.prisma.tenant.findFirst({
              where: { id: resolvedTenantId, companyId: context.companyId, deletedAt: null },
              include: { property: { select: { name: true, id: true } } },
            });
            return t ? [t] : [];
          }

          // --- Filter gate: require a filter for a company with many tenants ---
          const tenantCount = await this.prisma.tenant.count({
            where: { companyId: context.companyId, deletedAt: null },
          });
          if (!resolvedPropertyId && !args?.query && tenantCount > 20) {
            return {
              _needs_filter: true,
              message: `There are ${tenantCount} tenants. Please tell me the property name, tenant name, or any filter to narrow results.`,
              hint: 'Example: "list tenants in Block A" or "show me John\'s details"',
              total: tenantCount,
            };
          }

          const tenants = await this.prisma.tenant.findMany({
            where: {
              companyId: context.companyId,
              deletedAt: null,
              ...(resolvedPropertyId ? { propertyId: resolvedPropertyId } : {}),
            },
            include: { property: { select: { name: true, id: true } } },
            take: this.resolveSmartLimit(args, 10, 25),
          });

          // Cache for deterministic selection
          const tenantUid = getSessionUid(context);
          const tenantSessionKey = `ai_session:${tenantUid}`;
          const tenantSession: any =
            (await this.cacheManager.get(tenantSessionKey)) || {};
          tenantSession.lastResults = tenants.map((t) => ({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`,
            type: 'tenant',
          }));
          tenantSession.lastIntent = 'list_tenants';
          tenantSession.awaitingSelection = 'tenant';
          await this.cacheManager.set(
            tenantSessionKey,
            tenantSession,
            3600 * 1000,
          );

          const tListKey = `list:${tenantUid}`;
          await this.cacheManager.set(
            tListKey,
            {
              items: tenantSession.lastResults,
              chatId: context.chatId,
              action: 'list_tenants',
              idField: 'tenantId',
            },
            300 * 1000,
          );

          return tenants;
        }

        case 'search_tenants': {
          const isGeneric = this.isGenericQuery(args.query);
          const vectorIds =
            !isGeneric && args.query
              ? await this.vectorSearch('TENANT', args.query, context.companyId)
              : [];
          const foundTenants = await this.prisma.tenant.findMany({
            where: {
              id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
              companyId: context.companyId,
              deletedAt: null,
              ...(vectorIds.length === 0
                ? {
                    OR: [
                      {
                        firstName: {
                          contains: args.query,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastName: { contains: args.query, mode: 'insensitive' },
                      },
                    ],
                  }
                : {}),
            },
            include: { property: true },
            take: args?.limit || 20,
          });

          // Cache for deterministic selection
          const sTenantUid = getSessionUid(context);
          const sTenantSessionKey = `ai_session:${sTenantUid}`;
          const sTenantSession: any =
            (await this.cacheManager.get(sTenantSessionKey)) || {};
          sTenantSession.lastResults = foundTenants.map((t) => ({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`,
            type: 'tenant',
          }));
          sTenantSession.lastIntent = 'list_tenants';
          await this.cacheManager.set(
            sTenantSessionKey,
            sTenantSession,
            3600 * 1000,
          );

          return foundTenants;
        }

        case 'get_company_summary': {
          if (!context.companyId || context.companyId === 'NONE')
            return { error: 'Please select a company workspace first.' };
          const { start, end } = this.getDateRange(args);
          const [props, units, tenants, company] = await Promise.all([
            this.prisma.property.count({
              where: { companyId: context.companyId, deletedAt: null },
            }),
            this.prisma.unit.count({
              where: { property: { companyId: context.companyId } },
            }),
            this.prisma.tenant.count({
              where: { companyId: context.companyId },
            }),
            this.prisma.company.findUnique({
              where: { id: context.companyId },
            }),
          ]);
          return {
            companyName: company?.name,
            dateRange: { from: start.toISOString(), to: end.toISOString() },
            properties: props,
            units: { total: units, occupied: 0, vacant: units }, // Simplification
            tenants: tenants,
            activeLeases: 0,
            totals: {
              payments: 0,
              expenses: 0,
              invoices: 0,
              overdueInvoices: 0,
            },
          };
        }

        case 'list_maintenance_requests': {
          const statusValue = validateEnum(
            args?.status,
            ALLOWED_MAINTENANCE_STATUS,
            'status',
          );
          const requests = await this.prisma.maintenanceRequest.findMany({
            where: {
              companyId: context.companyId,
              deletedAt: null,
              ...(typeof statusValue === 'string'
                ? { status: statusValue }
                : {}),
            } as any,
            include: { property: true, unit: true, assignedTo: true },
            take: args?.limit || 20,
          });
          return requests;
        }

        case 'list_payments': {
          // Resolve names → IDs
          let payTenantId = args?.tenantId;
          if (!payTenantId && args?.tenantName) {
            payTenantId = await this.resolveEntityName('tenant', args.tenantName, context.companyId);
          }
          let payPropertyId = args?.propertyId;
          if (!payPropertyId && args?.propertyName) {
            payPropertyId = await this.resolveEntityName('property', args.propertyName, context.companyId);
          }

          // Filter gate: require at least one meaningful filter
          if (!args?.leaseId && !payTenantId && !payPropertyId && !args?.dateFrom) {
            return {
              _needs_filter: true,
              message: 'To retrieve payments, please provide a tenant name, property name, or date range.',
              hint: 'Example: "show payments for John" or "payments this month"',
            };
          }
          const { start: pStart, end: pEnd } = this.getDateRange(args, 31);
          const payments = await this.prisma.payment.findMany({
            where: {
              lease: { property: { companyId: context.companyId } },
              deletedAt: null,
              ...(args?.leaseId ? { leaseId: args.leaseId } : {}),
              ...(payTenantId ? { lease: { tenantId: payTenantId } } : {}),
              ...(payPropertyId ? { lease: { property: { id: payPropertyId } } } : {}),
              ...(args?.dateFrom || args?.dateTo ? { paidAt: { gte: pStart, lte: pEnd } } : {}),
            },
            include: { lease: { include: { tenant: { select: { firstName: true, lastName: true } }, property: { select: { name: true } } } } },
            take: this.resolveSmartLimit(args, 10, 25),
            orderBy: { paidAt: 'desc' },
          });
          return payments;
        }

        case 'list_invoices': {
          // Resolve names → IDs
          let invTenantId = args?.tenantId;
          if (!invTenantId && args?.tenantName) {
            invTenantId = await this.resolveEntityName('tenant', args.tenantName, context.companyId);
          }
          let invPropertyId = args?.propertyId;
          if (!invPropertyId && args?.propertyName) {
            invPropertyId = await this.resolveEntityName('property', args.propertyName, context.companyId);
          }

          if (!args?.leaseId && !invTenantId && !invPropertyId && !args?.status) {
            return {
              _needs_filter: true,
              message: 'To retrieve invoices, please provide a tenant name, property name, or status (PENDING/PAID/OVERDUE).',
              hint: 'Example: "show pending invoices" or "invoices for John"',
            };
          }
          const invoices = await this.prisma.invoice.findMany({
            where: {
              lease: { property: { companyId: context.companyId } },
              deletedAt: null,
              ...(args?.leaseId ? { leaseId: args.leaseId } : {}),
              ...(invTenantId ? { lease: { tenantId: invTenantId } } : {}),
              ...(invPropertyId ? { lease: { property: { id: invPropertyId } } } : {}),
              ...(args?.status ? { status: args.status } : {}),
            },
            include: { lease: { include: { tenant: { select: { firstName: true, lastName: true } }, property: { select: { name: true } } } } },
            take: this.resolveSmartLimit(args, 10, 25),
            orderBy: { createdAt: 'desc' },
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
          const invoices = tenant.leases.flatMap((l) => l.invoices);
          const payments = tenant.leases.flatMap((l) => l.payments);

          return { tenant, invoices, payments };
        }

        case 'search_units': {
          const isGeneric = this.isGenericQuery(args.query);
          const vectorIds =
            !isGeneric && args.query
              ? await this.vectorSearch('UNIT', args.query, context.companyId)
              : [];
          const units = await this.prisma.unit.findMany({
            where: {
              deletedAt: null,
              property: { companyId: context.companyId, deletedAt: null },
              id: vectorIds.length > 0 ? { in: vectorIds } : undefined,
              ...(args.query && vectorIds.length === 0
                ? {
                    OR: [
                      {
                        unitNumber: {
                          contains: args.query,
                          mode: 'insensitive',
                        },
                      },
                      {
                        semanticTags: {
                          contains: args.query,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: { property: true },
            take: args?.limit || 20,
          });
          return units;
        }

        case 'list_leases': {
          const statusValue = validateEnum(
            args?.status,
            ALLOWED_LEASE_STATUS,
            'status',
          );
          if (statusValue && typeof statusValue === 'object') return statusValue;

          // Resolve names → IDs
          let leaseTenantId = args?.tenantId;
          if (!leaseTenantId && args?.tenantName) {
            leaseTenantId = await this.resolveEntityName('tenant', args.tenantName, context.companyId);
          }
          let leasePropertyId = args?.propertyId;
          if (!leasePropertyId && args?.propertyName) {
            leasePropertyId = await this.resolveEntityName('property', args.propertyName, context.companyId);
          }

          const leases = await this.prisma.lease.findMany({
            where: {
              deletedAt: null,
              property: { companyId: context.companyId, deletedAt: null },
              ...(leaseTenantId ? { tenantId: leaseTenantId } : {}),
              ...(leasePropertyId ? { propertyId: leasePropertyId } : {}),
              ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
            } as any,
            include: { tenant: { select: { firstName: true, lastName: true } }, property: { select: { name: true } }, unit: { select: { unitNumber: true } } },
            take: this.resolveSmartLimit(args, 10, 25),
            orderBy: { createdAt: 'desc' },
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
            include: {
              tenant: true,
              property: true,
              unit: true,
              invoices: true,
              payments: true,
            },
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
            where: {
              companyId: context.companyId,
              role: UserRole.COMPANY_STAFF,
              isActive: true,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
            },
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
            },
            take: args?.limit || 20,
          });
          return staff;
        }

        case 'detect_duplicates': {
          if (!context.companyId || context.companyId === 'NONE') {
            throw new BadRequestException(
              'Please select a company workspace first.',
            );
          }
          const allTenants = await this.prisma.tenant.findMany({
            where: { companyId: context.companyId, deletedAt: null },
            include: {
              property: { select: { name: true } },
              leases: {
                where: { deletedAt: null },
                include: { payments: { take: 1, orderBy: { paidAt: 'desc' } } },
              },
            },
          });

          const normalize = (s: string | null | undefined) =>
            (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const groups = new Map<string, any[]>();

          for (const tenant of allTenants) {
            const keys = [
              `name:${normalize(tenant.firstName)}${normalize(tenant.lastName)}`,
              tenant.email ? `email:${tenant.email.toLowerCase()}` : null,
              tenant.phone ? `phone:${tenant.phone.replace(/\D/g, '')}` : null,
            ].filter(Boolean) as string[];

            for (const key of keys) {
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(tenant);
            }
          }

          const duplicateGroups: any[] = [];
          const seenTenantIds = new Set<string>();

          for (const [key, members] of groups.entries()) {
            if (members.length > 1) {
              // Deduplicate members if they hit multiple keys (e.g. same name AND same email)
              const uniqueMembers = members.filter((m) => {
                if (seenTenantIds.has(m.id)) return false;
                return true;
              });

              if (uniqueMembers.length > 1) {
                uniqueMembers.forEach((m) => seenTenantIds.add(m.id));

                // Determine recommended keep (newest activity)
                const sorted = [...uniqueMembers].sort((a, b) => {
                  const aLast = a.leases[0]?.payments[0]?.paidAt || a.updatedAt;
                  const bLast = b.leases[0]?.payments[0]?.paidAt || b.updatedAt;
                  return bLast.getTime() - aLast.getTime();
                });

                duplicateGroups.push({
                  key,
                  tenants: sorted.map((t) => ({
                    id: t.id,
                    name: `${t.firstName} ${t.lastName}`,
                    email: t.email,
                    phone: t.phone,
                    property: t.property?.name,
                    leaseCount: t.leases.length,
                    paymentCount: t.leases.reduce(
                      (sum: number, l: any) => sum + (l.payments?.length || 0),
                      0,
                    ),
                    lastActivity:
                      t.leases[0]?.payments[0]?.paidAt || t.updatedAt,
                  })),
                  recommendation: {
                    keep: sorted[0].id,
                    archive: sorted.slice(1).map((t) => t.id),
                  },
                });
              }
            }
          }

          return {
            success: true,
            count: duplicateGroups.length,
            groups: duplicateGroups,
            message:
              duplicateGroups.length > 0
                ? `Found ${duplicateGroups.length} potential duplicate groups.`
                : 'No duplicates detected.',
          };
        }

        case 'generate_execution_plan': {
          return {
            success: true,
            data: 'Execution plan generated based on your request. I will proceed with the listed steps.',
          };
        }

        default:
          return { error: `Read tool ${name} not implemented` };
      }
    } catch (error) {
      this.logger.error(`Error executing tool ${name}: ${error.message}`);
      return { error: error.message };
    }
  }

  private async resolveCompanyId(
    context: any,
    targetId: string | undefined,
    type: 'property' | 'tenant' | 'unit' | 'lease',
  ): Promise<string> {
    if (context.companyId && context.companyId !== 'NONE')
      return context.companyId;
    if (!targetId)
      throw new BadRequestException(
        'Company context is missing and no target ID provided.',
      );

    let companyId: string | null = null;
    switch (type) {
      case 'property':
        const p = await this.prisma.property.findUnique({
          where: { id: targetId },
          select: { companyId: true },
        });
        companyId = p?.companyId || null;
        break;
      case 'tenant':
        const t = await this.prisma.tenant.findUnique({
          where: { id: targetId },
          select: { companyId: true },
        });
        companyId = t?.companyId || null;
        break;
      case 'unit':
        const u = await this.prisma.unit.findUnique({
          where: { id: targetId },
          include: { property: { select: { companyId: true } } },
        });
        companyId = u?.property?.companyId || null;
        break;
      case 'lease':
        const l = await this.prisma.lease.findUnique({
          where: { id: targetId },
          include: { property: { select: { companyId: true } } },
        });
        companyId = l?.property?.companyId || null;
        break;
    }

    if (!companyId)
      throw new BadRequestException(
        `Could not resolve company context from ${type} ID: ${targetId}`,
      );
    context.companyId = companyId;
    return companyId;
  }

  private async vectorSearch(
    type: string,
    query: string,
    companyId?: string,
  ): Promise<string[]> {
    try {
      const results = await this.embeddings.search(query, {
        topK: 15,
        filters: {
          type: type.toUpperCase() as any,
          ...(companyId && companyId !== 'NONE' ? { companyId } : {}),
        },
      });
      return results.map((r: any) => r.id);
    } catch (e) {
      this.logger.error(`Vector search failed for ${type}: ${e.message}`);
      return [];
    }
  }

  /**
   * Resolve a human-readable name to a database ID.
   * Tries exact match first, then case-insensitive fuzzy match.
   * Returns null if nothing found — caller should handle gracefully.
   */
  private async resolveEntityName(
    entity: 'tenant' | 'property' | 'unit' | 'company',
    name: string,
    companyId: string,
  ): Promise<string | null> {
    if (!name?.trim()) return null;
    const q = name.trim();

    if (entity === 'tenant') {
      const parts = q.split(/\s+/);
      const first = parts[0];
      const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
      const orConditions: { firstName?: any; lastName?: any }[] = [
        { firstName: { contains: first, mode: 'insensitive' as const } },
        { lastName: { contains: first, mode: 'insensitive' as const } },
      ];
      if (last) {
        orConditions.push({ firstName: { contains: last, mode: 'insensitive' as const } });
        orConditions.push({ lastName: { contains: last, mode: 'insensitive' as const } });
      }
      const match = await this.prisma.tenant.findFirst({
        where: { companyId, deletedAt: null, OR: orConditions },
        select: { id: true },
      });
      return match?.id ?? null;
    }

    if (entity === 'property') {
      const match = await this.prisma.property.findFirst({
        where: {
          companyId,
          deletedAt: null,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true },
      });
      return match?.id ?? null;
    }

    if (entity === 'unit') {
      const match = await this.prisma.unit.findFirst({
        where: {
          deletedAt: null,
          property: { companyId, deletedAt: null },
          OR: [
            { unitNumber: { contains: q, mode: 'insensitive' } },
            { semanticTags: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      return match?.id ?? null;
    }

    if (entity === 'company') {
      const match = await this.prisma.company.findFirst({
        where: {
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true },
      });
      return match?.id ?? null;
    }

    return null;
  }

  /**
   * Resolves the result limit for list queries.
   * Default is conservative (10), hard cap prevents token blowup.
   * @param args - tool args from the AI
   * @param defaultLimit - sensible default if no limit provided
   * @param hardCap - maximum rows ever returned, regardless of what the AI asks for  
   */
  private resolveSmartLimit(
    args: any,
    defaultLimit = 10,
    hardCap = 25,
  ): number {
    const requested = Number(args?.limit);
    if (!isNaN(requested) && requested > 0) {
      return Math.min(requested, hardCap);
    }
    return defaultLimit;
  }

  private isGenericQuery(query?: string): boolean {
    if (!query) return true;
    const lower = query.toLowerCase().trim();
    const genericTerms = [
      'all',
      'list',
      'show',
      'everything',
      'give me',
      'any',
      'the',
      'my',
      'active',
      'vacant',
    ];
    return genericTerms.some((t) => lower.includes(t)) || lower.length < 3;
  }

  private getDateRange(
    args?: { dateFrom?: string; dateTo?: string },
    defaultDays = 30,
  ) {
    const start = args?.dateFrom
      ? new Date(args.dateFrom)
      : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
    const end = args?.dateTo ? new Date(args.dateTo) : new Date();
    return { start, end };
  }
}
