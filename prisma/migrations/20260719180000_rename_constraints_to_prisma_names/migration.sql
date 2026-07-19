-- Align Postgres constraint/index names with Prisma's expected identifiers.
-- Rename-only; no structural changes.

-- RenameForeignKey
ALTER TABLE "audit"."audit_events" RENAME CONSTRAINT "audit_events_organizationid_fkey" TO "audit_events_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "core"."user_roles" RENAME CONSTRAINT "user_roles_sourcepositionid_fkey" TO "user_roles_sourcePositionId_fkey";

-- RenameIndex
ALTER INDEX "audit"."audit_events_organizationid_idx" RENAME TO "audit_events_organizationId_idx";

-- RenameIndex
ALTER INDEX "hr"."employee_correspondences_organizationId_requiresAcknowledgement" RENAME TO "employee_correspondences_organizationId_requiresAcknowledge_idx";

-- RenameIndex
ALTER INDEX "hr"."employee_correspondences_organizationId_retentionUntil_status_i" RENAME TO "employee_correspondences_organizationId_retentionUntil_stat_idx";

-- RenameIndex
ALTER INDEX "hr"."employee_file_checklist_items_assumptionOfDutyConfirmedByU_idx" RENAME TO "employee_file_checklist_items_assumptionOfDutyConfirmedByUs_idx";

-- RenameIndex
ALTER INDEX "hr"."employee_leave_balances_contractId_leaveTypeId_cycleStart_cycle" RENAME TO "employee_leave_balances_contractId_leaveTypeId_cycleStart_c_key";

-- RenameIndex
ALTER INDEX "hr"."leave_request_acknowledgements_leaveRequestId_sequenceNumber_ke" RENAME TO "leave_request_acknowledgements_leaveRequestId_sequenceNumbe_key";

-- RenameIndex
ALTER INDEX "payroll"."ach_payment_batch_details_achPaymentBatchId_payrollPaymentAlloc" RENAME TO "ach_payment_batch_details_achPaymentBatchId_payrollPaymentA_key";
