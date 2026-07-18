-- Mark seeded / built-in access roles as system-managed so they cannot be
-- edited or deleted through Administration → Access role management.
UPDATE "core"."roles"
SET "isSystem" = true
WHERE "code" IN (
  'SYSTEM_ADMINISTRATOR',
  'EMPLOYEE',
  'LEAVE_APPROVER',
  'HR_CLERK',
  'HR_LEAVE_OFFICER',
  'HR_ADMINISTRATOR',
  'PAYROLL_CLERK',
  'PAYROLL_OFFICER',
  'HR_PAYROLL_ADMINISTRATOR'
);
