-- Drop unused EmailTemplate store (never referenced by app code; emails use
-- inline templates + EmailDelivery.templateKey string only).
DROP TABLE IF EXISTS "notifications"."email_templates";

-- Drop legacy flat-% StatutoryRate store. PAYE/NIS/Health now live in
-- PayeTaxConfig, NisEarningsClass, and HealthSurchargeConfig respectively.
-- Calc paths never read statutory_rates.
DROP TABLE IF EXISTS "payroll"."statutory_rates";
DROP TYPE IF EXISTS "payroll"."StatutoryRateType";
