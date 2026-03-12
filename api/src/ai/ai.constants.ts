export const ALLOWED_UNIT_STATUS = ['VACANT', 'OCCUPIED', 'UNDER_MAINTENANCE', 'VACATING'] as const;
export const ALLOWED_LEASE_STATUS = ['ACTIVE', 'EXPIRED', 'TERMINATED', 'PENDING'] as const;
export const ALLOWED_MAINTENANCE_STATUS = [
    'REPORTED',
    'ACKNOWLEDGED',
    'IN_PROGRESS',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED',
] as const;
export const ALLOWED_MAINTENANCE_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
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
] as const;
export const ALLOWED_PAYMENT_METHOD = ['MPESA', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'OTHER'] as const;
export const ALLOWED_PAYMENT_TYPE = ['RENT', 'DEPOSIT', 'PENALTY', 'UTILITY', 'OTHER'] as const;
export const ALLOWED_INVOICE_TYPE = ['RENT', 'MAINTENANCE', 'PENALTY', 'UTILITY', 'OTHER'] as const;
export const ALLOWED_INVOICE_STATUS = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'PARTIALLY_PAID'] as const;
export const ALLOWED_REPORT_GROUP_BY = ['property', 'category', 'month', 'none'] as const;
export const ALLOWED_REPORT_INCLUDE = ['payments', 'expenses', 'invoices', 'all'] as const;
