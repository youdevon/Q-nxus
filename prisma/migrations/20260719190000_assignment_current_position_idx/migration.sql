-- Speeds workflow position dropdown holder lookups (isCurrent + positionId).
CREATE INDEX IF NOT EXISTS "employee_assignments_isCurrent_positionId_idx"
  ON "hr"."employee_assignments"("isCurrent", "positionId");
