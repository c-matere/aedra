-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('RENT', 'MAINTENANCE', 'PENALTY', 'UTILITY', 'OTHER');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "type" "InvoiceType" NOT NULL DEFAULT 'RENT';
