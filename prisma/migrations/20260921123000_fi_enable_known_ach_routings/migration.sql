-- Enable ACH credits for known TT commercial-bank routing numbers already on file.
-- These are the same ABA codes used on FCB salary files; operators can still turn
-- ACH off per bank under Payroll Settings → ACH banks.
UPDATE payroll.financial_institutions
SET "supportsAchCredits" = true
WHERE "isActive" = true
  AND "archivedAt" IS NULL
  AND "routingCode" IN (
    '010100013', -- First Citizens
    '010100903', -- Republic
    '010100039', -- RBC Royal
    '010100026', -- Scotiabank
    '010100602', -- CIBC FirstCaribbean
    '010100505', -- JMMB
    '010100055', -- Citibank
    '010100107'  -- Bank of Baroda / ANSA
  );

-- Seed account-length hints only where still null (do not overwrite operator edits).
UPDATE payroll.financial_institutions
SET
  "accountNumberMinLength" = CASE "routingCode"
    WHEN '010100013' THEN 1
    WHEN '010100026' THEN 12
    ELSE 7
  END,
  "accountNumberMaxLength" = CASE "routingCode"
    WHEN '010100026' THEN 14
    ELSE 17
  END
WHERE "routingCode" IN (
    '010100013',
    '010100903',
    '010100039',
    '010100026',
    '010100602',
    '010100505',
    '010100055',
    '010100107'
  )
  AND "accountNumberMinLength" IS NULL
  AND "accountNumberMaxLength" IS NULL;
