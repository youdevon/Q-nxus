-- Wave 2 snappy indexes: approval queues, on-leave overlap, contract expiry, bell expiry.

CREATE INDEX IF NOT EXISTS "leave_approval_steps_approverUserId_status_idx"
  ON "hr"."leave_approval_steps"("approverUserId", "status");

CREATE INDEX IF NOT EXISTS "leave_requests_organizationId_status_startDate_endDate_idx"
  ON "hr"."leave_requests"("organizationId", "status", "startDate", "endDate");

CREATE INDEX IF NOT EXISTS "employment_contracts_isCurrent_endDate_idx"
  ON "hr"."employment_contracts"("isCurrent", "endDate");

CREATE INDEX IF NOT EXISTS "notifications_expiresAt_idx"
  ON "notifications"."notifications"("expiresAt");
