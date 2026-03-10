-- Enable Row Level Security (RLS) on all multi-tenant tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Landlord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenanceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Penalty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;

-- 1. User Isolation
-- Users see their own data and metadata for their company, superadmins see all.
CREATE POLICY user_isolation_policy ON "User" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  (id = current_setting('app.current_user_id', true)) OR
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 2. Landlord Isolation
CREATE POLICY landlord_isolation_policy ON "Landlord" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 3. Property Isolation
CREATE POLICY property_isolation_policy ON "Property" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 4. Unit Isolation (via Property)
CREATE POLICY unit_isolation_policy ON "Unit" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Property" p 
    WHERE p.id = "Unit"."propertyId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
  )
);

-- 5. Tenant Isolation
CREATE POLICY tenant_isolation_policy ON "Tenant" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 6. Lease Isolation (via Property)
CREATE POLICY lease_isolation_policy ON "Lease" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Property" p 
    WHERE p.id = "Lease"."propertyId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
  )
);

-- 7. Maintenance Request Isolation
CREATE POLICY maintenance_request_isolation_policy ON "MaintenanceRequest" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 8. Payment Isolation (via Lease/Property)
CREATE POLICY payment_isolation_policy ON "Payment" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Lease" l 
    JOIN "Property" p ON l."propertyId" = p.id 
    WHERE l.id = "Payment"."leaseId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
  )
);

-- 9. Invoice Isolation (via Lease/Property)
CREATE POLICY invoice_isolation_policy ON "Invoice" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Lease" l 
    JOIN "Property" p ON l."propertyId" = p.id 
    WHERE l.id = "Invoice"."leaseId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
  )
);

-- 10. Document Isolation
CREATE POLICY document_isolation_policy ON "Document" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 11. Expense Isolation
CREATE POLICY expense_isolation_policy ON "Expense" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 12. Penalty Isolation (via Lease/Property)
CREATE POLICY penalty_isolation_policy ON "Penalty" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Lease" l 
    JOIN "Property" p ON l."propertyId" = p.id 
    WHERE l.id = "Penalty"."leaseId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
  )
);

-- 13. Invitation Isolation
CREATE POLICY invitation_isolation_policy ON "Invitation" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- 14. Audit Log Isolation
CREATE POLICY audit_log_isolation_policy ON "AuditLog" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("actorCompanyId" = current_setting('app.current_company_id', true))
);

-- 15. Company Isolation
CREATE POLICY company_isolation_policy ON "Company" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  (id = current_setting('app.current_company_id', true))
);
