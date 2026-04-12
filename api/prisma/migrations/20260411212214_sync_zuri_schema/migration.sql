-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "zuriDomain" TEXT,
ADD COLUMN     "zuriPassword" TEXT,
ADD COLUMN     "zuriUsername" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "tenantCode" TEXT;
