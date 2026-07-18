-- Restructure QualificationDocumentType to Caribbean HR taxonomy and add subtype.

-- 1. Add subtype column
ALTER TABLE "hr"."employee_qualification_documents"
ADD COLUMN IF NOT EXISTS "qualificationSubtype" TEXT;

-- 2. Map legacy enum values → new taxonomy (via text), set subtypes, refresh titles
ALTER TABLE "hr"."employee_qualification_documents"
  ALTER COLUMN "documentType" DROP DEFAULT;

ALTER TABLE "hr"."employee_qualification_documents"
  ALTER COLUMN "documentType" TYPE TEXT
  USING ("documentType"::text);

UPDATE "hr"."employee_qualification_documents"
SET
  "customTypeLabel" = CASE "documentType"
    WHEN 'CERTIFICATE' THEN COALESCE(NULLIF(trim("customTypeLabel"), ''), 'Certificate')
    WHEN 'CUSTOM' THEN "customTypeLabel"
    ELSE "customTypeLabel"
  END,
  "qualificationSubtype" = CASE "documentType"
    WHEN 'CXC' THEN 'CSEC'
    WHEN 'CAPE' THEN 'CAPE'
    WHEN 'HIGH_SCHOOL' THEN 'HSD'
    WHEN 'DEGREE' THEN 'DEGREE'
    WHEN 'DIPLOMA' THEN 'DIPLOMA'
    WHEN 'CERTIFICATE' THEN 'OTHER'
    WHEN 'TRANSCRIPT' THEN 'TRANSCRIPT'
    WHEN 'AWARD' THEN 'AWARD'
    WHEN 'CUSTOM' THEN COALESCE("qualificationSubtype", 'OTHER')
    ELSE "qualificationSubtype"
  END,
  "documentType" = CASE "documentType"
    WHEN 'CAPE' THEN 'CXC'
    WHEN 'HIGH_SCHOOL' THEN 'OTHER'
    WHEN 'DEGREE' THEN 'UNIVERSITY'
    WHEN 'DIPLOMA' THEN 'UNIVERSITY'
    WHEN 'CERTIFICATE' THEN 'PROFESSIONAL'
    WHEN 'LICENSE' THEN 'TRADE_LICENCE'
    WHEN 'TRANSCRIPT' THEN 'OTHER'
    WHEN 'AWARD' THEN 'OTHER'
    WHEN 'CUSTOM' THEN 'OTHER'
    ELSE "documentType"
  END;

-- Keep customTypeLabel for CUSTOM→OTHER; ensure OTHER subtype when free label only
UPDATE "hr"."employee_qualification_documents"
SET "qualificationSubtype" = 'OTHER'
WHERE "documentType" = 'OTHER'
  AND "qualificationSubtype" IS NULL
  AND "customTypeLabel" IS NOT NULL
  AND length(trim("customTypeLabel")) > 0;

-- 3. Replace enum type
CREATE TYPE "hr"."QualificationDocumentType_new" AS ENUM (
  'CXC',
  'CAMBRIDGE',
  'PEARSON_EDEXCEL',
  'IB',
  'VOCATIONAL',
  'UNIVERSITY',
  'PROFESSIONAL',
  'TRADE_LICENCE',
  'ADMISSION_ASSESSMENT',
  'OTHER'
);

ALTER TABLE "hr"."employee_qualification_documents"
  ALTER COLUMN "documentType" TYPE "hr"."QualificationDocumentType_new"
  USING ("documentType"::"hr"."QualificationDocumentType_new");

DROP TYPE "hr"."QualificationDocumentType";

ALTER TYPE "hr"."QualificationDocumentType_new"
  RENAME TO "QualificationDocumentType";

ALTER TABLE "hr"."employee_qualification_documents"
  ALTER COLUMN "documentType" SET DEFAULT 'OTHER'::"hr"."QualificationDocumentType";

-- 4. Refresh derived titles from category + subtype + degree level
UPDATE "hr"."employee_qualification_documents" AS d
SET "title" = trim(BOTH ' · ' FROM concat_ws(
  ' · ',
  CASE d."documentType"::text
    WHEN 'CXC' THEN 'CXC'
    WHEN 'CAMBRIDGE' THEN 'Cambridge'
    WHEN 'PEARSON_EDEXCEL' THEN 'Pearson Edexcel'
    WHEN 'IB' THEN 'IB'
    WHEN 'VOCATIONAL' THEN 'Vocational / technical'
    WHEN 'UNIVERSITY' THEN
      CASE d."degreeLevel"::text
        WHEN 'ASSOCIATE' THEN 'University · Associate'
        WHEN 'BACHELOR' THEN 'University · Bachelor'
        WHEN 'MASTER' THEN 'University · Masters'
        WHEN 'DOCTORATE' THEN 'University · PhD / Doctorate'
        ELSE 'University qualification'
      END
    WHEN 'PROFESSIONAL' THEN 'Professional certification'
    WHEN 'TRADE_LICENCE' THEN 'Trade licence'
    WHEN 'ADMISSION_ASSESSMENT' THEN 'Admission / assessment'
    WHEN 'OTHER' THEN
      CASE
        WHEN d."customTypeLabel" IS NOT NULL AND length(trim(d."customTypeLabel")) > 0
          THEN trim(d."customTypeLabel")
        ELSE 'Other'
      END
    ELSE d."documentType"::text
  END,
  CASE
    WHEN d."documentType"::text = 'UNIVERSITY' THEN NULL
    WHEN d."documentType"::text = 'OTHER'
      AND d."customTypeLabel" IS NOT NULL
      AND length(trim(d."customTypeLabel")) > 0
      AND (d."qualificationSubtype" IS NULL OR d."qualificationSubtype" = 'OTHER')
      THEN NULL
    WHEN d."qualificationSubtype" = 'CSEC' THEN 'CSEC'
    WHEN d."qualificationSubtype" = 'CAPE' THEN 'CAPE'
    WHEN d."qualificationSubtype" = 'CVQ' THEN 'CVQ'
    WHEN d."qualificationSubtype" = 'CCSLC' THEN 'CCSLC'
    WHEN d."qualificationSubtype" = 'IGCSE' THEN 'IGCSE'
    WHEN d."qualificationSubtype" = 'O_LEVEL' THEN 'O Level'
    WHEN d."qualificationSubtype" = 'AS_LEVEL' THEN 'AS Level'
    WHEN d."qualificationSubtype" = 'A_LEVEL' THEN 'A Level'
    WHEN d."qualificationSubtype" = 'IAL' THEN 'IAL'
    WHEN d."qualificationSubtype" = 'IBDP' THEN 'IB Diploma (IBDP)'
    WHEN d."qualificationSubtype" = 'IBCP' THEN 'IB Career-related (IBCP)'
    WHEN d."qualificationSubtype" = 'CITY_AND_GUILDS' THEN 'City & Guilds'
    WHEN d."qualificationSubtype" = 'NVQ' THEN 'NVQ'
    WHEN d."qualificationSubtype" = 'NTVET' THEN 'NTVET / TVET'
    WHEN d."qualificationSubtype" = 'NCTVET' THEN 'NCTVET'
    WHEN d."qualificationSubtype" = 'HEART_NSTA' THEN 'HEART / NSTA'
    WHEN d."qualificationSubtype" = 'NTA' THEN 'NTA'
    WHEN d."qualificationSubtype" = 'ILM' THEN 'ILM'
    WHEN d."qualificationSubtype" = 'BTEC' THEN 'BTEC'
    WHEN d."qualificationSubtype" = 'NEBOSH' THEN 'NEBOSH'
    WHEN d."qualificationSubtype" = 'IOSH' THEN 'IOSH'
    WHEN d."qualificationSubtype" = 'HIGHFIELD' THEN 'Highfield / HABC'
    WHEN d."qualificationSubtype" = 'DIPLOMA' THEN 'Diploma'
    WHEN d."qualificationSubtype" = 'DEGREE' THEN 'Degree'
    WHEN d."qualificationSubtype" = 'GED' THEN 'GED'
    WHEN d."qualificationSubtype" = 'HSD' THEN 'High School Diploma'
    WHEN d."qualificationSubtype" = 'GCE_O_LEVEL' THEN 'GCE O Level'
    WHEN d."qualificationSubtype" = 'TRANSCRIPT' THEN 'Transcript'
    WHEN d."qualificationSubtype" = 'AWARD' THEN 'Award'
    WHEN d."qualificationSubtype" = 'SAT' THEN 'SAT'
    WHEN d."qualificationSubtype" = 'PSAT' THEN 'PSAT'
    WHEN d."qualificationSubtype" = 'AP' THEN 'AP'
    WHEN d."qualificationSubtype" = 'ACT' THEN 'ACT'
    WHEN d."qualificationSubtype" = 'TOEFL' THEN 'TOEFL'
    WHEN d."qualificationSubtype" = 'IELTS' THEN 'IELTS'
    WHEN d."qualificationSubtype" = 'GRE' THEN 'GRE'
    WHEN d."qualificationSubtype" = 'GMAT' THEN 'GMAT'
    WHEN d."qualificationSubtype" = 'LSAT' THEN 'LSAT'
    WHEN d."qualificationSubtype" = 'ACCA' THEN 'ACCA'
    WHEN d."qualificationSubtype" = 'CIMA' THEN 'CIMA'
    WHEN d."qualificationSubtype" = 'CPA' THEN 'CPA'
    WHEN d."qualificationSubtype" = 'PMP' THEN 'PMP'
    WHEN d."qualificationSubtype" = 'OTHER'
      AND d."customTypeLabel" IS NOT NULL
      AND length(trim(d."customTypeLabel")) > 0
      THEN trim(d."customTypeLabel")
    WHEN d."qualificationSubtype" IS NOT NULL
      AND d."qualificationSubtype" <> 'OTHER'
      THEN d."qualificationSubtype"
    ELSE NULL
  END
));
