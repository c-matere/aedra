-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('RENT_COLLECTION', 'MAINTENANCE_LIFECYCLE', 'LEASE_RENEWAL', 'TENANT_ONBOARDING');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'ACTIVE', 'AWAITING_INPUT', 'AWAITING_CONFIRMATION', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncomeCategory" AS ENUM ('COMMISSION', 'MANAGEMENT_FEE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExpenseCategory" ADD VALUE 'OFFICE_RENT';
ALTER TYPE "ExpenseCategory" ADD VALUE 'INTERNET';
ALTER TYPE "ExpenseCategory" ADD VALUE 'SALARY';
ALTER TYPE "ExpenseCategory" ADD VALUE 'MARKETING';
ALTER TYPE "ExpenseCategory" ADD VALUE 'OFFICE_SUPPLIES';
ALTER TYPE "ExpenseCategory" ADD VALUE 'COMMISSION_AGENT_FEE';

-- AlterEnum
ALTER TYPE "UnitStatus" ADD VALUE 'VACATING';

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_landlordId_fkey";

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "commissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "landlordId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "type" "WorkflowType" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "companyId" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "WorkflowStatus" NOT NULL,
    "toStatus" "WorkflowStatus" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "IncomeCategory" NOT NULL DEFAULT 'COMMISSION',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowInstance_companyId_idx" ON "WorkflowInstance"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_type_idx" ON "WorkflowInstance"("type");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");

-- CreateIndex
CREATE INDEX "WorkflowInstance_deletedAt_idx" ON "WorkflowInstance"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowInstanceId_idx" ON "WorkflowStep"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "Income_companyId_idx" ON "Income"("companyId");

-- CreateIndex
CREATE INDEX "Income_propertyId_idx" ON "Income"("propertyId");

-- CreateIndex
CREATE INDEX "Income_category_idx" ON "Income"("category");

-- CreateIndex
CREATE INDEX "Income_deletedAt_idx" ON "Income"("deletedAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Enable RLS
ALTER TABLE "WorkflowInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Income" ENABLE ROW LEVEL SECURITY;

-- WorkflowInstance Isolation
CREATE POLICY workflow_instance_isolation_policy ON "WorkflowInstance" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);

-- WorkflowStep Isolation
CREATE POLICY workflow_step_isolation_policy ON "WorkflowStep" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  EXISTS (
    SELECT 1 FROM "WorkflowInstance" wi 
    WHERE wi.id = "WorkflowStep"."workflowInstanceId" 
    AND wi."companyId" = current_setting('app.current_company_id', true)
  )
);

-- Income Isolation
CREATE POLICY income_isolation_policy ON "Income" 
USING (
  (current_setting('app.is_super_admin', true) = 'true') OR 
  ("companyId" = current_setting('app.current_company_id', true))
);
