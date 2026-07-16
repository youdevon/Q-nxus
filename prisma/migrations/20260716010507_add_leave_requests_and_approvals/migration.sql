-- CreateTable
CREATE TABLE "hr"."leave_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "leaveBalanceId" TEXT,
    "requestNumber" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "requestedQuantity" DECIMAL(9,2) NOT NULL,
    "reason" TEXT,
    "employeeComment" TEXT,
    "status" "hr"."LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "finalDecisionByUserId" TEXT,
    "finalDecisionComment" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."leave_request_days" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "leaveDate" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(7,2) NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."leave_approval_steps" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverUserId" TEXT,
    "approverPositionId" TEXT,
    "status" "hr"."LeaveApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."leave_attachments" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_requests_organizationId_idx" ON "hr"."leave_requests"("organizationId");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_idx" ON "hr"."leave_requests"("employeeId");

-- CreateIndex
CREATE INDEX "leave_requests_contractId_idx" ON "hr"."leave_requests"("contractId");

-- CreateIndex
CREATE INDEX "leave_requests_leaveTypeId_idx" ON "hr"."leave_requests"("leaveTypeId");

-- CreateIndex
CREATE INDEX "leave_requests_leaveBalanceId_idx" ON "hr"."leave_requests"("leaveBalanceId");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "hr"."leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_startDate_endDate_idx" ON "hr"."leave_requests"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "leave_requests_finalDecisionByUserId_idx" ON "hr"."leave_requests"("finalDecisionByUserId");

-- CreateIndex
CREATE INDEX "leave_requests_createdByUserId_idx" ON "hr"."leave_requests"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_organizationId_requestNumber_key" ON "hr"."leave_requests"("organizationId", "requestNumber");

-- CreateIndex
CREATE INDEX "leave_request_days_leaveDate_idx" ON "hr"."leave_request_days"("leaveDate");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_days_leaveRequestId_leaveDate_key" ON "hr"."leave_request_days"("leaveRequestId", "leaveDate");

-- CreateIndex
CREATE INDEX "leave_approval_steps_approverUserId_idx" ON "hr"."leave_approval_steps"("approverUserId");

-- CreateIndex
CREATE INDEX "leave_approval_steps_approverPositionId_idx" ON "hr"."leave_approval_steps"("approverPositionId");

-- CreateIndex
CREATE INDEX "leave_approval_steps_status_idx" ON "hr"."leave_approval_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approval_steps_leaveRequestId_stepNumber_key" ON "hr"."leave_approval_steps"("leaveRequestId", "stepNumber");

-- CreateIndex
CREATE INDEX "leave_attachments_leaveRequestId_idx" ON "hr"."leave_attachments"("leaveRequestId");

-- CreateIndex
CREATE INDEX "leave_attachments_uploadedByUserId_idx" ON "hr"."leave_attachments"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "hr"."employment_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_leaveBalanceId_fkey" FOREIGN KEY ("leaveBalanceId") REFERENCES "hr"."employee_leave_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_finalDecisionByUserId_fkey" FOREIGN KEY ("finalDecisionByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_request_days" ADD CONSTRAINT "leave_request_days_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "hr"."leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "hr"."leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_approverPositionId_fkey" FOREIGN KEY ("approverPositionId") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_attachments" ADD CONSTRAINT "leave_attachments_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "hr"."leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_attachments" ADD CONSTRAINT "leave_attachments_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
