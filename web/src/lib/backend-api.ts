import { isUserRole, type UserRole } from "@/lib/rbac";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface BackendUserContext {
  id: string;
  role: UserRole;
  companyId?: string;
}

export interface MeResponse {
  user: UserRecord;
}

export interface AdminSettingsResponse {
  message: string;
  requiredRoles: UserRole[];
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  action: string;
  outcome: string;
  method: string;
  path: string;
  entity?: string;
  targetId?: string;
  actorId?: string;
  actorRole?: string;
  actorCompanyId?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: any;
}

export interface AuditLogsResponse {
  logs: AuditLogRecord[];
  filters: any;
}

export interface BackendRequestResult<T> {
  data: T | null;
  status: number;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PropertyRecord {
  id: string;
  name: string;
  address?: string;
  propertyType?: string;
  status?: string;
  totalUnits?: number;
  occupiedUnits?: number;
  vacatingUnits?: number;
  monthlyRevenue?: number;
  latitude?: number;
  longitude?: number;
  description?: string;
  location?: string;
  commissionPercentage?: number;
  landlord?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  units?: {
    id: string;
    unitNumber: string;
    status: string;
    rentAmount?: number;
    bedrooms?: number;
    bathrooms?: number;
  }[];
}

export interface TenantRecord {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status?: string;
  unitNumber?: string;
  propertyName?: string;
  propertyId?: string;
  tenantCode?: string;
  idNumber?: string;
  companyId: string;
  rentAmount?: number;
  leaseEnd?: string;
}

export interface LandlordRecord {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  address?: string;
}

export interface UnitRecord {
  id: string;
  unitNumber: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  rentAmount?: number;
  propertyId: string;
  status: string;
  property?: {
    id: string;
    name: string;
    address?: string;
  };
  leases?: (LeaseRecord & {
    tenant: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
    };
    payments: PaymentRecord[];
    invoices: InvoiceRecord[];
  })[];
}

export interface ExpenseRecord {
  id: string;
  description: string;
  amount: number;
  category?: string;
  date?: string;
  vendor?: string;
  reference?: string;
  notes?: string;
  propertyId?: string;
  unitId?: string;
}

export interface LeaseRecord {
  id: string;
  tenantId: string;
  unitId: string;
  rentAmount: number;
  status: string;
  propertyId?: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  unit?: {
    id: string;
    unitNumber: string;
  };
  startDate?: string;
  endDate?: string;
  deposit?: number;
  balance?: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  leaseId: string;
  method: string;
  type: string;
  reference?: string;
  notes?: string;
  paidAt: string;
  lease?: {
    id: string;
    tenant?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
}

export type InvoiceType = "RENT" | "MAINTENANCE" | "PENALTY" | "UTILITY" | "OTHER";

export interface InvoiceRecord {
  id: string;
  amount: number;
  description: string;
  type: InvoiceType;
  dueDate: string;
  status: string;
  leaseId: string;
  lease?: {
    id: string;
    tenant?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface MaintenanceRequestRecord {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  estimatedCost?: number;
  actualCost?: number;
  vendor?: string;
  vendorPhone?: string;
  notes?: string;
  propertyId: string;
  unitId?: string;
  scheduledAt?: string;
  completedAt?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  permissions: string[];
  companyId?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  pinNumber?: string;
  logo?: string;
  isActive: boolean;
  // Security settings
  sessionDurationHours: number;
  passwordPolicy: string;
  twoFactorAuthEnabled: boolean;
  ipAllowlist?: string;
  // Notification settings
  rentReminderDaysBefore: number;
  leaseExpiryAlertDaysBefore: number;
  paymentReceiptsEnabled: boolean;
  maintenanceUpdatesEnabled: boolean;
  // Integration settings
  smsProvider: string;
  africaTalkingUsername: string | null;
  africaTalkingApiKey: string | null;
  mapProvider: string;
  mapboxAccessToken: string | null;
  mpesaConsumerKey: string | null;
  mpesaConsumerSecret: string | null;
  mpesaPasskey: string | null;
  mpesaShortcode: string | null;
  mpesaEnvironment: string | null;
  autoInvoicingEnabled: boolean;
  invoicingDay: number;
  zuriDomain: string | null;
  zuriUsername: string | null;
  zuriPassword: string | null;
}

export interface RoleRecord {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  companyId?: string;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permissions: string[];
}

export interface PropertyAssignmentRecord {
  id: string;
  userId: string;
  propertyId: string;
  companyId?: string;
  property?: {
    id: string;
    name: string;
    address?: string;
    location?: string;
  };
}

export interface UpdateCompanyPayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string | null;
  pinNumber?: string;
  waAccessToken?: string;
  // Security settings
  sessionDurationHours?: number;
  passwordPolicy?: string;
  twoFactorAuthEnabled?: boolean;
  ipAllowlist?: string;
  // Notification settings
  rentReminderDaysBefore?: number;
  leaseExpiryAlertDaysBefore?: number;
  paymentReceiptsEnabled?: boolean;
  maintenanceUpdatesEnabled?: boolean;
  // Integration settings
  smsProvider?: string;
  africaTalkingUsername?: string | null;
  africaTalkingApiKey?: string | null;
  mapProvider?: string;
  mapboxAccessToken?: string | null;
  mpesaConsumerKey?: string | null;
  mpesaConsumerSecret?: string | null;
  mpesaPasskey?: string | null;
  mpesaShortcode?: string | null;
  mpesaEnvironment?: string | null;
  autoInvoicingEnabled?: boolean;
  invoicingDay?: number;
  zuriDomain?: string;
  zuriUsername?: string;
  zuriPassword?: string;
}

export interface CreatePropertyPayload {
  name: string;
  address?: string;
  location?: string;
  propertyType?: string;
  description?: string;
  commissionPercentage?: number;
  landlord?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  unitBatches?: {
    prefix: string;
    count: number;
    bedrooms?: number;
    bathrooms?: number;
    rentAmount?: number;
  }[];
}

export interface UpdatePropertyPayload {
  name?: string;
  address?: string;
  location?: string;
  propertyType?: string;
  description?: string;
  commissionPercentage?: number;
}

export interface CreateTenantPayload {
  firstName: string;
  lastName: string;
  email?: string;
  propertyId: string;
  tenantCode?: string;
}

export interface UpdateTenantPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  propertyId?: string;
  tenantCode?: string;
}

export interface CreateLandlordPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  address?: string;
  propertyIds?: string[];
}

export interface UpdateLandlordPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  address?: string;
}

export interface CreateUnitPayload {
  unitNumber: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  rentAmount?: number;
  propertyId: string;
}

export type UnitStatus = "VACANT" | "OCCUPIED" | "UNDER_MAINTENANCE" | "VACATING";

export interface UpdateUnitPayload {
  unitNumber?: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  rentAmount?: number;
  propertyId?: string;
  status?: UnitStatus;
}

export interface CreateExpensePayload {
  description: string;
  amount: number;
  category?: string;
  vendor?: string;
  reference?: string;
  notes?: string;
  propertyId?: string;
  unitId?: string;
}

export interface UpdateExpensePayload {
  description?: string;
  amount?: number;
  category?: string;
  vendor?: string;
  reference?: string;
  notes?: string;
  propertyId?: string;
  unitId?: string;
}

export interface CreatePaymentPayload {
  amount: number;
  leaseId: string;
  paidAt?: string;
  method?: string;
  type?: string;
  reference?: string;
  notes?: string;
}

export interface UpdatePaymentPayload {
  amount?: number;
  leaseId?: string;
  paidAt?: string;
  method?: string;
  type?: string;
  reference?: string;
  notes?: string;
}

export interface CreateInvoicePayload {
  amount: number;
  description: string;
  dueDate: string;
  type?: InvoiceType;
  status?: string;
  leaseId: string;
}

export interface UpdateInvoicePayload {
  amount?: number;
  description?: string;
  dueDate?: string;
  type?: InvoiceType;
  status?: string;
  leaseId?: string;
}

export interface CreateLeasePayload {
  startDate: string;
  endDate?: string;
  rentAmount: number;
  deposit?: number;
  status?: string;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  newTenant?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    idNumber?: string;
    tenantCode?: string;
    companyId?: string;
  };
  notes?: string;
  reminders?: { text: string; remindAt: string }[];
  agreementFee?: number;
}

export interface UpdateLeasePayload {
  startDate?: string;
  endDate?: string;
  rentAmount?: number;
  deposit?: number;
  status?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
}

export interface CreateMaintenanceRequestPayload {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  estimatedCost?: number;
  actualCost?: number;
  vendor?: string;
  vendorPhone?: string;
  notes?: string;
  propertyId: string;
  unitId?: string;
  scheduledAt?: string;
  completedAt?: string;
}

export interface UpdateMaintenanceRequestPayload {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  estimatedCost?: number;
  actualCost?: number;
  vendor?: string;
  vendorPhone?: string;
  notes?: string;
  propertyId?: string;
  unitId?: string;
  scheduledAt?: string;
  completedAt?: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
  companyId?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  companyId?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface RegisterCompanyPayload {
  companyName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface InvitationRecord {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  token: string;
  companyId?: string;
  expiresAt: string;
  usedAt?: string;
  company?: {
    id: string;
    name: string;
  };
}

export interface TenantStatementRecord {
  company: CompanyRecord;
  tenant: TenantRecord;
  property: PropertyRecord;
  unit: { unitNumber: string };
  lease: {
    id: string;
    startDate: string;
    endDate?: string;
    rentAmount: number;
    deposit?: number;
    status: string;
  };
  range: { start: string; end: string };
  openingBalance: number;
  closingBalance: number;
  ledger: {
    id: string;
    date: string;
    code: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    type: string;
  }[];
  summaries: {
    invoices: { type: string; amount: number }[];
    payments: { type: string; amount: number }[];
  };
}

export interface AcceptInvitationPayload {
  firstName: string;
  lastName: string;
  password: string;
}

export const TARGET_ENDPOINTS = {
  me: "/me",
  adminSettings: "/admin/settings",
  auditLogs: "/admin/audit-logs",
  properties: "/properties",
  tenants: "/tenants",
  landlords: "/landlords",
  units: "/units",
  expenses: "/expenses",
  leases: "/leases",
  payments: "/payments",
  invoices: "/invoices",
  maintenanceRequests: "/maintenance-requests",
  users: "/users",
  companies: "/companies",
  documents: "/documents",
  reports: "/reports",
  registerCompany: "/auth/register-company",
  invite: "/users/invite",
  verifyInvite: "/users/invite/verify",
  acceptInvite: "/users/invite/accept",
  listInvitations: "/users/invitations",
  aiChat: "/ai/chat",
  listActiveWorkflows: "/ai/workflows/active",
  officeSummary: "/finances/office/summary",
  officeIncome: "/finances/office/income",
  officeExpenses: "/finances/office/expenses",
  chatSessions: "/ai/chat/sessions",
  roles: "/roles",
  staffAssignments: "/staff",
  zuriSync: "/integrations/zuri-lease/trigger-sync",
} as const;

export function backendBaseUrl(): string {
  const raw =
    process.env.AEDRA_API_URL ??
    process.env.NEXT_PUBLIC_AEDRA_API_URL ??
    "http://localhost:4001";

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function getLogoUrl(logo?: string | null): string | null {
  if (!logo) return null;
  if (logo.startsWith("http")) return logo;
  const base = backendBaseUrl();
  const normalizedLogo = logo.startsWith("/") ? logo : "/" + logo;
  return `${base}${normalizedLogo}`;
}

async function backendGet<T>(
  path: string,
  token: string,
): Promise<BackendRequestResult<T>> {
  return backendRequest<T>(path, token, "GET");
}

async function backendRequest<T>(
  path: string,
  sessionToken: string,
  method: HttpMethod,
  payload?: unknown,
): Promise<BackendRequestResult<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }

    const response = await fetch(`${backendBaseUrl()}${path}`, {
      method,
      cache: "no-store",
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `Backend request failed (${response.status})`;
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.message === "string") {
          errorMessage = errorBody.message;
        } else if (Array.isArray(errorBody?.message)) {
          errorMessage = errorBody.message.join("; ");
        } else if (typeof errorBody?.error === "string") {
          errorMessage = errorBody.error;
        }
      } catch {
        // Ignore JSON parse errors and fall back to generic message.
      }
      return {
        data: null,
        status: response.status,
        error: errorMessage,
      };
    }

    if (response.status === 204) {
      return {
        data: null,
        status: response.status,
        error: null,
      };
    }

    const data = (await response.json()) as T;
    return {
      data,
      status: response.status,
      error: null,
    };
  } catch {
    return {
      data: null,
      status: 503,
      error: "Unable to reach backend API",
    };
  }
}

export async function fetchMe(
  token: string,
): Promise<BackendRequestResult<MeResponse>> {
  return backendGet<MeResponse>(TARGET_ENDPOINTS.me, token);
}

export async function updateMe(
  token: string,
  payload: Partial<CreateUserPayload>,
): Promise<BackendRequestResult<UserRecord>> {
  return backendRequest<UserRecord>(TARGET_ENDPOINTS.me, token, "PATCH", payload);
}

export async function fetchAdminSettings(
  token: string,
): Promise<BackendRequestResult<AdminSettingsResponse>> {
  return backendGet<AdminSettingsResponse>(TARGET_ENDPOINTS.adminSettings, token);
}

export async function fetchAuditLogs(
  token: string,
): Promise<BackendRequestResult<AuditLogsResponse>> {
  return backendGet<AuditLogsResponse>(TARGET_ENDPOINTS.auditLogs, token);
}

export async function listProperties(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<PropertyRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.properties}?${qs}` : TARGET_ENDPOINTS.properties;
  return backendRequest<PaginatedResponse<PropertyRecord>>(path, token, "GET");
}

export async function getPropertyById(
  token: string,
  id: string,
): Promise<BackendRequestResult<PropertyRecord>> {
  return backendRequest<PropertyRecord>(`${TARGET_ENDPOINTS.properties}/${id}`, token, "GET");
}

export async function createProperty(
  token: string,
  payload: CreatePropertyPayload,
): Promise<BackendRequestResult<PropertyRecord>> {
  return backendRequest<PropertyRecord>(TARGET_ENDPOINTS.properties, token, "POST", payload);
}

export async function updateProperty(
  token: string,
  id: string,
  payload: UpdatePropertyPayload,
): Promise<BackendRequestResult<PropertyRecord>> {
  return backendRequest<PropertyRecord>(
    `${TARGET_ENDPOINTS.properties}/${id}`,
    token,
    "PATCH",
    payload,
  );
}

export async function deleteProperty(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.properties}/${id}`, token, "DELETE");
}

export async function listTenants(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<TenantRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.tenants}?${qs}` : TARGET_ENDPOINTS.tenants;
  return backendRequest<PaginatedResponse<TenantRecord>>(path, token, "GET");
}

export async function getTenantById(
  token: string,
  id: string,
): Promise<BackendRequestResult<TenantRecord>> {
  return backendRequest<TenantRecord>(`${TARGET_ENDPOINTS.tenants}/${id}`, token, "GET");
}

export async function createTenant(
  token: string,
  payload: CreateTenantPayload,
): Promise<BackendRequestResult<TenantRecord>> {
  return backendRequest<TenantRecord>(TARGET_ENDPOINTS.tenants, token, "POST", payload);
}

export async function updateTenant(
  token: string,
  id: string,
  payload: UpdateTenantPayload,
): Promise<BackendRequestResult<TenantRecord>> {
  return backendRequest<TenantRecord>(`${TARGET_ENDPOINTS.tenants}/${id}`, token, "PATCH", payload);
}

export async function deleteTenant(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.tenants}/${id}`, token, "DELETE");
}

export async function listLandlords(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<LandlordRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.landlords}?${qs}` : TARGET_ENDPOINTS.landlords;
  return backendRequest<PaginatedResponse<LandlordRecord>>(path, token, "GET");
}

export async function createLandlord(
  token: string,
  payload: CreateLandlordPayload,
): Promise<BackendRequestResult<LandlordRecord>> {
  return backendRequest<LandlordRecord>(TARGET_ENDPOINTS.landlords, token, "POST", payload);
}

export async function updateLandlord(
  token: string,
  id: string,
  payload: UpdateLandlordPayload,
): Promise<BackendRequestResult<LandlordRecord>> {
  return backendRequest<LandlordRecord>(`${TARGET_ENDPOINTS.landlords}/${id}`, token, "PATCH", payload);
}

export async function deleteLandlord(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.landlords}/${id}`, token, "DELETE");
}

export async function listUnits(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<UnitRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.units}?${qs}` : TARGET_ENDPOINTS.units;
  return backendRequest<PaginatedResponse<UnitRecord>>(path, token, "GET");
}

export async function createUnit(
  token: string,
  payload: CreateUnitPayload,
): Promise<BackendRequestResult<UnitRecord>> {
  return backendRequest<UnitRecord>(TARGET_ENDPOINTS.units, token, "POST", payload);
}

export async function updateUnit(
  token: string,
  id: string,
  payload: UpdateUnitPayload,
): Promise<BackendRequestResult<UnitRecord>> {
  return backendRequest<UnitRecord>(`${TARGET_ENDPOINTS.units}/${id}`, token, "PATCH", payload);
}

export async function getUnitById(
  token: string,
  id: string,
): Promise<BackendRequestResult<UnitRecord>> {
  return backendRequest<UnitRecord>(`${TARGET_ENDPOINTS.units}/${id}`, token, "GET");
}

export async function deleteUnit(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.units}/${id}`, token, "DELETE");
}

export async function listExpenses(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<ExpenseRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.expenses}?${qs}` : TARGET_ENDPOINTS.expenses;
  return backendRequest<PaginatedResponse<ExpenseRecord>>(path, token, "GET");
}

export async function createExpense(
  token: string,
  payload: CreateExpensePayload,
): Promise<BackendRequestResult<ExpenseRecord>> {
  return backendRequest<ExpenseRecord>(TARGET_ENDPOINTS.expenses, token, "POST", payload);
}

export async function updateExpense(
  token: string,
  id: string,
  payload: UpdateExpensePayload,
): Promise<BackendRequestResult<ExpenseRecord>> {
  return backendRequest<ExpenseRecord>(`${TARGET_ENDPOINTS.expenses}/${id}`, token, "PATCH", payload);
}

export async function deleteExpense(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.expenses}/${id}`, token, "DELETE");
}

export async function listLeases(
  token: string,
  params?: { page?: number; limit?: number; search?: string; tenantId?: string },
): Promise<BackendRequestResult<PaginatedResponse<LeaseRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);
  if (params?.tenantId) query.append("tenantId", params.tenantId);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.leases}?${qs}` : TARGET_ENDPOINTS.leases;
  return backendRequest<PaginatedResponse<LeaseRecord>>(path, token, "GET");
}

export async function createLease(
  token: string,
  payload: CreateLeasePayload,
): Promise<BackendRequestResult<LeaseRecord>> {
  return backendRequest<LeaseRecord>(TARGET_ENDPOINTS.leases, token, "POST", payload);
}

export async function updateLease(
  token: string,
  id: string,
  payload: UpdateLeasePayload,
): Promise<BackendRequestResult<LeaseRecord>> {
  return backendRequest<LeaseRecord>(`${TARGET_ENDPOINTS.leases}/${id}`, token, "PATCH", payload);
}

export async function deleteLease(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.leases}/${id}`, token, "DELETE");
}

export async function listPayments(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<PaymentRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.payments}?${qs}` : TARGET_ENDPOINTS.payments;
  return backendRequest<PaginatedResponse<PaymentRecord>>(path, token, "GET");
}

export async function createPayment(
  token: string,
  payload: CreatePaymentPayload,
): Promise<BackendRequestResult<PaymentRecord>> {
  return backendRequest<PaymentRecord>(TARGET_ENDPOINTS.payments, token, "POST", payload);
}

export async function updatePayment(
  token: string,
  id: string,
  payload: UpdatePaymentPayload,
): Promise<BackendRequestResult<PaymentRecord>> {
  return backendRequest<PaymentRecord>(`${TARGET_ENDPOINTS.payments}/${id}`, token, "PATCH", payload);
}

export async function deletePayment(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.payments}/${id}`, token, "DELETE");
}

export async function listInvoices(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<InvoiceRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.invoices}?${qs}` : TARGET_ENDPOINTS.invoices;
  return backendRequest<PaginatedResponse<InvoiceRecord>>(path, token, "GET");
}

export async function createInvoice(
  token: string,
  payload: CreateInvoicePayload,
): Promise<BackendRequestResult<InvoiceRecord>> {
  return backendRequest<InvoiceRecord>(TARGET_ENDPOINTS.invoices, token, "POST", payload);
}

export async function updateInvoice(
  token: string,
  id: string,
  payload: UpdateInvoicePayload,
): Promise<BackendRequestResult<InvoiceRecord>> {
  return backendRequest<InvoiceRecord>(`${TARGET_ENDPOINTS.invoices}/${id}`, token, "PATCH", payload);
}

export async function deleteInvoice(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.invoices}/${id}`, token, "DELETE");
}

export async function listMaintenanceRequests(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<MaintenanceRequestRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.maintenanceRequests}?${qs}` : TARGET_ENDPOINTS.maintenanceRequests;
  return backendRequest<PaginatedResponse<MaintenanceRequestRecord>>(path, token, "GET");
}

export async function createMaintenanceRequest(
  token: string,
  payload: CreateMaintenanceRequestPayload,
): Promise<BackendRequestResult<MaintenanceRequestRecord>> {
  return backendRequest<MaintenanceRequestRecord>(
    TARGET_ENDPOINTS.maintenanceRequests,
    token,
    "POST",
    payload,
  );
}

export async function updateMaintenanceRequest(
  token: string,
  id: string,
  payload: UpdateMaintenanceRequestPayload,
): Promise<BackendRequestResult<MaintenanceRequestRecord>> {
  return backendRequest<MaintenanceRequestRecord>(
    `${TARGET_ENDPOINTS.maintenanceRequests}/${id}`,
    token,
    "PATCH",
    payload,
  );
}

export async function deleteMaintenanceRequest(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(
    `${TARGET_ENDPOINTS.maintenanceRequests}/${id}`,
    token,
    "DELETE",
  );
}

export async function listUsers(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<UserRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.users}?${qs}` : TARGET_ENDPOINTS.users;
  return backendRequest<PaginatedResponse<UserRecord>>(path, token, "GET");
}

export async function createUser(
  token: string,
  payload: CreateUserPayload,
): Promise<BackendRequestResult<UserRecord>> {
  return backendRequest<UserRecord>(TARGET_ENDPOINTS.users, token, "POST", payload);
}

export async function updateUser(
  token: string,
  id: string,
  payload: UpdateUserPayload,
): Promise<BackendRequestResult<UserRecord>> {
  return backendRequest<UserRecord>(`${TARGET_ENDPOINTS.users}/${id}`, token, "PATCH", payload);
}

export async function deleteUser(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.users}/${id}`, token, "DELETE");
}

// Companies
export async function getCompany(
  token: string,
  id: string,
): Promise<BackendRequestResult<CompanyRecord>> {
  return backendRequest<CompanyRecord>(`${TARGET_ENDPOINTS.companies}/${id}`, token, "GET");
}

export async function listCompanies(
  token: string,
): Promise<BackendRequestResult<CompanyRecord[]>> {
  return backendRequest<CompanyRecord[]>(TARGET_ENDPOINTS.companies, token, "GET");
}

export async function updateCompany(
  token: string,
  id: string,
  payload: UpdateCompanyPayload,
): Promise<BackendRequestResult<CompanyRecord>> {
  return backendRequest<CompanyRecord>(
    `${TARGET_ENDPOINTS.companies}/${id}`,
    token,
    "PATCH",
    payload,
  );
}

export async function testMpesaConnection(
  token: string,
  id: string,
  payload?: UpdateCompanyPayload,
): Promise<BackendRequestResult<{ success: boolean; message: string }>> {
  return backendRequest<{ success: boolean; message: string }>(
    `${TARGET_ENDPOINTS.companies}/${id}/test-mpesa`,
    token,
    "POST",
    payload,
  );
}

export async function testSmsConnection(
  token: string,
  id: string,
  payload?: UpdateCompanyPayload,
): Promise<BackendRequestResult<{ success: boolean; message: string }>> {
  return backendRequest<{ success: boolean; message: string }>(
    `${TARGET_ENDPOINTS.companies}/${id}/test-sms`,
    token,
    "POST",
    payload,
  );
}

export async function testMapsConnection(
  token: string,
  id: string,
  payload?: UpdateCompanyPayload,
): Promise<BackendRequestResult<{ success: boolean; message: string }>> {
  return backendRequest<{ success: boolean; message: string }>(
    `${TARGET_ENDPOINTS.companies}/${id}/test-maps`,
    token,
    "POST",
    payload,
  );
}

// Reports
export interface ReportSummary {
  properties: number;
  units: number;
  tenants: number;
  activeLeases: number;
}

export interface ReportOccupancy {
  VACANT: number;
  OCCUPIED: number;
  UNDER_MAINTENANCE: number;
}

export interface ReportRevenue {
  totalRevenue: number;
  totalInvoiced: number;
  unpaidBalance: number;
}

export async function fetchReportSummary(
  token: string,
): Promise<BackendRequestResult<ReportSummary>> {
  return backendGet<ReportSummary>(`${TARGET_ENDPOINTS.reports}/summary`, token);
}

export async function fetchReportOccupancy(
  token: string,
): Promise<BackendRequestResult<ReportOccupancy>> {
  return backendGet<ReportOccupancy>(`${TARGET_ENDPOINTS.reports}/occupancy`, token);
}

export async function fetchReportRevenue(
  token: string,
): Promise<BackendRequestResult<ReportRevenue>> {
  return backendGet<ReportRevenue>(`${TARGET_ENDPOINTS.reports}/revenue`, token);
}

export interface PortfolioReportData {
  property: {
    id: string;
    name: string;
    manager: string;
    address: string;
    commissionPercentage: number;
  };
  totals: {
    occupancy: number;
    invoices: number;
    payments: number;
    expenses: number;
    units: number;
    occupied: number;
    expensesByCategory: { category: string; amount: number }[];
  };
  maintenance: {
    open: number;
    resolved: number;
  };
  paymentMethods: { method: string; count: number }[];
  tenantPayments: {
    name: string;
    unit: string;
    rentAmount: number;
    paidThisMonth: number;
    ltv: number;
    payments: { month: string; status: string }[];
  }[];
  month: string;
}

export async function getPortfolioReport(
  token: string,
  propertyId: string,
): Promise<BackendRequestResult<PortfolioReportData>> {
  return backendGet<PortfolioReportData>(`${TARGET_ENDPOINTS.reports}/${propertyId}/data`, token);
}

// Documents
export interface DocumentRecord {
  id: string;
  name: string;
  fileUrl: string;
  type: string;
  description?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
  createdAt: string;
}

export interface CreateDocumentPayload {
  name: string;
  fileUrl: string;
  type?: string;
  description?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
}

export interface UpdateDocumentPayload {
  name?: string;
  fileUrl?: string;
  type?: string;
  description?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
}

export async function uploadDocumentFile(
  token: string,
  formData: FormData,
): Promise<BackendRequestResult<{ fileUrl: string }>> {
  try {
    const url = `${backendBaseUrl()}${TARGET_ENDPOINTS.documents}/upload`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (res.status === 401) return { data: null, status: 401, error: "Unauthorized" };
    if (res.status === 403) return { data: null, status: 403, error: "Forbidden" };

    const responseData = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 429) {
        return { data: null, status: 429, error: responseData?.message || "Too many requests" };
      }
      return { data: null, status: res.status, error: responseData?.message || `Request failed (${res.status})` };
    }

    return { data: responseData as { fileUrl: string }, status: res.status, error: null };
  } catch (error) {
    console.error("Upload error:", error);
    return { data: null, status: 500, error: "Network or configuration error" };
  }
}

export async function listDocuments(
  token: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<BackendRequestResult<PaginatedResponse<DocumentRecord>>> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.documents}?${qs}` : TARGET_ENDPOINTS.documents;
  return backendRequest<PaginatedResponse<DocumentRecord>>(path, token, "GET");
}

export async function createDocument(
  token: string,
  payload: CreateDocumentPayload,
): Promise<BackendRequestResult<DocumentRecord>> {
  return backendRequest<DocumentRecord>(TARGET_ENDPOINTS.documents, token, "POST", payload);
}

export async function updateDocument(
  token: string,
  id: string,
  payload: UpdateDocumentPayload,
): Promise<BackendRequestResult<DocumentRecord>> {
  return backendRequest<DocumentRecord>(`${TARGET_ENDPOINTS.documents}/${id}`, token, "PATCH", payload);
}

export async function deleteDocument(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.documents}/${id}`, token, "DELETE");
}

export async function getAuditLogs(
  token: string,
  params?: { limit?: number; action?: string; outcome?: string; entity?: string; actorId?: string; targetId?: string },
): Promise<BackendRequestResult<AuditLogsResponse>> {
  const query = new URLSearchParams();
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.action) query.append("action", params.action);
  if (params?.outcome) query.append("outcome", params.outcome);
  if (params?.entity) query.append("entity", params.entity);
  if (params?.actorId) query.append("actorId", params.actorId);
  if (params?.targetId) query.append("targetId", params.targetId);

  const qs = query.toString();
  const path = qs ? `${TARGET_ENDPOINTS.auditLogs}?${qs}` : TARGET_ENDPOINTS.auditLogs;
  return backendRequest<AuditLogsResponse>(path, token, "GET");
}

export async function registerCompany(
  payload: RegisterCompanyPayload,
): Promise<BackendRequestResult<{ accessToken: string; user: BackendUserContext }>> {
  return backendRequest<{ accessToken: string; user: BackendUserContext }>(
    TARGET_ENDPOINTS.registerCompany,
    "", // No token for registration
    "POST",
    payload,
  );
}

export async function createInvitation(
  token: string,
  payload: { email: string; role: UserRole; firstName?: string; lastName?: string },
): Promise<BackendRequestResult<InvitationRecord>> {
  return backendRequest<InvitationRecord>(TARGET_ENDPOINTS.invite, token, "POST", payload);
}

export async function verifyInvitation(
  token: string,
): Promise<BackendRequestResult<InvitationRecord>> {
  return backendRequest<InvitationRecord>(`${TARGET_ENDPOINTS.verifyInvite}/${token}`, "", "GET");
}

export async function acceptInvitation(
  token: string,
  payload: AcceptInvitationPayload,
): Promise<BackendRequestResult<BackendUserContext>> {
  return backendRequest<BackendUserContext>(`${TARGET_ENDPOINTS.acceptInvite}/${token}`, "", "POST", payload);
}

export async function listInvitations(
  token: string,
): Promise<BackendRequestResult<InvitationRecord[]>> {
  return backendRequest<InvitationRecord[]>(TARGET_ENDPOINTS.listInvitations, token, "GET");
}
export async function aiChat(
  token: string,
  payload: { history: any[]; message: string; chatId?: string },
): Promise<BackendRequestResult<{ response: string; chatId: string }>> {
  return backendRequest<{ response: string; chatId: string }>(TARGET_ENDPOINTS.aiChat, token, "POST", payload);
}

export async function listChatSessions(
  token: string,
): Promise<BackendRequestResult<any[]>> {
  return backendRequest<any[]>(TARGET_ENDPOINTS.chatSessions, token, "POST");
}

export async function getChatSession(
  token: string,
  id: string,
): Promise<BackendRequestResult<any>> {
  return backendRequest<any>(`${TARGET_ENDPOINTS.chatSessions}/${id}`, token, "POST");
}

export async function deleteChatSession(
  token: string,
  id: string,
): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.chatSessions}/${id}/delete`, token, "POST");
}

export async function listActiveWorkflows(
  token: string,
): Promise<BackendRequestResult<any[]>> {
  return backendRequest<any[]>(TARGET_ENDPOINTS.listActiveWorkflows, token, "POST");
}

// Office Finances
export type IncomeCategory = "COMMISSION" | "MANAGEMENT_FEE" | "OTHER";

export type ExpenseCategory =
  | "MAINTENANCE"
  | "REPAIR"
  | "UTILITY"
  | "INSURANCE"
  | "TAX"
  | "MANAGEMENT_FEE"
  | "LEGAL"
  | "CLEANING"
  | "SECURITY"
  | "OFFICE_RENT"
  | "INTERNET"
  | "SALARY"
  | "MARKETING"
  | "OFFICE_SUPPLIES"
  | "COMMISSION_AGENT_FEE"
  | "OTHER";

export interface IncomeRecord {
  id: string;
  amount: number;
  category: IncomeCategory;
  date: string;
  description?: string;
  propertyId?: string;
  property?: { name: string };
}

export interface OfficeSummary {
  income: number;
  expenses: number;
  net: number;
}

export async function getOfficeSummary(
  token: string,
): Promise<BackendRequestResult<OfficeSummary>> {
  return backendGet<OfficeSummary>(TARGET_ENDPOINTS.officeSummary, token);
}

export async function listOfficeIncome(
  token: string,
): Promise<BackendRequestResult<IncomeRecord[]>> {
  return backendGet<IncomeRecord[]>(TARGET_ENDPOINTS.officeIncome, token);
}

export async function listOfficeExpenses(
  token: string,
): Promise<BackendRequestResult<ExpenseRecord[]>> {
  return backendGet<ExpenseRecord[]>(TARGET_ENDPOINTS.officeExpenses, token);
}

export async function createOfficeIncome(
  token: string,
  payload: {
    amount: number;
    category: IncomeCategory;
    date: string;
    description?: string;
    propertyId?: string;
  }
): Promise<BackendRequestResult<IncomeRecord>> {
  return backendRequest<IncomeRecord>(`${TARGET_ENDPOINTS.officeIncome}`, token, "POST", payload);
}

export async function createOfficeExpense(
  token: string,
  payload: {
    amount: number;
    category: ExpenseCategory;
    date: string;
    description: string;
    vendor?: string;
    reference?: string;
    notes?: string;
  }
): Promise<BackendRequestResult<ExpenseRecord>> {
  return backendRequest<ExpenseRecord>(`${TARGET_ENDPOINTS.officeExpenses}`, token, "POST", payload);
}
export async function getMcKinseyReport(
  token: string,
  propertyId: string,
): Promise<BackendRequestResult<{ url: string; insightsSummary: string }>> {
  return backendRequest<{ url: string; insightsSummary: string }>(
    `${TARGET_ENDPOINTS.reports}/${propertyId}/mckinsey`,
    token,
    "POST",
  );
}
// Roles
export async function listRoles(token: string): Promise<BackendRequestResult<RoleRecord[]>> {
  return backendGet<RoleRecord[]>(TARGET_ENDPOINTS.roles, token);
}

export async function createRole(token: string, payload: CreateRolePayload): Promise<BackendRequestResult<RoleRecord>> {
  return backendRequest<RoleRecord>(TARGET_ENDPOINTS.roles, token, "POST", payload);
}

export async function updateRole(token: string, id: string, payload: Partial<CreateRolePayload>): Promise<BackendRequestResult<RoleRecord>> {
  return backendRequest<RoleRecord>(`${TARGET_ENDPOINTS.roles}/${id}`, token, "PATCH", payload);
}

export async function deleteRole(token: string, id: string): Promise<BackendRequestResult<null>> {
  return backendRequest<null>(`${TARGET_ENDPOINTS.roles}/${id}`, token, "DELETE");
}

// Staff Assignments
export async function listStaffAssignments(token: string, userId: string): Promise<BackendRequestResult<PropertyAssignmentRecord[]>> {
  return backendGet<PropertyAssignmentRecord[]>(`${TARGET_ENDPOINTS.staffAssignments}/${userId}/assignments`, token);
}

export async function setBulkStaffAssignments(token: string, userId: string, propertyIds: string[]): Promise<BackendRequestResult<PropertyAssignmentRecord[]>> {
  return backendRequest<PropertyAssignmentRecord[]>(`${TARGET_ENDPOINTS.staffAssignments}/${userId}/assignments/bulk`, token, "POST", { propertyIds });
}

export async function getInvoicePdf(
  token: string,
  id: string,
): Promise<BackendRequestResult<{ url: string }>> {
  return backendGet<{ url: string }>(`${TARGET_ENDPOINTS.invoices}/${id}/pdf`, token);
}

export async function getPaymentPdf(
  token: string,
  id: string,
): Promise<BackendRequestResult<{ url: string }>> {
  return backendGet<{ url: string }>(`${TARGET_ENDPOINTS.payments}/${id}/pdf`, token);
}
export async function fetchTenantStatement(
  token: string,
  leaseId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<BackendRequestResult<TenantStatementRecord>> {
  const query = new URLSearchParams();
  if (params?.startDate) query.append("startDate", params.startDate);
  if (params?.endDate) query.append("endDate", params.endDate);

  const qs = query.toString();
  const path = qs
    ? `${TARGET_ENDPOINTS.reports}/leases/${leaseId}/statement?${qs}`
    : `${TARGET_ENDPOINTS.reports}/leases/${leaseId}/statement`;

  return backendGet<TenantStatementRecord>(path, token);
}

export async function getTenantStatementPdf(
  token: string,
  leaseId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<BackendRequestResult<{ url: string }>> {
  const query = new URLSearchParams();
  if (params?.startDate) query.append("startDate", params.startDate);
  if (params?.endDate) query.append("endDate", params.endDate);

  const qs = query.toString();
  const path = qs
    ? `${TARGET_ENDPOINTS.reports}/leases/${leaseId}/statement/pdf?${qs}`
    : `${TARGET_ENDPOINTS.reports}/leases/${leaseId}/statement/pdf`;

  return backendGet<{ url: string }>(path, token);
}

export interface RecurringExpenseRecord {
  id: string;
  description: string;
  amount: number;
  category: string;
  dayOfMonth: number;
  isActive: boolean;
  lastGeneratedAt?: string;
  propertyId: string;
  companyId: string;
  createdAt: string;
  property?: { name: string };
}

export async function getRecurringExpenses(
  token: string,
  propertyId?: string,
): Promise<BackendRequestResult<RecurringExpenseRecord[]>> {
  const path = propertyId
    ? `${TARGET_ENDPOINTS.expenses}/recurring?propertyId=${propertyId}`
    : `${TARGET_ENDPOINTS.expenses}/recurring`;
  // Using TARGET_ENDPOINTS.expenses assuming recurring-expenses is under same prefix or I should define new one
  // Actually the controller was /recurring-expenses
  return backendGet<RecurringExpenseRecord[]>("/recurring-expenses", token, {
    ...(propertyId ? { propertyId } : {}),
  });
}

export async function createRecurringExpense(
  token: string,
  data: Partial<RecurringExpenseRecord>,
): Promise<BackendRequestResult<RecurringExpenseRecord>> {
  return backendPost<RecurringExpenseRecord>("/recurring-expenses", data, token);
}

export async function updateRecurringExpense(
  token: string,
  id: string,
  data: Partial<RecurringExpenseRecord>,
): Promise<BackendRequestResult<RecurringExpenseRecord>> {
  return backendPut<RecurringExpenseRecord>(`/recurring-expenses/${id}`, data, token);
}

export async function deleteRecurringExpense(
  token: string,
  id: string,
): Promise<BackendRequestResult<void>> {
  return backendDelete<void>(`/recurring-expenses/${id}`, token);
}
export async function triggerZuriSync(
  token: string,
  companyId: string,
  propertyIds?: string[],
): Promise<BackendRequestResult<{ message: string; results: any[] }>> {
  return backendRequest<{ message: string; results: any[] }>(
    TARGET_ENDPOINTS.zuriSync,
    token,
    "POST",
    { companyId, propertyIds },
  );
}
