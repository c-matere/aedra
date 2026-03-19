-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('SYSTEM', 'COMPANY');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('PENDING', 'NOTIFIED', 'QUORUM_MET', 'REJECTED', 'EXPIRED', 'EXECUTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Landlord" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Tenant" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "semanticTags" TEXT,
ADD COLUMN "embedding" vector;

ALTER TABLE "AuditLog" ADD COLUMN "embedding" vector, 
ADD COLUMN "semanticTags" TEXT;

ALTER TABLE "Property" ADD COLUMN "semanticTags" TEXT,
ADD COLUMN "embedding" vector;

ALTER TABLE "Unit" ADD COLUMN "semanticTags" TEXT,
ADD COLUMN "embedding" vector;

ALTER TABLE "MaintenanceRequest" ADD COLUMN "semanticTags" TEXT,
ADD COLUMN "embedding" vector;

ALTER TABLE "Lease" ADD COLUMN "semanticTags" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "to" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "status" TEXT NOT NULL,
    "metaMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppProfile" (
    "phone" TEXT NOT NULL,
    "language" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppProfile_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "AuthorizationRequest" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approverIds" TEXT[],
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "companyId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppLog_companyId_idx" ON "WhatsAppLog"("companyId");
CREATE INDEX "WhatsAppLog_to_idx" ON "WhatsAppLog"("to");
CREATE INDEX "AuthorizationRequest_companyId_idx" ON "AuthorizationRequest"("companyId");
CREATE INDEX "AuthorizationRequest_status_idx" ON "AuthorizationRequest"("status");

-- AddForeignKey
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
