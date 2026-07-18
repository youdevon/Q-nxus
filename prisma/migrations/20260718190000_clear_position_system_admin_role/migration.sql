-- Clear privileged role codes that must never be linked via Position.
UPDATE "hr"."positions"
SET "systemRoleCode" = NULL
WHERE "systemRoleCode" = 'SYSTEM_ADMINISTRATOR';
