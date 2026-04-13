-- Idempotent Deep Sync script for Aedra Production
-- This script ensures the Company table and UserRole enum match the current schema.prisma

-- 1. Update UserRole Enum (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'LANDLORD') THEN
        ALTER TYPE "UserRole" ADD VALUE 'LANDLORD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'TENANT') THEN
        ALTER TYPE "UserRole" ADD VALUE 'TENANT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'UNIDENTIFIED') THEN
        ALTER TYPE "UserRole" ADD VALUE 'UNIDENTIFIED';
    END IF;
END
$$;

-- 2. Add Missing Columns to Company (Idempotent)
ALTER TABLE "Company" 
ADD COLUMN IF NOT EXISTS "pinNumber" TEXT,
ADD COLUMN IF NOT EXISTS "waAccessToken" TEXT,
ADD COLUMN IF NOT EXISTS "waBusinessAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "waOwnerPhone" TEXT,
ADD COLUMN IF NOT EXISTS "waPhoneNumberId" TEXT,
ADD COLUMN IF NOT EXISTS "waVerifyToken" TEXT,
ADD COLUMN IF NOT EXISTS "waAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "waOtpEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "waPaymentConfirmationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "africaTalkingApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "africaTalkingUsername" TEXT,
ADD COLUMN IF NOT EXISTS "autoInvoicingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "invoicingDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "ipAllowlist" TEXT,
ADD COLUMN IF NOT EXISTS "leaseExpiryAlertDaysBefore" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN IF NOT EXISTS "maintenanceUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "mapProvider" TEXT NOT NULL DEFAULT 'Mapbox GL',
ADD COLUMN IF NOT EXISTS "mapboxAccessToken" TEXT,
ADD COLUMN IF NOT EXISTS "mpesaConsumerKey" TEXT,
ADD COLUMN IF NOT EXISTS "mpesaConsumerSecret" TEXT,
ADD COLUMN IF NOT EXISTS "mpesaEnvironment" TEXT DEFAULT 'sandbox',
ADD COLUMN IF NOT EXISTS "mpesaPasskey" TEXT,
ADD COLUMN IF NOT EXISTS "mpesaShortcode" TEXT,
ADD COLUMN IF NOT EXISTS "passwordPolicy" TEXT NOT NULL DEFAULT 'Min 8 chars + special character',
ADD COLUMN IF NOT EXISTS "paymentReceiptsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "rentReminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "sessionDurationHours" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN IF NOT EXISTS "smsProvider" TEXT NOT NULL DEFAULT 'Africa''s Talking',
ADD COLUMN IF NOT EXISTS "twoFactorAuthEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "zuriDomain" TEXT,
ADD COLUMN IF NOT EXISTS "zuriUsername" TEXT,
ADD COLUMN IF NOT EXISTS "zuriPassword" TEXT,
ADD COLUMN IF NOT EXISTS "jengaMerchantCode" TEXT,
ADD COLUMN IF NOT EXISTS "jengaConsumerSecret" TEXT,
ADD COLUMN IF NOT EXISTS "jengaApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "jengaPrivateKey" TEXT,
ADD COLUMN IF NOT EXISTS "jengaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 3. Add Missing Indices (Idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Company_mpesaShortcode_key" ON "Company"("mpesaShortcode");
