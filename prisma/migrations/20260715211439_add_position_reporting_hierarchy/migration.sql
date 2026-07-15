-- AlterTable
ALTER TABLE "hr"."positions" ADD COLUMN     "reportsToPositionId" TEXT;

-- CreateIndex
CREATE INDEX "positions_reportsToPositionId_idx" ON "hr"."positions"("reportsToPositionId");

-- AddForeignKey
ALTER TABLE "hr"."positions" ADD CONSTRAINT "positions_reportsToPositionId_fkey" FOREIGN KEY ("reportsToPositionId") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
