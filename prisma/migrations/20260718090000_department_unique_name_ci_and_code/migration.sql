-- Case-insensitive unique department name per organization
-- (complements the existing exact-case unique on (organizationId, name)).
CREATE UNIQUE INDEX "departments_organizationId_lower_name_key"
ON "hr"."departments" ("organizationId", lower("name"));

-- Unique department code per organization (multiple NULL codes remain allowed).
CREATE UNIQUE INDEX "departments_organizationId_code_key"
ON "hr"."departments" ("organizationId", "code");
