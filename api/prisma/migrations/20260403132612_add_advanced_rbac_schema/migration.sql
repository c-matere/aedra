/*
  Warnings:

  - A unique constraint covering the columns `[mpesaShortcode]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('PENDING', 'DONE');

-- AlterEnum
ALTER TYPE "WorkflowStatus" ADD VALUE 'BACKGROUND_PAUSED';

-- AlterEnum
ALTER TYPE "WorkflowType" ADD VALUE 'AUTONOMOUS_AGENT';

-- DropForeignKey
ALTER TABLE "ChatHistory" DROP CONSTRAINT "ChatHistory_userId_fkey";

-- AlterTable
ALTER TABLE "ChatHistory" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "africaTalkingApiKey" TEXT,
ADD COLUMN     "africaTalkingUsername" TEXT,
ADD COLUMN     "autoInvoicingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invoicingDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ipAllowlist" TEXT,
ADD COLUMN     "leaseExpiryAlertDaysBefore" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "maintenanceUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mapProvider" TEXT NOT NULL DEFAULT 'Mapbox GL',
ADD COLUMN     "mapboxAccessToken" TEXT,
ADD COLUMN     "mpesaConsumerKey" TEXT,
ADD COLUMN     "mpesaConsumerSecret" TEXT,
ADD COLUMN     "mpesaEnvironment" TEXT DEFAULT 'sandbox',
ADD COLUMN     "mpesaPasskey" TEXT,
ADD COLUMN     "mpesaShortcode" TEXT,
ADD COLUMN     "passwordPolicy" TEXT NOT NULL DEFAULT 'Min 8 chars + special character',
ADD COLUMN     "paymentReceiptsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rentReminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "sessionDurationHours" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "smsProvider" TEXT NOT NULL DEFAULT 'Africa''s Talking',
ADD COLUMN     "twoFactorAuthEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowInstance" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationFeedback" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "traceId" TEXT,
    "intentType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_companyId_key" ON "Role"("name", "companyId");

-- CreateIndex
CREATE INDEX "PropertyAssignment_userId_idx" ON "PropertyAssignment"("userId");

-- CreateIndex
CREATE INDEX "PropertyAssignment_propertyId_idx" ON "PropertyAssignment"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyAssignment_companyId_idx" ON "PropertyAssignment"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAssignment_userId_propertyId_key" ON "PropertyAssignment"("userId", "propertyId");

-- CreateIndex
CREATE INDEX "TodoItem_userId_idx" ON "TodoItem"("userId");

-- CreateIndex
CREATE INDEX "TodoItem_status_idx" ON "TodoItem"("status");

-- CreateIndex
CREATE INDEX "ConversationFeedback_phone_idx" ON "ConversationFeedback"("phone");

-- CreateIndex
CREATE INDEX "ConversationFeedback_intentType_idx" ON "ConversationFeedback"("intentType");

-- CreateIndex
CREATE INDEX "ConversationFeedback_companyId_idx" ON "ConversationFeedback"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_mpesaShortcode_key" ON "Company"("mpesaShortcode");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAssignment" ADD CONSTRAINT "PropertyAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAssignment" ADD CONSTRAINT "PropertyAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAssignment" ADD CONSTRAINT "PropertyAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatHistory" ADD CONSTRAINT "ChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
