-- Per-employee statutory deduction opt-outs on payroll profiles.
ALTER TABLE "payroll"."payroll_profiles"
ADD COLUMN "exemptFromNis" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exemptFromHealthSurcharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exemptFromPaye" BOOLEAN NOT NULL DEFAULT false;
