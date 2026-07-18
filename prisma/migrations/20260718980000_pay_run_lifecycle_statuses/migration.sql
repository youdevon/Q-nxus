-- Expand pay run lifecycle beyond DRAFT/POSTED.
-- Note: PostgreSQL adds enum values; existing DRAFT/POSTED rows unchanged.

ALTER TYPE "payroll"."PayRunStatus" ADD VALUE 'APPROVED';
ALTER TYPE "payroll"."PayRunStatus" ADD VALUE 'RECONCILED';
ALTER TYPE "payroll"."PayRunStatus" ADD VALUE 'CLOSED';
