-- 1. Enable RLS on new tables
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyAssignment" ENABLE ROW LEVEL SECURITY;

-- 2. Drop old policies that need refinement
DROP POLICY IF EXISTS property_isolation_policy ON "Property";
DROP POLICY IF EXISTS unit_isolation_policy ON "Unit";
DROP POLICY IF EXISTS lease_isolation_policy ON "Lease";
DROP POLICY IF EXISTS payment_isolation_policy ON "Payment";
DROP POLICY IF EXISTS invoice_isolation_policy ON "Invoice";
DROP POLICY IF EXISTS penalty_isolation_policy ON "Penalty";
DROP POLICY IF EXISTS tenant_isolation_policy ON "Tenant";

-- 3. New Property Isolation Policy (Supports Scoping)
CREATE POLICY property_isolation_policy ON "Property" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  (
    "companyId" = current_setting('app.current_company_id', true) AND (
      (current_setting('app.current_role', true) = 'COMPANY_ADMIN') OR
      EXISTS (
        SELECT 1 FROM "PropertyAssignment" pa 
        WHERE pa."propertyId" = "Property".id 
        AND pa."userId" = current_setting('app.current_user_id', true)
      )
    )
  )
);

-- 4. New Unit Isolation (following Property)
CREATE POLICY unit_isolation_policy ON "Unit" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Property" p 
    WHERE p.id = "Unit"."propertyId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
    AND (
      (current_setting('app.current_role', true) = 'COMPANY_ADMIN') OR
      EXISTS (
        SELECT 1 FROM "PropertyAssignment" pa 
        WHERE pa."propertyId" = p.id 
        AND pa."userId" = current_setting('app.current_user_id', true)
      )
    )
  )
);

-- 5. New Tenant Isolation (following Property check)
CREATE POLICY tenant_isolation_policy ON "Tenant" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  (
    "companyId" = current_setting('app.current_company_id', true) AND (
      (current_setting('app.current_role', true) = 'COMPANY_ADMIN') OR
      EXISTS (
        SELECT 1 FROM "PropertyAssignment" pa 
        WHERE pa."propertyId" = "Tenant"."propertyId" 
        AND pa."userId" = current_setting('app.current_user_id', true)
      )
    )
  )
);

-- 6. New Lease Isolation (following Property)
CREATE POLICY lease_isolation_policy ON "Lease" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Property" p 
    WHERE p.id = "Lease"."propertyId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
    AND (
      (current_setting('app.current_role', true) = 'COMPANY_ADMIN') OR
      EXISTS (
        SELECT 1 FROM "PropertyAssignment" pa 
        WHERE pa."propertyId" = p.id 
        AND pa."userId" = current_setting('app.current_user_id', true)
      )
    )
  )
);

-- 7. New Payment Isolation (via Lease/Property)
CREATE POLICY payment_isolation_policy ON "Payment" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Lease" l 
    JOIN "Property" p ON l."propertyId" = p.id 
    WHERE l.id = "Payment"."leaseId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
    AND (
      (current_setting('app.current_role', true) = 'COMPANY_ADMIN') OR
      EXISTS (
        SELECT 1 FROM "PropertyAssignment" pa 
        WHERE pa."propertyId" = p.id 
        AND pa."userId" = current_setting('app.current_user_id', true)
      )
    )
  )
);

-- 8. New Invoice Isolation (via Lease/Property)
CREATE POLICY invoice_isolation_policy ON "Invoice" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Lease" l 
    JOIN "Property" p ON l."propertyId" = p.id 
    WHERE l.id = "Invoice"."leaseId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
    AND (
      (current_setting('app.current_role', true) = 'COMPANY_ADMIN') OR
      EXISTS (
        SELECT 1 FROM "PropertyAssignment" pa 
        WHERE pa."propertyId" = p.id 
        AND pa."userId" = current_setting('app.current_user_id', true)
      )
    )
  )
);

-- 9. New Penalty Isolation (via Lease/Property)
CREATE POLICY penalty_isolation_policy ON "Penalty" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "Lease" l 
    JOIN "Property" p ON l."propertyId" = p.id 
    WHERE l.id = "Penalty"."leaseId" 
    AND p."companyId" = current_setting('app.current_company_id', true)
    AND (
      (current_setting('app.current_role', true) = 'COMPANY_ADMIN') OR
      EXISTS (
        SELECT 1 FROM "PropertyAssignment" pa 
        WHERE pa."propertyId" = p.id 
        AND pa."userId" = current_setting('app.current_user_id', true)
      )
    )
  )
);

-- 10. Role Isolation
CREATE POLICY role_isolation_policy ON "Role" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true)) OR
  ("isSystem" = true)
);

-- 11. Property Assignment Isolation
CREATE POLICY property_assignment_isolation_policy ON "PropertyAssignment" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);