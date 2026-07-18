-- AlterEnum
ALTER TYPE "hr"."LeaveRequestStatus" ADD VALUE 'AWAITING_ACKNOWLEDGEMENT' AFTER 'SUBMITTED';

-- CreateEnum
CREATE TYPE "hr"."LeaveAcknowledgementStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "hr"."leave_request_acknowledgements" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "positionId" TEXT NOT NULL,
    "acknowledgerUserId" TEXT,
    "acknowledgerEmployeeId" TEXT,
    "status" "hr"."LeaveAcknowledgementStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_request_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_request_acknowledgements_acknowledgerUserId_status_idx" ON "hr"."leave_request_acknowledgements"("acknowledgerUserId", "status");

-- CreateIndex
CREATE INDEX "leave_request_acknowledgements_leaveRequestId_status_idx" ON "hr"."leave_request_acknowledgements"("leaveRequestId", "status");

-- CreateIndex
CREATE INDEX "leave_request_acknowledgements_positionId_idx" ON "hr"."leave_request_acknowledgements"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_acknowledgements_leaveRequestId_sequenceNumber_key" ON "hr"."leave_request_acknowledgements"("leaveRequestId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "hr"."leave_request_acknowledgements" ADD CONSTRAINT "leave_request_acknowledgements_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "hr"."leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_request_acknowledgements" ADD CONSTRAINT "leave_request_acknowledgements_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "hr"."positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_request_acknowledgements" ADD CONSTRAINT "leave_request_acknowledgements_acknowledgerUserId_fkey" FOREIGN KEY ("acknowledgerUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_request_acknowledgements" ADD CONSTRAINT "leave_request_acknowledgements_acknowledgerEmployeeId_fkey" FOREIGN KEY ("acknowledgerEmployeeId") REFERENCES "hr"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
