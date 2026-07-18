-- Composite indexes for common directory / documents filters
CREATE INDEX IF NOT EXISTS "employees_organizationId_isArchived_employmentStatus_idx"
  ON "hr"."employees" ("organizationId", "isArchived", "employmentStatus");

CREATE INDEX IF NOT EXISTS "employee_correspondences_employeeId_managerVisible_status_idx"
  ON "hr"."employee_correspondences" ("employeeId", "managerVisible", "status");

CREATE INDEX IF NOT EXISTS "employee_correspondences_organizationId_retentionUntil_status_idx"
  ON "hr"."employee_correspondences" ("organizationId", "retentionUntil", "status");
