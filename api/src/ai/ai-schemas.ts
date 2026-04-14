import { SchemaType } from '@google/generative-ai';

/**
 * Technical schema for Gemini Structured Outputs.
 * This ensures the LLM always returns a valid UnifiedPlan object.
 */
export const UNIFIED_PLAN_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    intent: {
      type: SchemaType.STRING,
      description: 'The classified intent of the user message',
      enum: [
        'MAINTENANCE_REQUEST',
        'TENANT_COMPLAINT',
        'PAYMENT_PROMISE',
        'PAYMENT_DECLARATION',
        'FINANCIAL_QUERY',
        'FINANCIAL_REPORTING',
        'ONBOARDING',
        'GENERAL_QUERY',
        'DISPUTE',
        'EMERGENCY',
        'UTILITY_OUTAGE',
        'REVENUE_REPORT',
        'REGISTER_COMPANY'
      ],
    },
    priority: {
      type: SchemaType.STRING,
      enum: ['NORMAL', 'HIGH', 'EMERGENCY'],
    },
    language: {
      type: SchemaType.STRING,
      enum: ['en', 'sw', 'mixed'],
    },
    immediateResponse: {
      type: SchemaType.STRING,
      description: 'Optional immediate acknowledgement or safety instructions',
    },
    entities: {
      type: SchemaType.OBJECT,
      properties: {
        tenantName: { type: SchemaType.STRING },
        unitNumber: { type: SchemaType.STRING },
        propertyName: { type: SchemaType.STRING },
        amount: { type: SchemaType.NUMBER },
        date: { type: SchemaType.STRING },
        issueDescription: { type: SchemaType.STRING, description: 'Brief summary of the maintenance/issue' },
        unitCount: { type: SchemaType.NUMBER },
        propertyAddress: { type: SchemaType.STRING },
        email: { type: SchemaType.STRING },
        password: { type: SchemaType.STRING },
        firstName: { type: SchemaType.STRING },
        lastName: { type: SchemaType.STRING },
        companyName: { type: SchemaType.STRING },
      },
    },
    steps: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          tool: { type: SchemaType.STRING, description: 'Name of the tool to execute' },
          args: { type: SchemaType.OBJECT, description: 'Arguments for the tool' },
          dependsOn: { type: SchemaType.STRING, description: 'Optional: name of the tool this step depends on' },
          required: { type: SchemaType.BOOLEAN, description: 'If true, failure stops execution' },
        },
        required: ['tool', 'args', 'required'],
      },
    },
    planReasoning: {
      type: SchemaType.STRING,
      description: 'Internal rationale for this specific action plan',
    },
  },
  required: ['intent', 'priority', 'language', 'steps'],
};

export const TAKEOVER_ADVICE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    text: {
      type: SchemaType.STRING,
      description: 'The advice text for the human agent',
    },
    suggestions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          tool: { type: SchemaType.STRING },
          args: { type: SchemaType.OBJECT },
        },
        required: ['label', 'tool', 'args'],
      },
    },
  },
  required: ['text', 'suggestions'],
};
