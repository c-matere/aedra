"use server"

import {
    createProperty,
    updateProperty,
    deleteProperty,
    createTenant,
    updateTenant,
    deleteTenant,
    createLandlord,
    updateLandlord,
    deleteLandlord,
    createUnit,
    updateUnit,
    deleteUnit,
    createExpense,
    updateExpense,
    deleteExpense,
    createPayment,
    updatePayment,
    deletePayment,
    createLease,
    updateLease,
    deleteLease,
    createMaintenanceRequest,
    updateMaintenanceRequest,
    deleteMaintenanceRequest,
    createUser,
    updateUser,
    deleteUser,
    listProperties,
    listTenants,
    listLandlords,
    listUnits,
    listExpenses,
    listLeases,
    listPayments,
    listInvoices,
    listMaintenanceRequests,
    listUsers,
    listDocuments,
    getAuditLogs,
    createDocument,
    updateDocument,
    deleteDocument,
    uploadDocumentFile,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    updateMe,
    type CreatePropertyPayload,
    type UpdatePropertyPayload,
    type CreateTenantPayload,
    type UpdateTenantPayload,
    type CreateLandlordPayload,
    type UpdateLandlordPayload,
    type CreateUnitPayload,
    type UpdateUnitPayload,
    type CreateExpensePayload,
    type UpdateExpensePayload,
    type CreatePaymentPayload,
    type UpdatePaymentPayload,
    type CreateLeasePayload,
    type UpdateLeasePayload,
    type CreateMaintenanceRequestPayload,
    type UpdateMaintenanceRequestPayload,
    type CreateUserPayload,
    type UpdateUserPayload,
    type CreateDocumentPayload,
    type UpdateDocumentPayload,
    type CreateInvoicePayload,
    type UpdateInvoicePayload
} from "./backend-api"
import type { UserRole } from "./rbac"
import { getSessionTokenFromCookie } from "./cookie-utils"

export async function createPropertyAction(role: UserRole | null, payload: CreatePropertyPayload) {
    const token = await getSessionTokenFromCookie();
    return createProperty(token!, payload);
}

export async function updatePropertyAction(role: UserRole | null, id: string, payload: UpdatePropertyPayload) {
    const token = await getSessionTokenFromCookie();
    return updateProperty(token!, id, payload);
}

export async function deletePropertyAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteProperty(token!, id);
}

export async function createTenantAction(role: UserRole | null, payload: CreateTenantPayload) {
    const token = await getSessionTokenFromCookie();
    return createTenant(token!, payload);
}

export async function updateTenantAction(role: UserRole | null, id: string, payload: UpdateTenantPayload) {
    const token = await getSessionTokenFromCookie();
    return updateTenant(token!, id, payload);
}

export async function deleteTenantAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteTenant(token!, id);
}

export async function createLandlordAction(role: UserRole | null, payload: CreateLandlordPayload) {
    const token = await getSessionTokenFromCookie();
    return createLandlord(token!, payload);
}

export async function updateLandlordAction(role: UserRole | null, id: string, payload: UpdateLandlordPayload) {
    const token = await getSessionTokenFromCookie();
    return updateLandlord(token!, id, payload);
}

export async function deleteLandlordAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteLandlord(token!, id);
}

export async function createUnitAction(role: UserRole | null, payload: CreateUnitPayload) {
    const token = await getSessionTokenFromCookie();
    return createUnit(token!, payload);
}

export async function updateUnitAction(role: UserRole | null, id: string, payload: UpdateUnitPayload) {
    const token = await getSessionTokenFromCookie();
    return updateUnit(token!, id, payload);
}

export async function deleteUnitAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteUnit(token!, id);
}

export async function createExpenseAction(role: UserRole | null, payload: CreateExpensePayload) {
    const token = await getSessionTokenFromCookie();
    return createExpense(token!, payload);
}

export async function updateExpenseAction(role: UserRole | null, id: string, payload: UpdateExpensePayload) {
    const token = await getSessionTokenFromCookie();
    return updateExpense(token!, id, payload);
}

export async function deleteExpenseAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteExpense(token!, id);
}

export async function createPaymentAction(role: UserRole | null, payload: CreatePaymentPayload) {
    const token = await getSessionTokenFromCookie();
    return createPayment(token!, payload);
}

export async function updatePaymentAction(role: UserRole | null, id: string, payload: UpdatePaymentPayload) {
    const token = await getSessionTokenFromCookie();
    return updatePayment(token!, id, payload);
}

export async function deletePaymentAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deletePayment(token!, id);
}

export async function createLeaseAction(role: UserRole | null, payload: CreateLeasePayload) {
    const token = await getSessionTokenFromCookie();
    return createLease(token!, payload);
}

export async function updateLeaseAction(role: UserRole | null, id: string, payload: UpdateLeasePayload) {
    const token = await getSessionTokenFromCookie();
    return updateLease(token!, id, payload);
}

export async function deleteLeaseAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteLease(token!, id);
}

export async function createMaintenanceRequestAction(role: UserRole | null, payload: CreateMaintenanceRequestPayload) {
    const token = await getSessionTokenFromCookie();
    return createMaintenanceRequest(token!, payload);
}

export async function updateMaintenanceRequestAction(role: UserRole | null, id: string, payload: UpdateMaintenanceRequestPayload) {
    const token = await getSessionTokenFromCookie();
    return updateMaintenanceRequest(token!, id, payload);
}

export async function deleteMaintenanceRequestAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteMaintenanceRequest(token!, id);
}

export async function createUserAction(role: UserRole | null, payload: CreateUserPayload) {
    const token = await getSessionTokenFromCookie();
    return createUser(token!, payload);
}

export async function updateUserAction(role: UserRole | null, id: string, payload: UpdateUserPayload) {
    const token = await getSessionTokenFromCookie();
    return updateUser(token!, id, payload);
}

export async function deleteUserAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteUser(token!, id);
}

export async function listPropertiesAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listProperties(token!, params);
}

export async function listTenantsAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listTenants(token!, params);
}

export async function listLandlordsAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listLandlords(token!, params);
}

export async function listUnitsAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listUnits(token!, params);
}

export async function listExpensesAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listExpenses(token!, params);
}

export async function listLeasesAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string; tenantId?: string }) {
    const token = await getSessionTokenFromCookie();
    return listLeases(token!, params);
}

export async function listPaymentsAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listPayments(token!, params);
}

export async function createDocumentAction(role: UserRole | null, payload: CreateDocumentPayload) {
    const token = await getSessionTokenFromCookie();
    return createDocument(token!, payload);
}

export async function updateDocumentAction(role: UserRole | null, id: string, payload: UpdateDocumentPayload) {
    const token = await getSessionTokenFromCookie();
    return updateDocument(token!, id, payload);
}

export async function deleteDocumentAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteDocument(token!, id);
}

export async function uploadDocumentFileAction(role: UserRole | null, formData: FormData) {
    const token = await getSessionTokenFromCookie();
    return uploadDocumentFile(token!, formData);
}

export async function listInvoicesAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listInvoices(token!, params);
}

export async function listMaintenanceRequestsAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listMaintenanceRequests(token!, params);
}

export async function listUsersAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listUsers(token!, params);
}

export async function listDocumentsAction(role: UserRole | null, params?: { page?: number; limit?: number; search?: string }) {
    const token = await getSessionTokenFromCookie();
    return listDocuments(token!, params);
}

export async function createInvoiceAction(role: UserRole | null, payload: CreateInvoicePayload) {
    const token = await getSessionTokenFromCookie();
    return createInvoice(token!, payload);
}

export async function updateInvoiceAction(role: UserRole | null, id: string, payload: UpdateInvoicePayload) {
    const token = await getSessionTokenFromCookie();
    return updateInvoice(token!, id, payload);
}

export async function deleteInvoiceAction(role: UserRole | null, id: string) {
    const token = await getSessionTokenFromCookie();
    return deleteInvoice(token!, id);
}

export async function updateProfileAction(payload: Partial<CreateUserPayload>) {
    const token = await getSessionTokenFromCookie();
    return updateMe(token!, payload);
}

export async function getAuditLogsAction(params?: {
    limit?: number;
    action?: string;
    outcome?: string;
    entity?: string;
    actorId?: string;
    targetId?: string;
}) {
    const token = await getSessionTokenFromCookie();
    return getAuditLogs(token!, params);
}
