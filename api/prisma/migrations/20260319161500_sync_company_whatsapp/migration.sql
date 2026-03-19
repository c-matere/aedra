-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'LANDLORD';
ALTER TYPE "UserRole" ADD VALUE 'TENANT';
ALTER TYPE "UserRole" ADD VALUE 'UNIDENTIFIED';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "waAccessToken" TEXT,
ADD COLUMN "waBusinessAccountId" TEXT,
ADD COLUMN "waOwnerPhone" TEXT,
ADD COLUMN "waPhoneNumberId" TEXT,
ADD COLUMN "waVerifyToken" TEXT;
