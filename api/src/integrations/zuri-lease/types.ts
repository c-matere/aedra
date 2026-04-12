export interface ZuriLeaseLandlord {
  id: string;
  name: string;
  pin?: string;
  address?: string;
}

export interface ZuriLeasePayment {
  code: string;
  date: string;
  description: string;
  status: string;
  grossAmount: number;
  deductions: number;
  netAmount: number;
}

export interface ZuriLeaseLease {
  tenantId?: string;
  tenantName: string;
  unitCode: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface ZuriLeaseReceipt {
  code: string;
  date: string;
  amount: number;
  description: string;
  status: string;
}

export interface ZuriLeaseInvoice {
  code: string;
  date: string;
  dueDate: string;
  amount: number;
  description: string;
  status: string;
}

export interface ZuriLeaseProperty {
  id: string;
  code: string;
  alias: string;
  plotNo: string;
  class: string;
  type: string;
  category: string;
  location: {
    country: string;
    region: string;
    town: string;
    area: string;
  };
  contract: {
    manager: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  landlord?: ZuriLeaseLandlord;
}

export interface ZuriLeaseUnit {
  unitId: string;
  unitCode: string;
  unitType: string;
  rent: number;
  occupancyTenantName?: string;
  occupancyTenantId?: string;
  balance: number;
  leases?: ZuriLeaseLease[];
}

export interface ZuriLeaseTenant {
  id: string;
  name: string;
  idNo?: string;
  companyName?: string;
  acNo?: string;
  registrationDetails?: string;
  contacts?: string[];
  phone?: string;
  rent: number;
  depositHeld: number;
  leaseStartDate: string;
  leaseEndDate: string;
  autoRenew: boolean;
  paymentFrequency: string;
  unitCode?: string;
  unitName?: string;
  receipts?: ZuriLeaseReceipt[];
  invoices?: ZuriLeaseInvoice[];
}

export interface ZuriLeaseData {
  property: ZuriLeaseProperty;
  units: ZuriLeaseUnit[];
  tenants: ZuriLeaseTenant[];
  payments: ZuriLeasePayment[];
}
