import { GoogleGenerativeAI, Tool, SchemaType } from '@google/generative-ai';
import { WorkflowType } from '@prisma/client';

// Pick a model that is guaranteed to exist for the configured API key.
// Allow override via GEMINI_MODEL, otherwise prefer gemini-2.5-flash.
export const BASE_MODEL =
  (process.env.GEMINI_MODEL || '').trim() || 'gemini-1.5-flash';

export const buildTools = (tools: any[]) =>
  [{ functionDeclarations: tools }] as Tool[];

export const coreReadTools = [
  {
    name: 'list_companies',
    description: 'List all companies (Super Admin only).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
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
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
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
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'get_property_details',
    description:
      'Get detailed information about a specific property including units.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'The UUID of the property',
        },
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
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_units',
    description:
      'List units for the current company, optionally filtered by property.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'Filter by property UUID',
        },
        status: {
          type: SchemaType.STRING,
          description: 'Filter by unit status',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'get_unit_details',
    description: 'Get detailed information about a specific unit.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        unitId: {
          type: SchemaType.STRING,
          description: 'The UUID of the unit',
        },
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
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_tenants',
    description:
      'List tenants for the current company, optionally filtered by property. Use this to check for existing tenants before adding a new one.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'Filter by property UUID',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'detect_duplicates',
    description:
      'Scan the current company for potential duplicate tenant records based on similar names, phones, or emails. Returns a list of duplicate groups.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        matchThreshold: {
          type: SchemaType.NUMBER,
          description: 'Minimum similarity score (0.0 to 1.0, default 0.8)',
        },
      },
    },
  },
  {
    name: 'search_tenants',
    description:
      'Search tenants by name, email, or phone. Super Admins can use this without a selected company to find tenants across all managed companies.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Search text' },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
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
        tenantId: {
          type: SchemaType.STRING,
          description: 'The UUID of the tenant',
        },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'list_leases',
    description:
      'List leases, optionally filtered by property, tenant, or status.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'Filter by property UUID',
        },
        tenantId: {
          type: SchemaType.STRING,
          description: 'Filter by tenant UUID',
        },
        status: {
          type: SchemaType.STRING,
          description: 'Filter by lease status',
        },
        query: {
          type: SchemaType.STRING,
          description: 'Search text (semantic)',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'get_lease_details',
    description:
      'Get detailed information about a specific lease, including tenant and unit.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        leaseId: {
          type: SchemaType.STRING,
          description: 'The UUID of the lease',
        },
      },
      required: ['leaseId'],
    },
  },
  {
    name: 'list_payments',
    description:
      'List payments, optionally filtered by lease, property, tenant or date range.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        leaseId: {
          type: SchemaType.STRING,
          description: 'Filter by lease UUID',
        },
        propertyId: {
          type: SchemaType.STRING,
          description: 'Filter by property UUID',
        },
        tenantId: {
          type: SchemaType.STRING,
          description: 'Filter by tenant UUID',
        },
        query: {
          type: SchemaType.STRING,
          description:
            'Search text (tenant name, property name, unit, reference)',
        },
        dateFrom: {
          type: SchemaType.STRING,
          description:
            'ISO date string (inclusive). Defaults to start of current month if omitted.',
        },
        dateTo: {
          type: SchemaType.STRING,
          description:
            'ISO date string (inclusive). Defaults to now if omitted.',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'list_invoices',
    description:
      'List invoices, optionally filtered by lease, property, tenant, or status.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        leaseId: {
          type: SchemaType.STRING,
          description: 'Filter by lease UUID',
        },
        propertyId: {
          type: SchemaType.STRING,
          description: 'Filter by property UUID',
        },
        tenantId: {
          type: SchemaType.STRING,
          description: 'Filter by tenant UUID',
        },
        query: {
          type: SchemaType.STRING,
          description:
            'Search text (tenant name, property name, unit, description)',
        },
        status: {
          type: SchemaType.STRING,
          description: 'Filter by invoice status',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'list_expenses',
    description:
      'List expenses, optionally filtered by property or unit and date range.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'Filter by property UUID',
        },
        unitId: { type: SchemaType.STRING, description: 'Filter by unit UUID' },
        dateFrom: {
          type: SchemaType.STRING,
          description:
            'ISO date string (inclusive). Defaults to start of current month if omitted.',
        },
        dateTo: {
          type: SchemaType.STRING,
          description:
            'ISO date string (inclusive). Defaults to now if omitted.',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'list_vacant_units',
    description:
      'List all vacant units available across all managed properties. Use this to help potential tenants find a place to rent.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'list_maintenance_requests',
    description:
      'List maintenance requests, optionally filtered by property, unit, or status.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'Filter by property UUID',
        },
        unitId: { type: SchemaType.STRING, description: 'Filter by unit UUID' },
        status: {
          type: SchemaType.STRING,
          description: 'Filter by maintenance status',
        },
        query: {
          type: SchemaType.STRING,
          description: 'Search text (semantic)',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'list_landlords',
    description: 'List landlords for the current company.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
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
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
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
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
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
        limit: {
          type: SchemaType.NUMBER,
          description: 'Max results (default 20)',
        },
      },
    },
  },
  {
    name: 'get_portfolio_arrears',
    description:
      "Get a snapshot of who has and hasn't paid rent for the current month across the portfolio.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'Optional property UUID to filter results',
        },
      },
    },
  },
  {
    name: 'get_company_summary',
    description:
      'Get a high-level company summary including occupancy and financial totals. If dates are omitted, defaults to current month.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dateFrom: {
          type: SchemaType.STRING,
          description:
            'ISO date string (inclusive). Defaults to start of current month.',
        },
        dateTo: {
          type: SchemaType.STRING,
          description: 'ISO date string (inclusive). Defaults to now.',
        },
      },
    },
  },
  {
    name: 'select_company',
    description:
      'Select or switch to a specific company workspace for the current session. You can provide either the UUID as "companyId" or the name as "companyName".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        companyId: {
          type: SchemaType.STRING,
          description: 'The UUID of the company to select',
        },
        companyName: {
          type: SchemaType.STRING,
          description: 'The name of the company to select (e.g. "Epic Properties")',
        },
      },
    },
  },
  {
    name: 'generate_execution_plan',
    description:
      'Propose a step-by-step plan for a complex multi-entity operation. Use this when the user request involves creating or updating more than 3 entities (e.g. bulk property/tenant imports).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        planTitle: {
          type: SchemaType.STRING,
          description: 'A short, descriptive title for the plan',
        },
        steps: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              stepNumber: { type: SchemaType.NUMBER },
              action: {
                type: SchemaType.STRING,
                description: 'The tool to be called (e.g. create_property)',
              },
              description: {
                type: SchemaType.STRING,
                description: 'What this step accomplishes with what data',
              },
            },
          },
        },
      },
      required: ['planTitle', 'steps'],
    },
  },
  {
    name: 'get_tenant_statement',
    description:
      'Get a full accounting statement for a tenant, including all invoices and payments.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenantId: {
          type: SchemaType.STRING,
          description: 'The UUID of the tenant',
        },
      },
      required: ['tenantId'],
    },
  },
];

export const coreWriteTools = [
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
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['firstName', 'lastName', 'propertyId', 'confirm'],
    },
  },
  {
    name: 'delete_tenant',
    description:
      'Delete a tenant from the system. This is a destructive action and requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenantId: {
          type: SchemaType.STRING,
          description: 'The UUID of the tenant to delete',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to delete',
        },
      },
      required: ['tenantId', 'confirm'],
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
        idNumber: {
          type: SchemaType.STRING,
          description: 'ID number (KRA/National ID)',
        },
        address: { type: SchemaType.STRING, description: 'Physical address' },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['firstName', 'lastName', 'confirm'],
    },
  },
  {
    name: 'create_property',
    description:
      'Create a new property building or estate. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: 'Property name (e.g. "Ocean View Apartments")',
        },
        address: { type: SchemaType.STRING, description: 'Physical address' },
        propertyType: {
          type: SchemaType.STRING,
          enum: [
            'RESIDENTIAL',
            'COMMERCIAL',
            'MIXED_USE',
            'INDUSTRIAL',
            'LAND',
          ],
          description: 'Property type',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Short description',
        },
        landlordId: {
          type: SchemaType.STRING,
          description: 'Landlord UUID (optional)',
        },
        commissionPercentage: {
          type: SchemaType.NUMBER,
          description: 'Management fee percentage',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['name', 'address', 'propertyType', 'confirm'],
    },
  },
  {
    name: 'create_staff',
    description:
      'Add a new staff member to the company. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        firstName: { type: SchemaType.STRING, description: 'First name' },
        lastName: { type: SchemaType.STRING, description: 'Last name' },
        email: { type: SchemaType.STRING, description: 'Email address' },
        phone: { type: SchemaType.STRING, description: 'Phone number' },
        password: {
          type: SchemaType.STRING,
          description:
            'Password (default to a secure random one if not provided)',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['firstName', 'lastName', 'email', 'confirm'],
    },
  },
  {
    name: 'create_lease',
    description:
      'Create a new lease for a tenant and unit. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenantId: { type: SchemaType.STRING, description: 'Tenant UUID' },
        propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
        unitId: { type: SchemaType.STRING, description: 'Unit UUID' },
        rentAmount: {
          type: SchemaType.NUMBER,
          description: 'Monthly rent amount',
        },
        deposit: { type: SchemaType.NUMBER, description: 'Deposit amount' },
        startDate: {
          type: SchemaType.STRING,
          description: 'Lease start date (ISO)',
        },
        endDate: {
          type: SchemaType.STRING,
          description: 'Lease end date (ISO)',
        },
        status: {
          type: SchemaType.STRING,
          description: 'Lease status (default PENDING)',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: [
        'tenantId',
        'propertyId',
        'rentAmount',
        'startDate',
        'endDate',
        'confirm',
      ],
    },
  },
  {
    name: 'create_maintenance_request',
    description: 'Create a new maintenance request. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: 'Short title of the issue (e.g. Broken Sink)',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Detailed description',
        },
        priority: {
          type: SchemaType.STRING,
          description: 'Priority (LOW, MEDIUM, HIGH, URGENT)',
        },
        category: {
          type: SchemaType.STRING,
          description:
            'Category (PLUMBING, ELECTRICAL, APPLIANCE, STRUCTURAL, HVAC, PEST_CONTROL, OTHER)',
        },
        propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
        unitId: {
          type: SchemaType.STRING,
          description: 'Unit UUID (optional)',
        },
        tenantId: {
          type: SchemaType.STRING,
          description: 'Tenant UUID (optional)',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: [
        'title',
        'description',
        'priority',
        'category',
        'propertyId',
        'confirm',
      ],
    },
  },
  {
    name: 'create_invoice',
    description:
      'Create a new invoice for a lease. Use this to bill tenants for rent, utilities, or maintenance. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        leaseId: { type: SchemaType.STRING, description: 'Lease UUID' },
        amount: { type: SchemaType.NUMBER, description: 'Invoice amount' },
        description: {
          type: SchemaType.STRING,
          description: 'Invoice description',
        },
        type: {
          type: SchemaType.STRING,
          description: 'Invoice type (RENT, MAINTENANCE, etc)',
        },
        dueDate: { type: SchemaType.STRING, description: 'Due date (ISO)' },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['leaseId', 'amount', 'description', 'dueDate', 'confirm'],
    },
  },
  {
    name: 'record_payment',
    description:
      'Record a payment received against a lease. Use this when a tenant pays an invoice. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        leaseId: { type: SchemaType.STRING, description: 'Lease UUID' },
        amount: { type: SchemaType.NUMBER, description: 'Payment amount' },
        method: {
          type: SchemaType.STRING,
          description: 'Payment method (MPESA, CASH, BANK, etc)',
        },
        type: {
          type: SchemaType.STRING,
          description: 'Payment type (RENT, DEPOSIT, PENALTY, etc)',
        },
        reference: {
          type: SchemaType.STRING,
          description: 'Payment reference',
        },
        notes: { type: SchemaType.STRING, description: 'Notes' },
        paidAt: { type: SchemaType.STRING, description: 'Paid at (ISO)' },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to record',
        },
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
        status: {
          type: SchemaType.STRING,
          description: 'Unit status (VACANT, OCCUPIED, etc)',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
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
        propertyType: {
          type: SchemaType.STRING,
          enum: [
            'RESIDENTIAL',
            'COMMERCIAL',
            'MIXED_USE',
            'INDUSTRIAL',
            'LAND',
          ],
          description: 'Property type',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Short description',
        },
        landlordId: { type: SchemaType.STRING, description: 'Landlord UUID' },
        commissionPercentage: {
          type: SchemaType.NUMBER,
          description: 'Management fee percentage',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
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
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
      },
      required: ['landlordId', 'confirm'],
    },
  },
  {
    name: 'update_staff_profile',
    description:
      'Update details for a company staff member or employee. DO NOT use this for tenants, residents, or landlords. AI IS FORBIDDEN FROM UPDATING COMPANY ADMINS. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        staffId: { type: SchemaType.STRING, description: 'Staff (User) UUID' },
        firstName: { type: SchemaType.STRING, description: 'First name' },
        lastName: { type: SchemaType.STRING, description: 'Last name' },
        email: { type: SchemaType.STRING, description: 'Email address' },
        phone: { type: SchemaType.STRING, description: 'Phone number' },
        isActive: {
          type: SchemaType.BOOLEAN,
          description: 'Is account active',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
      },
      required: ['staffId', 'confirm'],
    },
  },
  {
    name: 'create_unit',
    description: 'Create a new unit for a property. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: { type: SchemaType.STRING, description: 'Property UUID' },
        unitNumber: {
          type: SchemaType.STRING,
          description: 'Unit number/name (e.g. "A1")',
        },
        floor: { type: SchemaType.STRING, description: 'Floor number' },
        bedrooms: {
          type: SchemaType.NUMBER,
          description: 'Number of bedrooms',
        },
        bathrooms: {
          type: SchemaType.NUMBER,
          description: 'Number of bathrooms',
        },
        sizeSqm: {
          type: SchemaType.NUMBER,
          description: 'Size in square meters',
        },
        rentAmount: {
          type: SchemaType.NUMBER,
          description: 'Monthly rent amount',
        },
        status: {
          type: SchemaType.STRING,
          description: 'Initial status (VACANT, OCCUPIED, etc)',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['propertyId', 'unitNumber', 'confirm'],
    },
  },
  {
    name: 'update_unit',
    description: 'Update unit details. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        unitId: { type: SchemaType.STRING, description: 'Unit UUID' },
        unitNumber: {
          type: SchemaType.STRING,
          description: 'Unit number/name',
        },
        floor: { type: SchemaType.STRING, description: 'Floor number' },
        bedrooms: {
          type: SchemaType.NUMBER,
          description: 'Number of bedrooms',
        },
        bathrooms: {
          type: SchemaType.NUMBER,
          description: 'Number of bathrooms',
        },
        sizeSqm: {
          type: SchemaType.NUMBER,
          description: 'Size in square meters',
        },
        rentAmount: {
          type: SchemaType.NUMBER,
          description: 'Monthly rent amount',
        },
        status: { type: SchemaType.STRING, description: 'Unit status' },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
      },
      required: ['unitId', 'confirm'],
    },
  },
  {
    name: 'update_tenant',
    description:
      'Update a tenant (resident/renter) record. Use this ONLY for people who rent units. DO NOT use this for property owners (landlords) or company staff. Requires confirmation.',
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
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
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
        rentAmount: {
          type: SchemaType.NUMBER,
          description: 'Monthly rent amount',
        },
        deposit: { type: SchemaType.NUMBER, description: 'Deposit amount' },
        startDate: {
          type: SchemaType.STRING,
          description: 'Lease start date (ISO)',
        },
        endDate: {
          type: SchemaType.STRING,
          description: 'Lease end date (ISO)',
        },
        status: { type: SchemaType.STRING, description: 'Lease status' },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
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
        description: {
          type: SchemaType.STRING,
          description: 'Invoice description',
        },
        type: {
          type: SchemaType.STRING,
          description: 'Invoice type (RENT, MAINTENANCE, etc)',
        },
        dueDate: { type: SchemaType.STRING, description: 'Due date (ISO)' },
        status: {
          type: SchemaType.STRING,
          description: 'Invoice status (PENDING, PAID, etc)',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
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
        requestId: {
          type: SchemaType.STRING,
          description: 'Maintenance request UUID',
        },
        status: { type: SchemaType.STRING, description: 'Status' },
        priority: { type: SchemaType.STRING, description: 'Priority' },
        category: { type: SchemaType.STRING, description: 'Category' },
        title: { type: SchemaType.STRING, description: 'Title' },
        description: { type: SchemaType.STRING, description: 'Description' },
        assignedToId: {
          type: SchemaType.STRING,
          description: 'Assigned user UUID',
        },
        scheduledAt: {
          type: SchemaType.STRING,
          description: 'Scheduled at (ISO)',
        },
        completedAt: {
          type: SchemaType.STRING,
          description: 'Completed at (ISO)',
        },
        estimatedCost: {
          type: SchemaType.NUMBER,
          description: 'Estimated cost',
        },
        actualCost: { type: SchemaType.NUMBER, description: 'Actual cost' },
        vendor: { type: SchemaType.STRING, description: 'Vendor name' },
        vendorPhone: { type: SchemaType.STRING, description: 'Vendor phone' },
        notes: { type: SchemaType.STRING, description: 'Internal notes' },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to update',
        },
      },
      required: ['requestId', 'confirm'],
    },
  },
  {
    name: 'send_whatsapp_message',
    description:
      'Send a WhatsApp template message to a tenant or landlord. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        to: {
          type: SchemaType.STRING,
          description: 'The recipient phone number (e.g. 254...)',
        },
        templateName: {
          type: SchemaType.STRING,
          description: 'The name of the WhatsApp template to use',
        },
        bodyText: {
          type: SchemaType.STRING,
          description:
            'Optional text to fill the first template variable {{1}}',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to send',
        },
      },
      required: ['to', 'templateName', 'confirm'],
    },
  },
  {
    name: 'configure_whatsapp',
    description:
      'Configure Meta WhatsApp API credentials for the current company. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        accessToken: {
          type: SchemaType.STRING,
          description: 'Meta Graph API Access Token',
        },
        phoneNumberId: {
          type: SchemaType.STRING,
          description: 'Meta Phone Number ID',
        },
        verifyToken: {
          type: SchemaType.STRING,
          description: 'Webhook Verify Token',
        },
        businessAccountId: {
          type: SchemaType.STRING,
          description: 'Meta Business Account ID',
        },
        ownerPhone: {
          type: SchemaType.STRING,
          description: 'WhatsApp number for notifications',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to save',
        },
      },
      required: ['accessToken', 'phoneNumberId', 'confirm'],
    },
  },
  {
    name: 'register_company',
    description:
      'Register a new company workspace and an admin user. Use this tool ONLY for creating a brand new account on the Aedra platform. If the user is already logged in or managed within a workspace, this tool is likely NOT what they want—they probably want `create_property` instead.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        companyName: {
          type: SchemaType.STRING,
          description: 'The name of the company to register',
        },
        email: { type: SchemaType.STRING, description: 'The admin user email' },
        password: {
          type: SchemaType.STRING,
          description: 'The admin user password',
        },
        firstName: { type: SchemaType.STRING, description: 'Admin first name' },
        lastName: { type: SchemaType.STRING, description: 'Admin last name' },
      },
      required: ['companyName', 'email', 'password', 'firstName', 'lastName'],
    },
  },
  {
    name: 'send_rent_reminders',
    description:
      'Send automated rent reminders to all tenants with outstanding balances for the current month. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'Optional property UUID to filter',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to proceed',
        },
      },
      required: ['confirm'],
    },
  },
  {
    name: 'create_penalty',
    description:
      'Charge a penalty (fine) to a tenant for rule violations or late payments. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        leaseId: { type: SchemaType.STRING, description: 'Lease UUID' },
        amount: { type: SchemaType.NUMBER, description: 'Penalty amount' },
        description: {
          type: SchemaType.STRING,
          description: 'Reason for the penalty',
        },
        type: {
          type: SchemaType.STRING,
          description: 'Penalty type (LATE_PAYMENT, LEASE_VIOLATION, etc)',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['leaseId', 'amount', 'description', 'confirm'],
    },
  },
  {
    name: 'archive_tenant',
    description:
      'Soft-delete a tenant record by archiving it. Use this instead of delete_tenant for typical business operations. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenantId: {
          type: SchemaType.STRING,
          description: 'The UUID of the tenant to archive',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to archive',
        },
      },
      required: ['tenantId', 'confirm'],
    },
  },
  {
    name: 'resolve_duplicates',
    description:
      'Execute a plan to resolve duplicate records. Supports merging (moving data to a primary record) and archiving redundant records. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        resolutions: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              keepId: {
                type: SchemaType.STRING,
                description: 'The UUID of the primary record to keep',
              },
              archiveIds: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: 'The UUIDs of redundant records to archive',
              },
              mergeLeases: {
                type: SchemaType.BOOLEAN,
                description:
                  'Move leases from archived records to the primary one',
              },
            },
            required: ['keepId', 'archiveIds'],
          },
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to proceed',
        },
      },
      required: ['resolutions', 'confirm'],
    },
  },
  {
    name: 'run_python_script',
    description:
      'Execute a Python script for data processing, analysis, or formatting. Use this to handle spreadsheets (xlsx/csv) or complex data transformations. DO NOT use this for OCR on images (use your native vision instead). You have access to the ./uploads directory.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        script: {
          type: SchemaType.STRING,
          description:
            'The Python script to execute. Use print() to return results to the AI.',
        },
      },
      required: ['script'],
    },
  },
  {
    name: 'bulk_create_tenants',
    description:
      'Bulk create multiple tenant records at once. Best used after formatting data with run_python_script. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenants: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              firstName: { type: SchemaType.STRING },
              lastName: { type: SchemaType.STRING },
              email: { type: SchemaType.STRING },
              phone: { type: SchemaType.STRING },
              idNumber: { type: SchemaType.STRING },
              propertyId: { type: SchemaType.STRING },
            },
            required: ['firstName', 'lastName'],
          },
        },
        defaultPropertyId: {
          type: SchemaType.STRING,
          description:
            'Optional property UUID to use if missing in individual records',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to create',
        },
      },
      required: ['tenants', 'confirm'],
    },
  },
  {
    name: 'record_arrears',
    description:
      'Directly record an identified arrear (debt) for a tenant. Use this when you find a balance in an external document (e.g. an image or PDF) that is not yet in the system. Requires confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenantId: { type: SchemaType.STRING, description: 'Tenant UUID' },
        amount: { type: SchemaType.NUMBER, description: 'Arrear amount' },
        description: {
          type: SchemaType.STRING,
          description: 'Reason or source of the arrear',
        },
        dueDate: {
          type: SchemaType.STRING,
          description: 'Optional due date (ISO). Defaults to today.',
        },
        confirm: {
          type: SchemaType.BOOLEAN,
          description: 'Must be true to record',
        },
      },
      required: ['tenantId', 'amount', 'description', 'confirm'],
    },
  },
];

export const reportTools = [
  {
    name: 'get_financial_report',
    description:
      'Get financial totals and breakdowns. Defaults to current month if dates are omitted.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dateFrom: {
          type: SchemaType.STRING,
          description:
            'ISO date string (inclusive). Defaults to start of current month.',
        },
        dateTo: {
          type: SchemaType.STRING,
          description: 'ISO date string (inclusive). Defaults to now.',
        },
        groupBy: {
          type: SchemaType.STRING,
          description: 'property | category | month | none',
        },
        include: {
          type: SchemaType.STRING,
          description: 'payments | expenses | invoices | all',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Row cap for breakdowns (default 5000)',
        },
        explain: {
          type: SchemaType.BOOLEAN,
          description: 'Include derivation details',
        },
      },
    },
  },
  {
    name: 'generate_report_file',
    description:
      'Generate a Premium Portfolio Intelligence Report (PDF) or a data export (CSV). The PDF version includes AI-driven McKinsey-grade insights, trend analysis, and professional visualizations. ALWAYS use this for "monthly reports" or "portfolio summaries".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reportType: {
          type: SchemaType.STRING,
          description: 'Summary | Revenue | Occupancy | Financial',
        },
        propertyId: {
          type: SchemaType.STRING,
          description: 'Optional property UUID for deep portfolio intelligence',
        },
        dateFrom: {
          type: SchemaType.STRING,
          description:
            'ISO date string (inclusive). Defaults to start of current month.',
        },
        dateTo: {
          type: SchemaType.STRING,
          description: 'ISO date string (inclusive). Defaults to now.',
        },
        format: {
          type: SchemaType.STRING,
          description: 'pdf | csv (default pdf)',
          enum: ['pdf', 'csv'],
        },
      },
      required: ['reportType', 'format'],
    },
  },
];

export const workflowTools = [
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
- TENANT_ONBOARDING: Checklist and document collection for a new tenant moving in.`,
        },
        targetId: {
          type: SchemaType.STRING,
          description:
            "ID of the related entity (e.g. Lease ID or Maintenance Request ID). If the workflow requires a target and the user hasn't provided one, YOU MUST ASK the user which specific entity they want to run this workflow on. If the user wants to track a NEW issue, use create_maintenance_request first to generate the ID.",
        },
      },
      required: ['type'],
    },
  },
];

const conductorTools: any[] = [
  {
    name: 'list_tenants_staged',
    description:
      'Fetches all tenants for a property and STAGES them for future processing. Returns a staging key, not the full data.',
    parameters: {
      type: 'OBJECT',
      properties: {
        propertyId: { type: 'STRING', description: 'The ID of the property' },
        jobId: {
          type: 'STRING',
          description: 'The unique orchestration job ID',
        },
      },
      required: ['propertyId', 'jobId'],
    },
  },
  {
    name: 'list_payments_staged',
    description:
      'Fetches all payments for a property and STAGES them for future processing. Returns a staging key.',
    parameters: {
      type: 'OBJECT',
      properties: {
        propertyId: { type: 'STRING', description: 'The ID of the property' },
        jobId: {
          type: 'STRING',
          description: 'The unique orchestration job ID',
        },
      },
      required: ['propertyId', 'jobId'],
    },
  },
  {
    name: 'list_invoices_staged',
    description:
      'Fetches all invoices for a property and STAGES them for future processing. Returns a staging key.',
    parameters: {
      type: 'OBJECT',
      properties: {
        propertyId: { type: 'STRING', description: 'The ID of the property' },
        jobId: {
          type: 'STRING',
          description: 'The unique orchestration job ID',
        },
      },
      required: ['propertyId', 'jobId'],
    },
  },
  {
    name: 'process_risk_analysis',
    description:
      'Reads staged tenant data, minifies it for risk assessment, and returns a high-signal risk analysis summary.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobId: {
          type: 'STRING',
          description: 'The unique orchestration job ID',
        },
        inputKey: {
          type: 'STRING',
          description: 'The key for staged raw data (e.g. "tenants")',
        },
      },
      required: ['jobId', 'inputKey'],
    },
  },
  {
    name: 'assemble_report_staged',
    description:
      'Reads multiple staged components and generates a final report. Returns only the report URL.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobId: {
          type: 'STRING',
          description: 'The unique orchestration job ID',
        },
        reportType: {
          type: 'STRING',
          description: 'Type of report (e.g. "MCKINSEY_PORTFOLIO")',
        },
        stagedKeys: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'List of staging keys to include',
        },
      },
      required: ['jobId', 'reportType', 'stagedKeys'],
    },
  },
];

export const view_version_history = {
  name: 'view_version_history',
  description: 'View the audit trail and change history for a specific entity (Tenant, Lease, or Payment).',
  parameters: {
    type: 'object',
    properties: {
      entity: { type: 'string', enum: ['Tenant', 'Lease', 'Payment'], description: 'The type of entity to view history for.' },
      targetId: { type: 'string', description: 'The unique ID of the entity.' }
    },
    required: ['entity', 'targetId']
  }
};

export const generate_history_pdf = {
  name: 'generate_history_pdf',
  description: 'Generate a professional PDF report showing the visual diffs and version history for an entity.',
  parameters: {
    type: 'object',
    properties: {
      entity: { type: 'string', enum: ['Tenant', 'Lease', 'Payment'], description: 'The entity type.' },
      targetId: { type: 'string', description: 'The entity ID.' }
    },
    required: ['entity', 'targetId']
  }
};

export const view_portfolio_history = {
  name: 'view_portfolio_history',
  description: 'View the comprehensive audit trail for the entire portfolio/company. Can be filtered by entity type.',
  parameters: {
    type: 'object',
    properties: {
      entity: {
        type: 'string',
        enum: ['Tenant', 'Lease', 'Payment', 'Property', 'Unit'],
        description: 'Optional entity type filter.',
      },
      limit: {
        type: 'number',
        description: 'Number of entries to retrieve (default 20).',
      },
    },
  },
};

export const rollback_change = {
  name: 'rollback_change',
  description: 'Revert an entity record to a previous state using a specific audit log entry ID.',
  parameters: {
    type: 'object',
    properties: {
      auditLogId: { type: 'string', description: 'The ID of the audit log entry (version) to rollback to.' }
    },
    required: ['auditLogId']
  }
};

export const agent_initiate = {
  name: 'agent_initiate',
  description: 'Start an autonomous long-running agent to handle a complex, multi-step goal (e.g. processing a 74-page document).',
  parameters: {
    type: 'object',
    properties: {
      goal: { type: 'string', description: 'The overall goal for the agent' },
    },
    required: ['goal'],
  },
};

export const historyTools = [
  view_version_history,
  view_portfolio_history,
  generate_history_pdf,
  rollback_change,
  agent_initiate,
];

export const allToolDeclarations = [
  ...coreReadTools,
  ...coreWriteTools,
  ...reportTools,
  ...workflowTools,
  ...conductorTools,
  ...historyTools,
];

export const buildModels = (
  genAI: GoogleGenerativeAI,
  systemInstruction: string,
  modelName?: string,
) => {
  const selectedModel = (modelName || '').trim() || BASE_MODEL;
  const allTools = allToolDeclarations;
  console.log(
    `[AiTools] Initializing models with ${allTools.length} tools total.`,
  );

  return {
    read: genAI.getGenerativeModel({
      model: selectedModel,
      tools: buildTools(allTools) as any,
      systemInstruction,
    }),
    write: genAI.getGenerativeModel({
      model: selectedModel,
      tools: buildTools(allTools) as any,
      systemInstruction,
    }),
    report: genAI.getGenerativeModel({
      model: selectedModel,
      tools: buildTools(allTools) as any,
      systemInstruction,
    }),
    gemma: genAI.getGenerativeModel({
      model: 'gemma-2-2b-it',
      tools: buildTools(allTools) as any,
      systemInstruction,
    }),
  };
};
