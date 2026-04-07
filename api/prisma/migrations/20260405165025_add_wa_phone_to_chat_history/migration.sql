-- AlterTable
ALTER TABLE "ChatHistory" ADD COLUMN     "waPhone" TEXT;

-- CreateIndex
CREATE INDEX "ChatHistory_waPhone_idx" ON "ChatHistory"("waPhone");
