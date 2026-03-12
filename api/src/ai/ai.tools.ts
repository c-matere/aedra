import { GoogleGenerativeAI, Tool, SchemaType } from '@google/generative-ai';
import { WorkflowType } from '@prisma/client';

const buildTools = (tools: any[]) => [{ functionDeclarations: tools }] as Tool[];

export const buildModels = (genAI: GoogleGenerativeAI, systemInstruction: string) => {
    const coreReadTools = [
        {
            name: 'list_companies',
            description: 'List all companies (Super Admin only).',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'search_companies',
            description: 'Search companies by name (Super Admin only).',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    query: { type: SchemaType.STRING, description: 'Search text' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
                required: ['query'],
            },
        },
        {
            name: 'list_properties',
            description: 'List all properties managed by the current company.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'get_property_details',
            description: 'Get detailed information about a specific property including units.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    propertyId: { type: SchemaType.STRING, description: 'The UUID of the property' },
                },
                required: ['propertyId'],
            },
        },
        {
            name: 'search_properties',
            description: 'Search properties by name or address.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    query: { type: SchemaType.STRING, description: 'Search text' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
                required: ['query'],
            },
        },
        {
            name: 'list_units',
            description: 'List units for the current company, optionally filtered by property.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    propertyId: { type: SchemaType.STRING, description: 'Filter by property UUID' },
                    status: { type: SchemaType.STRING, description: 'Filter by unit status' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'get_unit_details',
            description: 'Get detailed information about a specific unit.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    unitId: { type: SchemaType.STRING, description: 'The UUID of the unit' },
                },
                required: ['unitId'],
            },
        },
        {
            name: 'search_units',
            description: 'Search units by unit number or property name.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    query: { type: SchemaType.STRING, description: 'Search text' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
                required: ['query'],
            },
        },
        {
            name: 'list_tenants',
            description: 'List tenants for the current company, optionally filtered by property.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    propertyId: { type: SchemaType.STRING, description: 'Filter by property UUID' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'search_tenants',
            description: 'Search tenants by name, email, or phone. Super Admins can use this without a selected company to find tenants across all managed companies.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    query: { type: SchemaType.STRING, description: 'Search text' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
                required: ['query'],
            },
        },
        {
            name: 'get_tenant_details',
            description: 'Get detailed information about a specific tenant.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    tenantId: { type: SchemaType.STRING, description: 'The UUID of the tenant' },
                },
                required: ['tenantId'],
            },
        },
        {
            name: 'list_leases',
            description: 'List leases, optionally filtered by property, tenant, or status.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    propertyId: { type: SchemaType.STRING, description: 'Filter by property UUID' },
                    tenantId: { type: SchemaType.STRING, description: 'Filter by tenant UUID' },
                    status: { type: SchemaType.STRING, description: 'Filter by lease status' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'get_lease_details',
            description: 'Get detailed information about a specific lease, including tenant and unit.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    leaseId: { type: SchemaType.STRING, description: 'The UUID of the lease' },
                },
                required: ['leaseId'],
            },
        },
        {
            name: 'list_payments',
            description: 'List payments, optionally filtered by lease or date range.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    leaseId: { type: SchemaType.STRING, description: 'Filter by lease UUID' },
                    dateFrom: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    dateTo: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'list_invoices',
            description: 'List invoices, optionally filtered by lease or status.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    leaseId: { type: SchemaType.STRING, description: 'Filter by lease UUID' },
                    status: { type: SchemaType.STRING, description: 'Filter by invoice status' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'list_expenses',
            description: 'List expenses, optionally filtered by property or unit and date range.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    propertyId: { type: SchemaType.STRING, description: 'Filter by property UUID' },
                    unitId: { type: SchemaType.STRING, description: 'Filter by unit UUID' },
                    dateFrom: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    dateTo: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'list_maintenance_requests',
            description: 'List maintenance requests, optionally filtered by property, unit, or status.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    propertyId: { type: SchemaType.STRING, description: 'Filter by property UUID' },
                    unitId: { type: SchemaType.STRING, description: 'Filter by unit UUID' },
                    status: { type: SchemaType.STRING, description: 'Filter by maintenance status' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'list_landlords',
            description: 'List landlords for the current company.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'search_landlords',
            description: 'Search landlords by name, email, or phone.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    query: { type: SchemaType.STRING, description: 'Search text' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
                required: ['query'],
            },
        },
        {
            name: 'list_staff',
            description: 'List all staff members for the current company.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'search_staff',
            description: 'Search company staff by name or email.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    query: { type: SchemaType.STRING, description: 'Search text' },
                    limit: { type: SchemaType.NUMBER, description: 'Max results (default 20)' },
                },
            },
        },
        {
            name: 'get_company_summary',
            description: 'Get a high-level company summary including occupancy and financial totals.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    dateFrom: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    dateTo: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                },
            },
        },
        {
            name: 'select_company',
            description: 'Select or switch to a specific company workspace for the current session.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    companyId: { type: SchemaType.STRING, description: 'The UUID of the company to select' },
                },
                required: ['companyId'],
            },
        },
    ];

    const coreWriteTools = [
        {
            name: 'create_tenant',
            description: 'Create a new tenant for a property. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    firstName: { type: SchemaType.STRING, description: 'First name' },
                    lastName: { type: SchemaType.STRING, description: 'Last name' },
                    email: { type: SchemaType.STRING, description: 'Email address' },
                    phone: { type: SchemaType.STRING, description: 'Phone number' },
                    idNumber: { type: SchemaType.STRING, description: 'ID number' },
                    propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to create' },
                },
                required: ['firstName', 'lastName', 'propertyId', 'confirm'],
            },
        },
        {
            name: 'create_landlord',
            description: 'Create a new landlord. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    firstName: { type: SchemaType.STRING, description: 'First name' },
                    lastName: { type: SchemaType.STRING, description: 'Last name' },
                    email: { type: SchemaType.STRING, description: 'Email address' },
                    phone: { type: SchemaType.STRING, description: 'Phone number' },
                    idNumber: { type: SchemaType.STRING, description: 'ID number (KRA/National ID)' },
                    address: { type: SchemaType.STRING, description: 'Physical address' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to create' },
                },
                required: ['firstName', 'lastName', 'confirm'],
            },
        },
        {
            name: 'create_property',
            description: 'Create a new property building or estate. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING, description: 'Property name (e.g. "Ocean View Apartments")' },
                    address: { type: SchemaType.STRING, description: 'Physical address' },
                    propertyType: { type: SchemaType.STRING, enum: ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'LAND'], description: 'Property type' },
                    description: { type: SchemaType.STRING, description: 'Short description' },
                    landlordId: { type: SchemaType.STRING, description: 'Landlord UUID (optional)' },
                    commissionPercentage: { type: SchemaType.NUMBER, description: 'Management fee percentage' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to create' },
                },
                required: ['name', 'address', 'propertyType', 'confirm'],
            },
        },
        {
            name: 'create_staff',
            description: 'Add a new staff member to the company. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    firstName: { type: SchemaType.STRING, description: 'First name' },
                    lastName: { type: SchemaType.STRING, description: 'Last name' },
                    email: { type: SchemaType.STRING, description: 'Email address' },
                    phone: { type: SchemaType.STRING, description: 'Phone number' },
                    password: { type: SchemaType.STRING, description: 'Password (default to a secure random one if not provided)' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to create' },
                },
                required: ['firstName', 'lastName', 'email', 'confirm'],
            },
        },
        {
            name: 'create_lease',
            description: 'Create a new lease for a tenant and unit. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    tenantId: { type: SchemaType.STRING, description: 'Tenant UUID' },
                    propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
                    unitId: { type: SchemaType.STRING, description: 'Unit UUID' },
                    rentAmount: { type: SchemaType.NUMBER, description: 'Monthly rent amount' },
                    deposit: { type: SchemaType.NUMBER, description: 'Deposit amount' },
                    startDate: { type: SchemaType.STRING, description: 'Lease start date (ISO)' },
                    endDate: { type: SchemaType.STRING, description: 'Lease end date (ISO)' },
                    status: { type: SchemaType.STRING, description: 'Lease status (default PENDING)' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to create' },
                },
                required: ['tenantId', 'propertyId', 'rentAmount', 'startDate', 'endDate', 'confirm'],
            },
        },
        {
            name: 'create_maintenance_request',
            description: 'Create a new maintenance request. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    title: { type: SchemaType.STRING, description: 'Short title of the issue (e.g. Broken Sink)' },
                    description: { type: SchemaType.STRING, description: 'Detailed description' },
                    priority: { type: SchemaType.STRING, description: 'Priority (LOW, MEDIUM, HIGH, URGENT)' },
                    category: { type: SchemaType.STRING, description: 'Category (PLUMBING, ELECTRICAL, APPLIANCE, STRUCTURAL, HVAC, PEST_CONTROL, OTHER)' },
                    propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
                    unitId: { type: SchemaType.STRING, description: 'Unit UUID (optional)' },
                    tenantId: { type: SchemaType.STRING, description: 'Tenant UUID (optional)' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to create' },
                },
                required: ['title', 'description', 'priority', 'category', 'propertyId', 'confirm'],
            },
        },
        {
            name: 'create_invoice',
            description: 'Create a new invoice for a lease. Use this to bill tenants for rent, utilities, or maintenance. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    leaseId: { type: SchemaType.STRING, description: 'Lease UUID' },
                    amount: { type: SchemaType.NUMBER, description: 'Invoice amount' },
                    description: { type: SchemaType.STRING, description: 'Invoice description' },
                    type: { type: SchemaType.STRING, description: 'Invoice type (RENT, MAINTENANCE, etc)' },
                    dueDate: { type: SchemaType.STRING, description: 'Due date (ISO)' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to create' },
                },
                required: ['leaseId', 'amount', 'description', 'dueDate', 'confirm'],
            },
        },
        {
            name: 'record_payment',
            description: 'Record a payment received against a lease. Use this when a tenant pays an invoice. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    leaseId: { type: SchemaType.STRING, description: 'Lease UUID' },
                    amount: { type: SchemaType.NUMBER, description: 'Payment amount' },
                    method: { type: SchemaType.STRING, description: 'Payment method (MPESA, CASH, BANK, etc)' },
                    type: { type: SchemaType.STRING, description: 'Payment type (RENT, DEPOSIT, PENALTY, etc)' },
                    reference: { type: SchemaType.STRING, description: 'Payment reference' },
                    notes: { type: SchemaType.STRING, description: 'Notes' },
                    paidAt: { type: SchemaType.STRING, description: 'Paid at (ISO)' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to record' },
                },
                required: ['leaseId', 'amount', 'confirm'],
            },
        },

        {
            name: 'update_unit_status',
            description: 'Update a unit status. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    unitId: { type: SchemaType.STRING, description: 'Unit UUID' },
                    status: { type: SchemaType.STRING, description: 'Unit status (VACANT, OCCUPIED, etc)' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['unitId', 'status', 'confirm'],
            },
        },
        {
            name: 'update_property',
            description: 'Update property details. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
                    name: { type: SchemaType.STRING, description: 'Property name' },
                    address: { type: SchemaType.STRING, description: 'Physical address' },
                    propertyType: { type: SchemaType.STRING, enum: ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'LAND'], description: 'Property type' },
                    description: { type: SchemaType.STRING, description: 'Short description' },
                    landlordId: { type: SchemaType.STRING, description: 'Landlord UUID' },
                    commissionPercentage: { type: SchemaType.NUMBER, description: 'Management fee percentage' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['propertyId', 'confirm'],
            },
        },
        {
            name: 'update_landlord',
            description: 'Update landlord details. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    landlordId: { type: SchemaType.STRING, description: 'Landlord UUID' },
                    firstName: { type: SchemaType.STRING, description: 'First name' },
                    lastName: { type: SchemaType.STRING, description: 'Last name' },
                    email: { type: SchemaType.STRING, description: 'Email address' },
                    phone: { type: SchemaType.STRING, description: 'Phone number' },
                    idNumber: { type: SchemaType.STRING, description: 'ID number' },
                    address: { type: SchemaType.STRING, description: 'Physical address' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['landlordId', 'confirm'],
            },
        },
        {
            name: 'update_staff',
            description: 'Update staff member details. AI IS FORBIDDEN FROM UPDATING COMPANY ADMINS. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    staffId: { type: SchemaType.STRING, description: 'Staff (User) UUID' },
                    firstName: { type: SchemaType.STRING, description: 'First name' },
                    lastName: { type: SchemaType.STRING, description: 'Last name' },
                    email: { type: SchemaType.STRING, description: 'Email address' },
                    phone: { type: SchemaType.STRING, description: 'Phone number' },
                    isActive: { type: SchemaType.BOOLEAN, description: 'Is account active' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['staffId', 'confirm'],
            },
        },
        {
            name: 'update_tenant',
            description: 'Update an existing tenant. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    tenantId: { type: SchemaType.STRING, description: 'Tenant UUID' },
                    firstName: { type: SchemaType.STRING, description: 'First name' },
                    lastName: { type: SchemaType.STRING, description: 'Last name' },
                    email: { type: SchemaType.STRING, description: 'Email address' },
                    phone: { type: SchemaType.STRING, description: 'Phone number' },
                    idNumber: { type: SchemaType.STRING, description: 'ID number' },
                    propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['tenantId', 'confirm'],
            },
        },
        {
            name: 'update_lease',
            description: 'Update an existing lease. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    leaseId: { type: SchemaType.STRING, description: 'Lease UUID' },
                    unitId: { type: SchemaType.STRING, description: 'Unit UUID' },
                    rentAmount: { type: SchemaType.NUMBER, description: 'Monthly rent amount' },
                    deposit: { type: SchemaType.NUMBER, description: 'Deposit amount' },
                    startDate: { type: SchemaType.STRING, description: 'Lease start date (ISO)' },
                    endDate: { type: SchemaType.STRING, description: 'Lease end date (ISO)' },
                    status: { type: SchemaType.STRING, description: 'Lease status' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['leaseId', 'confirm'],
            },
        },
        {
            name: 'update_invoice',
            description: 'Update an existing invoice. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    invoiceId: { type: SchemaType.STRING, description: 'Invoice UUID' },
                    amount: { type: SchemaType.NUMBER, description: 'Invoice amount' },
                    description: { type: SchemaType.STRING, description: 'Invoice description' },
                    type: { type: SchemaType.STRING, description: 'Invoice type (RENT, MAINTENANCE, etc)' },
                    dueDate: { type: SchemaType.STRING, description: 'Due date (ISO)' },
                    status: { type: SchemaType.STRING, description: 'Invoice status (PENDING, PAID, etc)' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['invoiceId', 'confirm'],
            },
        },
        {
            name: 'update_maintenance_request',
            description: 'Update a maintenance request. Requires confirmation.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    requestId: { type: SchemaType.STRING, description: 'Maintenance request UUID' },
                    status: { type: SchemaType.STRING, description: 'Status' },
                    priority: { type: SchemaType.STRING, description: 'Priority' },
                    category: { type: SchemaType.STRING, description: 'Category' },
                    title: { type: SchemaType.STRING, description: 'Title' },
                    description: { type: SchemaType.STRING, description: 'Description' },
                    assignedToId: { type: SchemaType.STRING, description: 'Assigned user UUID' },
                    scheduledAt: { type: SchemaType.STRING, description: 'Scheduled at (ISO)' },
                    completedAt: { type: SchemaType.STRING, description: 'Completed at (ISO)' },
                    estimatedCost: { type: SchemaType.NUMBER, description: 'Estimated cost' },
                    actualCost: { type: SchemaType.NUMBER, description: 'Actual cost' },
                    vendor: { type: SchemaType.STRING, description: 'Vendor name' },
                    vendorPhone: { type: SchemaType.STRING, description: 'Vendor phone' },
                    notes: { type: SchemaType.STRING, description: 'Internal notes' },
                    confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to update' },
                },
                required: ['requestId', 'confirm'],
            },
        },
    ];

    const reportTools = [
        {
            name: 'get_financial_report',
            description: 'Get financial totals and breakdowns by property, category, or month.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    dateFrom: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    dateTo: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    groupBy: { type: SchemaType.STRING, description: 'property | category | month | none' },
                    include: { type: SchemaType.STRING, description: 'payments | expenses | invoices | all' },
                    limit: { type: SchemaType.NUMBER, description: 'Row cap for breakdowns (default 5000)' },
                    explain: { type: SchemaType.BOOLEAN, description: 'Include derivation details' },
                },
            },
        },
        {
            name: 'generate_report_file',
            description: 'Generate a downloadable PDF or CSV financial report.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    reportType: { type: SchemaType.STRING, description: 'Summary | Revenue | Occupancy | Financial' },
                    dateFrom: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    dateTo: { type: SchemaType.STRING, description: 'ISO date string (inclusive)' },
                    format: { type: SchemaType.STRING, description: 'pdf | csv', enum: ['pdf', 'csv'] },
                },
                required: ['reportType', 'format'],
            },
        },
    ];

    const workflowTools = [
        {
            name: 'workflow_initiate',
            description: 'Start a new stateful property management workflow.',
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    type: {
                        type: SchemaType.STRING,
                        enum: Object.values(WorkflowType),
                        format: 'enum',
                        description: `The type of workflow to start. Available workflows and what they do:
- RENT_COLLECTION: Automated tracking of rent due, late fees, and reminders.
- MAINTENANCE_LIFECYCLE: End-to-end tracking of a repair ticket from vendor assignment to completion.
- LEASE_RENEWAL: Process for notifying tenants of expiring leases and capturing renewal documents.
- TENANT_ONBOARDING: Checklist and document collection for a new tenant moving in.`
                    },
                    targetId: {
                        type: SchemaType.STRING,
                        description: 'ID of the related entity (e.g. Lease ID or Maintenance Request ID). If the workflow requires a target and the user hasn\'t provided one, YOU MUST ASK the user which specific entity they want to run this workflow on. If the user wants to track a NEW issue, use create_maintenance_request first to generate the ID.'
                    },
                },
                required: ['type'],
            },
        },
    ];

    return {
        read: genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: buildTools([...coreReadTools, ...workflowTools]) as any,
            systemInstruction,
        }),
        write: genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: buildTools([...coreReadTools, ...coreWriteTools, ...workflowTools]) as any,
            systemInstruction,
        }),
        report: genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: buildTools([...coreReadTools, ...reportTools, ...workflowTools]) as any,
            systemInstruction,
        }),
    };
};
