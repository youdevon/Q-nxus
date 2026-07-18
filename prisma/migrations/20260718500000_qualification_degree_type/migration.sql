-- Evolve QualificationDegreeLevel (ASSOCIATE/BACHELOR/MASTER/DOCTORATE)
-- into QualificationDegreeType (specific award codes grouped by academic band).

CREATE TYPE "hr"."QualificationDegreeType" AS ENUM (
  'ASSOCIATE',
  'BA',
  'BSC',
  'BBA',
  'BCOM',
  'BED',
  'BENG',
  'LLB',
  'MBBS',
  'BN',
  'BFA',
  'BTECH',
  'BSW',
  'BPHARM',
  'PGCERT',
  'PGDIP',
  'MA',
  'MSC',
  'MBA',
  'MED',
  'MENG',
  'LLM',
  'MPA',
  'MPH',
  'MSW',
  'MPHIL',
  'EMBA',
  'PHD',
  'DBA',
  'EDD',
  'DENG',
  'MD',
  'DRPH',
  'PSYD',
  'DNP',
  'JD',
  'CERTIFICATE',
  'DIPLOMA',
  'HNC',
  'HND',
  'FOUNDATION',
  'GRADCERT',
  'GRADDIP',
  'PROFESSIONAL_DEGREE',
  'HONORARY',
  'OTHER'
);

ALTER TABLE "hr"."employee_qualification_documents"
ADD COLUMN "degreeType" "hr"."QualificationDegreeType";

-- Approximate legacy levels → representative award codes
UPDATE "hr"."employee_qualification_documents"
SET "degreeType" = CASE "degreeLevel"::text
  WHEN 'ASSOCIATE' THEN 'ASSOCIATE'::"hr"."QualificationDegreeType"
  WHEN 'BACHELOR' THEN 'BA'::"hr"."QualificationDegreeType"
  WHEN 'MASTER' THEN 'MA'::"hr"."QualificationDegreeType"
  WHEN 'DOCTORATE' THEN 'PHD'::"hr"."QualificationDegreeType"
  ELSE NULL
END
WHERE "degreeLevel" IS NOT NULL;

-- University subtype DEGREE/DIPLOMA is superseded by degreeType
UPDATE "hr"."employee_qualification_documents"
SET "qualificationSubtype" = NULL
WHERE "documentType"::text = 'UNIVERSITY'
  AND "qualificationSubtype" IN ('DEGREE', 'DIPLOMA');

ALTER TABLE "hr"."employee_qualification_documents"
DROP COLUMN "degreeLevel";

DROP TYPE "hr"."QualificationDegreeLevel";

-- Refresh titles from degree type labels / abbrevs
UPDATE "hr"."employee_qualification_documents" AS d
SET "title" = CASE
  WHEN d."documentType"::text = 'UNIVERSITY' THEN
    CASE
      WHEN d."degreeType"::text = 'OTHER'
        AND d."customTypeLabel" IS NOT NULL
        AND length(trim(d."customTypeLabel")) > 0
        THEN trim(d."customTypeLabel")
      WHEN d."degreeType"::text = 'ASSOCIATE' THEN 'Associate Degree (AA/AS/AAS)'
      WHEN d."degreeType"::text = 'BA' THEN 'BA'
      WHEN d."degreeType"::text = 'BSC' THEN 'BSc/BS'
      WHEN d."degreeType"::text = 'BBA' THEN 'BBA'
      WHEN d."degreeType"::text = 'BCOM' THEN 'BCom'
      WHEN d."degreeType"::text = 'BED' THEN 'BEd'
      WHEN d."degreeType"::text = 'BENG' THEN 'BEng/BE'
      WHEN d."degreeType"::text = 'LLB' THEN 'LLB'
      WHEN d."degreeType"::text = 'MBBS' THEN 'MBBS/MBChB'
      WHEN d."degreeType"::text = 'BN' THEN 'BN/BSc Nursing'
      WHEN d."degreeType"::text = 'BFA' THEN 'BFA'
      WHEN d."degreeType"::text = 'BTECH' THEN 'BTech'
      WHEN d."degreeType"::text = 'BSW' THEN 'BSW'
      WHEN d."degreeType"::text = 'BPHARM' THEN 'BPharm'
      WHEN d."degreeType"::text = 'PGCERT' THEN 'PGCert'
      WHEN d."degreeType"::text = 'PGDIP' THEN 'PGDip'
      WHEN d."degreeType"::text = 'MA' THEN 'MA'
      WHEN d."degreeType"::text = 'MSC' THEN 'MSc/MS'
      WHEN d."degreeType"::text = 'MBA' THEN 'MBA'
      WHEN d."degreeType"::text = 'MED' THEN 'MEd'
      WHEN d."degreeType"::text = 'MENG' THEN 'MEng'
      WHEN d."degreeType"::text = 'LLM' THEN 'LLM'
      WHEN d."degreeType"::text = 'MPA' THEN 'MPA'
      WHEN d."degreeType"::text = 'MPH' THEN 'MPH'
      WHEN d."degreeType"::text = 'MSW' THEN 'MSW'
      WHEN d."degreeType"::text = 'MPHIL' THEN 'MPhil'
      WHEN d."degreeType"::text = 'EMBA' THEN 'EMBA'
      WHEN d."degreeType"::text = 'PHD' THEN 'PhD/DPhil'
      WHEN d."degreeType"::text = 'DBA' THEN 'DBA'
      WHEN d."degreeType"::text = 'EDD' THEN 'EdD'
      WHEN d."degreeType"::text = 'DENG' THEN 'DEng/EngD'
      WHEN d."degreeType"::text = 'MD' THEN 'MD'
      WHEN d."degreeType"::text = 'DRPH' THEN 'DrPH'
      WHEN d."degreeType"::text = 'PSYD' THEN 'PsyD'
      WHEN d."degreeType"::text = 'DNP' THEN 'DNP'
      WHEN d."degreeType"::text = 'JD' THEN 'JD'
      WHEN d."degreeType"::text = 'CERTIFICATE' THEN 'Certificate'
      WHEN d."degreeType"::text = 'DIPLOMA' THEN 'Diploma/Advanced Diploma'
      WHEN d."degreeType"::text = 'HNC' THEN 'HNC'
      WHEN d."degreeType"::text = 'HND' THEN 'HND'
      WHEN d."degreeType"::text = 'FOUNDATION' THEN 'Foundation Degree (FdA/FdSc)'
      WHEN d."degreeType"::text = 'GRADCERT' THEN 'GradCert'
      WHEN d."degreeType"::text = 'GRADDIP' THEN 'GradDip'
      WHEN d."degreeType"::text = 'PROFESSIONAL_DEGREE' THEN 'Professional Degree'
      WHEN d."degreeType"::text = 'HONORARY' THEN 'Honorary Degree'
      WHEN d."degreeType"::text = 'OTHER' THEN 'Other degree'
      ELSE 'University qualification'
    END
  ELSE d."title"
END
WHERE d."documentType"::text = 'UNIVERSITY';
