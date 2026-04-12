import { SchemaType } from '@google/generative-ai';

export const AI_TOOL_DEFINITIONS = [
  {
    name: 'get_unit_details',
    description: 'Get detailed information about a specific unit, including its status and current tenant.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        unitId: { type: SchemaType.STRING, description: 'The UUID of the unit' },
        unitNumber: { type: SchemaType.STRING, description: 'The unit number (e.g. B4)' },
        propertyId: { type: SchemaType.STRING, description: 'The UUID of the property' },
      },
    },
  },
  {
    name: 'search_tenants',
    description: 'Search for tenants by name, phone, or ID number.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'The search query (name, phone, or ID)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_tenant_arrears',
    description: 'Get the current balance and payment history for a tenant.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenantId: { type: SchemaType.STRING, description: 'The UUID of the tenant' },
        tenantName: { type: SchemaType.STRING, description: 'Full name of the tenant' },
      },
    },
  },
  {
    name: 'list_properties',
    description: 'List all properties managed by the company.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'log_maintenance_issue',
    description: 'Log a new maintenance issue report from a tenant.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        unitNumber: { type: SchemaType.STRING, description: 'The unit number where the issue is' },
        description: { type: SchemaType.STRING, description: 'Detailed description of the issue' },
        isUrgent: { type: SchemaType.BOOLEAN, description: 'Whether the issue is an emergency' },
      },
      required: ['description', 'unitNumber'],
    },
  },
  {
    name: 'register_tenant',
    description: 'Register a new tenant in the system.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        firstName: { type: SchemaType.STRING },
        lastName: { type: SchemaType.STRING },
        phoneNumber: { type: SchemaType.STRING },
        email: { type: SchemaType.STRING },
        idNumber: { type: SchemaType.STRING },
      },
      required: ['firstName', 'lastName', 'phoneNumber'],
    },
  },
  {
    name: 'create_lease',
    description: 'Create a new lease agreement for a tenant.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tenantId: { type: SchemaType.STRING },
        unitId: { type: SchemaType.STRING },
        startDate: { type: SchemaType.STRING, description: 'ISO date string' },
        rentAmount: { type: SchemaType.NUMBER },
        depositAmount: { type: SchemaType.NUMBER },
      },
      required: ['tenantId', 'unitId', 'rentAmount'],
    },
  },
];
