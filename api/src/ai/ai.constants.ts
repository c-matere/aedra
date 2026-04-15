export const AI_BACKGROUND_QUEUE = 'ai-background-operations';

export const ALLOWED_REPORT_GROUP_BY = ['none', 'property', 'month'];
export const ALLOWED_REPORT_INCLUDE = [
  'all',
  'payments',
  'expenses',
  'invoices',
];

export const ALLOWED_LEASE_STATUS = [
  'PENDING',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'CANCELLED',
];
export const ALLOWED_UNIT_STATUS = [
  'VACANT',
  'OCCUPIED',
  'UNDER_MAINTENANCE',
  'UNAVAILABLE',
];
export const ALLOWED_MAINTENANCE_STATUS = [
  'REPORTED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
];
export const ALLOWED_MAINTENANCE_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const ALLOWED_MAINTENANCE_CATEGORY = [
  'PLUMBING',
  'ELECTRICAL',
  'STRUCTURAL',
  'PAINTING',
  'APPLIANCE',
  'PEST_CONTROL',
  'HVAC',
  'ROOFING',
  'FLOORING',
  'GENERAL',
  'OTHER',
];

export const ALLOWED_INVOICE_STATUS = [
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'PARTIALLY_PAID',
];
export const ALLOWED_INVOICE_TYPE = [
  'RENT',
  'DEPOSIT',
  'PENALTY',
  'UTILITY',
  'SERVICE_CHARGE',
  'REPAIR',
  'OTHER',
];

export const ALLOWED_PAYMENT_METHOD = [
  'MPESA',
  'BANK_TRANSFER',
  'CASH',
  'CHEQUE',
  'OTHER',
];
export const ALLOWED_PAYMENT_TYPE = [
  'RENT',
  'DEPOSIT',
  'PENALTY',
  'UTILITY',
  'SERVICE_CHARGE',
  'REPAIR',
  'OTHER',
];
