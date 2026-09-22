-- Treat pre–payee-group regular runs as Employees so months with a legacy
-- mixed REGULAR run do not block board / agent / contractor runs.
UPDATE "payroll"."pay_runs"
SET "payeeGroup" = 'EMPLOYEE'
WHERE "runKind" = 'REGULAR'
  AND "payeeGroup" IS NULL;
