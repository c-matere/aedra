-- AlterTable
ALTER TABLE "Company" ADD COLUMN "smsLeopardApiKey" TEXT;
ALTER TABLE "Company" ADD COLUMN "smsLeopardApiSecret" TEXT;
ALTER TABLE "Company" ADD COLUMN "smsLeopardSource" TEXT;
ALTER TABLE "Company" ADD COLUMN "smsAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "to" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_companyId_idx" ON "SmsLog"("companyId");

-- CreateIndex
CREATE INDEX "SmsLog_to_idx" ON "SmsLog"("to");

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
