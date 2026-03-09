import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PrismaClient, UserRole, User, WorkflowType, WorkflowStatus } from "@prisma/client";
import { z } from "zod";
import "dotenv/config";
import crypto from "crypto";

const prisma = new PrismaClient();

// --- Security & Guardrails Service ---

class SecurityService {
  private static pendingConfirmations = new Map<string, { action: string; data: any; companyId?: string; expiry: number }>();

  static generateToken(action: string, data: any, companyId?: string): string {
    const token = crypto.randomBytes(16).toString("hex");
    this.pendingConfirmations.set(token, {
      action,
      data,
      companyId,
      expiry: Date.now() + 1000 * 60 * 10, // 10 min
    });
    return token;
  }

  static validateToken(token: string, expectedAction: string, currentCompanyId?: string): any {
    const entry = this.pendingConfirmations.get(token);
    if (!entry) throw new Error("Invalid or expired confirmation token.");
    if (entry.action !== expectedAction) throw new Error("Token mismatch.");
    if (entry.companyId && currentCompanyId && entry.companyId !== currentCompanyId) {
      throw new Error("Unauthorized: Confirmation attempted from incorrect company context.");
    }
    this.pendingConfirmations.delete(token);
    return entry.data;
  }

  static async authorize(actorId: string, roles: UserRole[], action: string, permission?: string): Promise<User> {
    const u = await prisma.user.findUnique({ where: { id: actorId } });
    if (!u || !u.isActive || u.deletedAt) throw new Error("Unauthorized: No active session.");
    if (!roles.includes(u.role)) {
      await this.logAudit(u, action, "DENIED", `Role ${u.role} lack permissions.`);
      throw new Error(`Access Denied: ${action} requires ${roles.join(" or ")}.`);
    }
    if (permission && !u.permissions.includes(permission)) {
      await this.logAudit(u, action, "DENIED", `Missing permission: ${permission}`);
      throw new Error(`Access Denied: Missing '${permission}' capability.`);
    }
    return u;
  }

  static async logAudit(user: User, action: string, outcome: string, metadata?: any, targetId?: string) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          outcome,
          actorId: user.id,
          actorRole: user.role,
          actorCompanyId: user.companyId,
          targetId,
          method: "MCP_COWORKER",
          path: `/mcp/${action}`,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
          timestamp: new Date(),
        },
      });
    } catch (e) {
      console.error("Audit log failed", e);
    }
  }

  static getScope(u: User): any {
    return u.role === "SUPER_ADMIN" ? {} : { companyId: u.companyId || "UNKNOWN" };
  }
}

const server = new McpServer({
  name: "aedra-ai-pro",
  version: "3.0.0",
});

/**
 * IDENTITY
 */
server.tool("whoami", "Identify your session.", { email: z.string().email() }, async ({ email }) => {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return { content: [{ type: "text", text: "User not found." }], isError: true };
  return { content: [{ type: "text", text: `ID: ${u.id}\nRole: ${u.role}\nCompany: ${u.companyId || "System"}` }] };
});

/**
 * 🤖 WORKFLOW & STATE MACHINE TOOLS
 */

const WORKFLOW_REGISTRY: Record<string, { name: string, description: string, transitions: { from: WorkflowStatus, to: WorkflowStatus, action: string }[] }> = {
  [WorkflowType.RENT_COLLECTION]: {
    name: "Rent Collection",
    description: "Manage late rent from initial reminder to legal action.",
    transitions: [
      { from: WorkflowStatus.PENDING, to: WorkflowStatus.ACTIVE, action: "Start Workflow" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.AWAITING_INPUT, action: "Send Initial Reminder" },
      { from: WorkflowStatus.AWAITING_INPUT, to: WorkflowStatus.AWAITING_CONFIRMATION, action: "Issue Penalty Proposal" },
      { from: WorkflowStatus.AWAITING_CONFIRMATION, to: WorkflowStatus.ACTIVE, action: "Penalty Issued" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.COMPLETED, action: "Payment Received" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.FAILED, action: "No Payment - Escalate to Legal" },
    ]
  },
  [WorkflowType.MAINTENANCE_LIFECYCLE]: {
    name: "Maintenance Lifecycle",
    description: "Track maintenance from reporting to resolution.",
    transitions: [
      { from: WorkflowStatus.PENDING, to: WorkflowStatus.ACTIVE, action: "Acknowledge Request" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.AWAITING_INPUT, action: "Assign Contractor" },
      { from: WorkflowStatus.AWAITING_INPUT, to: WorkflowStatus.ACTIVE, action: "Contractor Confirmed" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.COMPLETED, action: "Work Verified & Finished" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.CANCELLED, action: "Request Cancelled" },
    ]
  },
  [WorkflowType.TENANT_ONBOARDING]: {
    name: "Tenant Onboarding",
    description: "Full funnel from application to move-in.",
    transitions: [
      { from: WorkflowStatus.PENDING, to: WorkflowStatus.ACTIVE, action: "Application Approved" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.AWAITING_INPUT, action: "Lease Draft Sent" },
      { from: WorkflowStatus.AWAITING_INPUT, to: WorkflowStatus.AWAITING_CONFIRMATION, action: "Signature Received" },
      { from: WorkflowStatus.AWAITING_CONFIRMATION, to: WorkflowStatus.ACTIVE, action: "Payment Verified" },
      { from: WorkflowStatus.ACTIVE, to: WorkflowStatus.COMPLETED, action: "Keys Handed Over" },
    ]
  }
};

server.tool(
  "workflow_list_types",
  "List all available workflow types and their descriptions.",
  { actorId: z.string() },
  async ({ actorId }) => {
    try {
      await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "list_workflow_types");
      return { content: [{ type: "text", text: JSON.stringify(WORKFLOW_REGISTRY, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

server.tool(
  "workflow_initiate",
  "Start a new stateful process (e.g. Rent Collection, Onboarding).",
  {
    actorId: z.string(),
    type: z.nativeEnum(WorkflowType),
    targetId: z.string().optional().describe("ID of the entity this workflow is for (e.g. LeaseID)"),
    metadata: z.any().optional(),
  },
  async ({ actorId, type, targetId, metadata }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "workflow_initiate");
      const workflow = await prisma.workflowInstance.create({
        data: {
          type,
          status: WorkflowStatus.PENDING,
          companyId: u.companyId || "",
          targetId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        }
      });
      await SecurityService.logAudit(u, "workflow_initiate", "SUCCESS", { workflowId: workflow.id });
      return { content: [{ type: "text", text: `Workflow initiated: ${workflow.id} (${type})\nStatus: PENDING` }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

server.tool(
  "workflow_submit_event",
  "Record an event and advance the state machine. Transitions are validated against the SOP.",
  {
    actorId: z.string(),
    workflowId: z.string(),
    action: z.string().describe("The action taken from the SOP (e.g. 'Send Initial Reminder')"),
    toStatus: z.nativeEnum(WorkflowStatus),
    metadata: z.any().optional(),
  },
  async ({ actorId, workflowId, action, toStatus, metadata }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "workflow_submit_event");
      const workflow = await prisma.workflowInstance.findFirst({
        where: { id: workflowId, ...SecurityService.getScope(u) }
      });
      if (!workflow) throw new Error("Workflow not found or access restricted.");

      const fromStatus = workflow.status;

      // Validate Transition against Registry
      const config = (WORKFLOW_REGISTRY as any)[workflow.type];
      if (config) {
        const isValid = config.transitions.some((t: any) => t.from === fromStatus && t.to === toStatus && t.action === action);
        if (!isValid) {
          throw new Error(`Invalid Transition: Cannot move from ${fromStatus} to ${toStatus} via '${action}' in ${workflow.type} workflow.`);
        }
      }

      await prisma.$transaction([
        prisma.workflowInstance.update({
          where: { id: workflowId },
          data: { status: toStatus }
        }),
        prisma.workflowStep.create({
          data: {
            workflowInstanceId: workflowId,
            action,
            fromStatus,
            toStatus,
            actorId: u.id,
            metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
          }
        })
      ]);

      await SecurityService.logAudit(u, "workflow_submit_event", "SUCCESS", { workflowId, fromStatus, toStatus, action });
      return { content: [{ type: "text", text: `Workflow ${workflowId} advanced: ${fromStatus} -> ${toStatus} [${action}]` }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

server.tool(
  "workflow_get_state",
  "Check the current status and history of a workflow.",
  {
    actorId: z.string(),
    workflowId: z.string(),
  },
  async ({ actorId, workflowId }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "workflow_get_state");
      const workflow = await prisma.workflowInstance.findFirst({
        where: { id: workflowId, ...SecurityService.getScope(u) },
        include: { steps: { orderBy: { timestamp: "desc" } } }
      });
      if (!workflow) throw new Error("Workflow not found or access restricted.");
      return { content: [{ type: "text", text: JSON.stringify(workflow, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

server.tool(
  "list_active_workflows",
  "Show running workflows for the company.",
  {
    actorId: z.string(),
    type: z.nativeEnum(WorkflowType).optional(),
  },
  async ({ actorId, type }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "list_workflows");
      const workflows = await prisma.workflowInstance.findMany({
        where: {
          ...SecurityService.getScope(u),
          status: { notIn: [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED] },
          type: type || undefined,
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" }
      });
      return { content: [{ type: "text", text: JSON.stringify(workflows, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

/**
 * ASSET SIGHT (SCOPED)
 */
server.tool("system_summary", "View system metrics. Scoped.", { actorId: z.string() }, async ({ actorId }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "system_summary", "CAN_VIEW_REPORTS");
    const scope = SecurityService.getScope(u);
    const [p, uCount, al] = await Promise.all([
      prisma.property.count({ where: { ...scope, deletedAt: null } }),
      prisma.unit.count({ where: { property: scope, deletedAt: null } }),
      prisma.lease.count({ where: { property: scope, status: "ACTIVE", deletedAt: null } }),
    ]);
    return { content: [{ type: "text", text: JSON.stringify({ properties: p, units: uCount, occupancy: `${((al / uCount) * 100).toFixed(1)}%` }, null, 2) }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

server.tool("list_properties", "List all accessible properties.", { actorId: z.string() }, async ({ actorId }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "list_properties");
    const p = await prisma.property.findMany({ where: { ...SecurityService.getScope(u), deletedAt: null } });
    return { content: [{ type: "text", text: JSON.stringify(p, null, 2) }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

server.tool("get_property_details", "Deep property analysis including units.", { actorId: z.string(), propertyId: z.string() }, async ({ actorId, propertyId }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "get_property_details");
    const p = await prisma.property.findFirst({ where: { id: propertyId, ...SecurityService.getScope(u), deletedAt: null }, include: { units: true, landlord: true } });
    if (!p) throw new Error("Property not found or restricted.");
    return { content: [{ type: "text", text: JSON.stringify(p, null, 2) }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

server.tool("list_vacant_units", "Inventory check for vacancy.", { actorId: z.string(), propertyId: z.string().optional() }, async ({ actorId, propertyId }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "list_vacant");
    const units = await prisma.unit.findMany({
      where: {
        status: "VACANT",
        deletedAt: null,
        propertyId: propertyId || undefined,
        property: SecurityService.getScope(u)
      }
    });
    return { content: [{ type: "text", text: JSON.stringify(units, null, 2) }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

/**
 * CRM & LEASING (SCOPED + PERMISSION)
 */
server.tool("search_tenants", "Search tenants by name.", { actorId: z.string(), query: z.string() }, async ({ actorId, query }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "search_tenants");
    const t = await prisma.tenant.findMany({
      where: { ...SecurityService.getScope(u), deletedAt: null, OR: [{ firstName: { contains: query } }, { lastName: { contains: query } }] }
    });
    return { content: [{ type: "text", text: JSON.stringify(t, null, 2) }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

server.tool("onboard_tenant", "Add new tenant.", { actorId: z.string(), firstName: z.string(), lastName: z.string(), propertyId: z.string() }, async ({ actorId, ...data }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "onboard_tenant", "CAN_MANAGE_TENANTS");
    const p = await prisma.property.findFirst({ where: { id: data.propertyId, ...SecurityService.getScope(u) } });
    if (!p) throw new Error("Restricted Property ID.");
    const t = await prisma.tenant.create({ data: { ...data, companyId: u.companyId || "" } });
    await SecurityService.logAudit(u, "onboard_tenant", "SUCCESS", { id: t.id });
    return { content: [{ type: "text", text: `Onboarded ${t.id}` }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

server.tool("create_lease", "Create rental agreement.", { actorId: z.string(), tenantId: z.string(), unitId: z.string(), rent: z.number() }, async ({ actorId, tenantId, unitId, rent }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "create_lease", "CAN_MANAGE_LEASES");
    const scope = SecurityService.getScope(u);
    const [t, unit] = await Promise.all([
      prisma.tenant.findFirst({ where: { id: tenantId, ...scope } }),
      prisma.unit.findFirst({ where: { id: unitId, property: scope } })
    ]);
    if (!t || !unit) throw new Error("Restricted context: Tenant/Unit unavailable.");
    const l = await prisma.lease.create({
      data: { tenantId, unitId, propertyId: unit.propertyId, rentAmount: rent, startDate: new Date(), endDate: new Date(), status: "PENDING" }
    });
    return { content: [{ type: "text", text: `Lease created: ${l.id}` }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

/**
 * MAINTENANCE (SCOPED + ASSIGNMENT)
 */
server.tool("assign_maintenance", "Dispatch work order.", { actorId: z.string(), requestId: z.string(), staffId: z.string() }, async ({ actorId, requestId, staffId }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "assign_maintenance", "CAN_MANAGE_MAINTENANCE");
    const [req, staff] = await Promise.all([
      prisma.maintenanceRequest.findFirst({ where: { id: requestId, ...SecurityService.getScope(u) } }),
      prisma.user.findFirst({ where: { id: staffId, companyId: u.companyId } })
    ]);
    if (!req || !staff) throw new Error("Unauthorized staff or request.");
    await prisma.maintenanceRequest.update({ where: { id: requestId }, data: { assignedToId: staffId, status: "ACKNOWLEDGED" } });
    return { content: [{ type: "text", text: "Assigned." }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

/**
 * SENSITIVE (GUARDRAILED)
 */
server.tool("issue_penalty", "Charge fine. Human confirmed.", { actorId: z.string(), leaseId: z.string(), amount: z.number(), token: z.string().optional() }, async ({ actorId, leaseId, amount, token }) => {
  try {
    const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "issue_penalty", "CAN_MANAGE_FINANCE");
    if (!token) {
      const l = await prisma.lease.findFirst({ where: { id: leaseId, property: SecurityService.getScope(u) } });
      if (!l) throw new Error("Lease restricted.");
      const t = SecurityService.generateToken("issue_penalty", { leaseId, amount }, u.companyId || undefined);
      return { content: [{ type: "text", text: `CONFIRM: Charge ${amount} KES. Use token: ${t}` }] };
    }
    const data = SecurityService.validateToken(token, "issue_penalty", u.companyId || undefined);
    const pen = await prisma.penalty.create({ data: { ...data, status: "PENDING", type: "LATE_PAYMENT" } });
    await SecurityService.logAudit(u, "issue_penalty", "SUCCESS", { id: pen.id });
    return { content: [{ type: "text", text: "Issued." }] };
  } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
});

/**
 * 💰 PAYMENTS (ADMIN + PERMISSION)
 */
server.tool(
  "record_payment",
  "Log rent or other payment received for a lease.",
  {
    actorId: z.string(),
    leaseId: z.string(),
    amount: z.number(),
    method: z.enum(["MPESA", "BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"]).default("MPESA"),
    type: z.enum(["RENT", "DEPOSIT", "PENALTY", "UTILITY", "OTHER"]).default("RENT"),
    reference: z.string().optional().describe("M-PESA code or bank ref"),
  },
  async ({ actorId, leaseId, amount, method, type, reference }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "record_payment", "CAN_MANAGE_FINANCE");
      // Scope check: only allow payments on leases tied to company's properties
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, property: SecurityService.getScope(u) }
      });
      if (!lease) throw new Error("Lease not found or access restricted.");
      const pay = await prisma.payment.create({ data: { leaseId, amount, method, type, reference, paidAt: new Date() } });
      await SecurityService.logAudit(u, "record_payment", "SUCCESS", { paymentId: pay.id }, leaseId);
      return { content: [{ type: "text", text: `Payment ${pay.id} recorded (${amount} via ${method}).` }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

/**
 * 🧾 INVOICING (SCOPED)
 */
server.tool(
  "list_invoices",
  "Browse invoices. Scoped to the operator's company.",
  {
    actorId: z.string(),
    status: z.string().optional().describe("PENDING, PAID, OVERDUE"),
    leaseId: z.string().optional(),
  },
  async ({ actorId, status, leaseId }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "list_invoices", "CAN_VIEW_REPORTS");
      const scope = SecurityService.getScope(u);
      const invoices = await prisma.invoice.findMany({
        where: {
          deletedAt: null,
          status: status || undefined,
          leaseId: leaseId || undefined,
          lease: { property: scope }
        },
        orderBy: { dueDate: "desc" },
        take: 100
      });
      return { content: [{ type: "text", text: JSON.stringify(invoices, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

server.tool(
  "generate_invoice",
  "Create a new invoice against a lease.",
  {
    actorId: z.string(),
    leaseId: z.string(),
    amount: z.number(),
    description: z.string(),
    dueDate: z.string().describe("YYYY-MM-DD"),
    type: z.enum(["RENT", "MAINTENANCE", "PENALTY", "UTILITY", "OTHER"]).default("RENT"),
  },
  async ({ actorId, leaseId, amount, description, dueDate, type }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "generate_invoice", "CAN_MANAGE_FINANCE");
      const lease = await prisma.lease.findFirst({ where: { id: leaseId, property: SecurityService.getScope(u) } });
      if (!lease) throw new Error("Lease restricted or not found.");
      const inv = await prisma.invoice.create({ data: { leaseId, amount, description, dueDate: new Date(dueDate), type, status: "PENDING" } });
      await SecurityService.logAudit(u, "generate_invoice", "SUCCESS", { invoiceId: inv.id }, leaseId);
      return { content: [{ type: "text", text: `Invoice ${inv.id} created.` }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

/**
 * 📦 EXPENSES (SCOPED, READ & WRITE)
 */
server.tool(
  "list_expenses",
  "View cost records for properties in scope.",
  {
    actorId: z.string(),
    propertyId: z.string().optional(),
    category: z.enum(["MAINTENANCE", "REPAIR", "UTILITY", "INSURANCE", "TAX", "MANAGEMENT_FEE", "LEGAL", "CLEANING", "SECURITY", "OTHER"]).optional(),
  },
  async ({ actorId, propertyId, category }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "list_expenses", "CAN_VIEW_REPORTS");
      const scope = SecurityService.getScope(u);
      const expenses = await prisma.expense.findMany({
        where: {
          deletedAt: null,
          category: category || undefined,
          propertyId: propertyId || undefined,
          ...scope
        },
        include: { property: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 100
      });
      return { content: [{ type: "text", text: JSON.stringify(expenses, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

/**
 * 🔧 MAINTENANCE — RESOLUTION
 */
server.tool(
  "resolve_maintenance",
  "Close out a maintenance work order.",
  {
    actorId: z.string(),
    requestId: z.string(),
    notes: z.string().optional(),
    actualCost: z.number().optional(),
    vendor: z.string().optional(),
  },
  async ({ actorId, requestId, notes, actualCost, vendor }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "resolve_maintenance", "CAN_MANAGE_MAINTENANCE");
      const req = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, ...SecurityService.getScope(u) } });
      if (!req) throw new Error("Request not found or restricted.");
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: "COMPLETED", completedAt: new Date(), notes, actualCost, vendor }
      });
      await SecurityService.logAudit(u, "resolve_maintenance", "SUCCESS", {}, requestId);
      return { content: [{ type: "text", text: `Ticket ${requestId} resolved.` }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

/**
 * 🔴 LEASE TERMINATION (SENSITIVE + SCOPED)
 */
server.tool(
  "terminate_lease",
  "Sensitive: Permanently end a lease. Requires Human Confirmation Token.",
  {
    actorId: z.string(),
    leaseId: z.string(),
    confirmationToken: z.string().optional(),
  },
  async ({ actorId, leaseId, confirmationToken }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "terminate_lease", "CAN_MANAGE_LEASES");
      const lease = await prisma.lease.findFirst({ where: { id: leaseId, property: SecurityService.getScope(u) } });
      if (!lease) throw new Error("Lease restricted or not found.");

      if (!confirmationToken) {
        const token = SecurityService.generateToken("terminate_lease", { leaseId }, u.companyId || undefined);
        return { content: [{ type: "text", text: `⚠️  GUARDRAIL — Lease Termination\n\nLease: ${leaseId}\nNote: This action stops billing and marks the unit as Vacating.\n\nPlease ask for human approval, then resubmit with token: ${token}` }] };
      }
      const data = SecurityService.validateToken(confirmationToken, "terminate_lease", u.companyId || undefined);
      await prisma.lease.update({ where: { id: data.leaseId }, data: { status: "TERMINATED" } });
      await SecurityService.logAudit(u, "terminate_lease", "SUCCESS", {}, leaseId);
      return { content: [{ type: "text", text: `Lease ${leaseId} terminated.` }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

/**
 * 👥 STAFF & LANDLORDS
 */
server.tool(
  "list_staff",
  "Show team members available for assignment.",
  { actorId: z.string() },
  async ({ actorId }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "list_staff");
      const scope = u.role === "SUPER_ADMIN" ? {} : { companyId: u.companyId };
      const staff = await prisma.user.findMany({
        where: { ...scope, isActive: true, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, role: true, permissions: true }
      });
      return { content: [{ type: "text", text: JSON.stringify(staff, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

server.tool(
  "list_landlords",
  "Show property owners managed by the company.",
  { actorId: z.string() },
  async ({ actorId }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_STAFF", "COMPANY_ADMIN", "SUPER_ADMIN"], "list_landlords");
      const ll = await prisma.landlord.findMany({
        where: { ...SecurityService.getScope(u), deletedAt: null },
        include: { _count: { select: { properties: true } } }
      });
      return { content: [{ type: "text", text: JSON.stringify(ll, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

/**
 * 🔎 AUDIT LOG REVIEW
 */
server.tool(
  "view_audit_logs",
  "Review action history. ADMIN only — scoped to own company.",
  {
    actorId: z.string(),
    action: z.string().optional(),
    limit: z.number().default(25),
  },
  async ({ actorId, action, limit }) => {
    try {
      const u = await SecurityService.authorize(actorId, ["COMPANY_ADMIN", "SUPER_ADMIN"], "view_audit_logs");
      const scopeFilter = u.role === "SUPER_ADMIN" ? {} : { actorCompanyId: u.companyId };
      const logs = await prisma.auditLog.findMany({
        where: { ...scopeFilter, action: action || undefined },
        orderBy: { timestamp: "desc" },
        take: limit
      });
      return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
    } catch (e: any) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
