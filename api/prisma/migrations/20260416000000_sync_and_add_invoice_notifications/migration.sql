-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Otp_phone_idx" ON "Otp"("phone");

-- CreateIndex
CREATE INDEX "Otp_code_idx" ON "Otp"("code");

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "waInvoiceNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "roleId" TEXT;

-- CreateIndex
CREATE INDEX "Invitation_roleId_idx" ON "Invitation"("roleId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
