/**
 * Display labels and subtype presets for qualification document taxonomy.
 *
 * ADR-style note (P1-3 / structure review):
 * - Do **not** drop or wholesale-migrate the Prisma `QualificationDegreeType`
 *   enum in a single pass — dual-read / dual-write would be required first.
 * - Prefer adding UI-only degree / document presets here (labels + constants)
 *   before promoting a new code into the Prisma enum. Client-safe constants
 *   must not import Prisma enums when that would force a migration for a
 *   display-only preset; use string literal unions mirrored from the enum
 *   when shipping browser bundles.
 * - When a preset becomes persisted SoT, add the enum value in a dedicated
 *   migration with dual-read for any legacy codes.
 */

import type { QualificationDegreeType } from "@/generated/prisma/client";

export const QUALIFICATION_DOCUMENT_TYPE_OPTIONS = [
  { value: "CXC", label: "CXC qualifications" },
  { value: "CAMBRIDGE", label: "Cambridge qualifications" },
  { value: "PEARSON_EDEXCEL", label: "Pearson Edexcel qualifications" },
  { value: "IB", label: "IB qualifications" },
  { value: "VOCATIONAL", label: "Vocational / technical" },
  { value: "UNIVERSITY", label: "University qualifications" },
  { value: "PROFESSIONAL", label: "Professional certifications" },
  { value: "TRADE_LICENCE", label: "Trade licences" },
  { value: "ADMISSION_ASSESSMENT", label: "Admission / assessment" },
  { value: "OTHER", label: "Other qualifications" },
] as const;

export type QualificationDocumentTypeValue =
  (typeof QUALIFICATION_DOCUMENT_TYPE_OPTIONS)[number]["value"];

export type QualificationDegreeTypeOption = {
  value: QualificationDegreeType;
  label: string;
};

export type QualificationDegreeTypeGroup = {
  band: string;
  label: string;
  options: QualificationDegreeTypeOption[];
};

/** Specific university award codes, grouped for the form optgroups. */
export const QUALIFICATION_DEGREE_TYPE_GROUPS: QualificationDegreeTypeGroup[] = [
  {
    band: "UNDERGRADUATE",
    label: "Undergraduate",
    options: [
      { value: "ASSOCIATE", label: "Associate Degree (AA/AS/AAS)" },
      { value: "BA", label: "BA" },
      { value: "BSC", label: "BSc/BS" },
      { value: "BBA", label: "BBA" },
      { value: "BCOM", label: "BCom" },
      { value: "BED", label: "BEd" },
      { value: "BENG", label: "BEng/BE" },
      { value: "LLB", label: "LLB" },
      { value: "MBBS", label: "MBBS/MBChB" },
      { value: "BN", label: "BN/BSc Nursing" },
      { value: "BFA", label: "BFA" },
      { value: "BTECH", label: "BTech" },
      { value: "BSW", label: "BSW" },
      { value: "BPHARM", label: "BPharm" },
    ],
  },
  {
    band: "POSTGRADUATE",
    label: "Postgraduate",
    options: [
      { value: "PGCERT", label: "PGCert" },
      { value: "PGDIP", label: "PGDip" },
      { value: "MA", label: "MA" },
      { value: "MSC", label: "MSc/MS" },
      { value: "MBA", label: "MBA" },
      { value: "MED", label: "MEd" },
      { value: "MENG", label: "MEng" },
      { value: "LLM", label: "LLM" },
      { value: "MPA", label: "MPA" },
      { value: "MPH", label: "MPH" },
      { value: "MSW", label: "MSW" },
      { value: "MPHIL", label: "MPhil" },
      { value: "EMBA", label: "EMBA" },
    ],
  },
  {
    band: "DOCTORAL",
    label: "Doctoral",
    options: [
      { value: "PHD", label: "PhD/DPhil" },
      { value: "DBA", label: "DBA" },
      { value: "EDD", label: "EdD" },
      { value: "DENG", label: "DEng/EngD" },
      { value: "MD", label: "MD" },
      { value: "DRPH", label: "DrPH" },
      { value: "PSYD", label: "PsyD" },
      { value: "DNP", label: "DNP" },
      { value: "JD", label: "JD" },
    ],
  },
  {
    band: "OTHER_HIGHER_ED",
    label: "Other higher-education",
    options: [
      { value: "CERTIFICATE", label: "Certificate" },
      { value: "DIPLOMA", label: "Diploma/Advanced Diploma" },
      { value: "HNC", label: "HNC" },
      { value: "HND", label: "HND" },
      { value: "FOUNDATION", label: "Foundation Degree (FdA/FdSc)" },
      { value: "GRADCERT", label: "GradCert" },
      { value: "GRADDIP", label: "GradDip" },
      { value: "PROFESSIONAL_DEGREE", label: "Professional Degree" },
      { value: "HONORARY", label: "Honorary Degree" },
      { value: "OTHER", label: "Other degree (specify)…" },
    ],
  },
];

export const QUALIFICATION_DEGREE_TYPE_OPTIONS: QualificationDegreeTypeOption[] =
  QUALIFICATION_DEGREE_TYPE_GROUPS.flatMap((group) => group.options);
/** Stable CXC CSEC grade codes stored on qualification entries. */
export const CXC_GRADE_OPTIONS = [
  { value: "I", label: "one (I)" },
  { value: "II", label: "two (II)" },
  { value: "III", label: "three (III)" },
  { value: "IV", label: "four (IV)" },
  { value: "V", label: "five (V)" },
  { value: "VI", label: "six (VI)" },
] as const;

export type CxcGradeCode = (typeof CXC_GRADE_OPTIONS)[number]["value"];

const CXC_GRADE_ALIASES: Record<string, CxcGradeCode> = {
  I: "I",
  "1": "I",
  ONE: "I",
  II: "II",
  "2": "II",
  TWO: "II",
  III: "III",
  "3": "III",
  THREE: "III",
  IV: "IV",
  "4": "IV",
  FOUR: "IV",
  V: "V",
  "5": "V",
  FIVE: "V",
  VI: "VI",
  "6": "VI",
  SIX: "VI",
};

const OTHER_SPECIFY = { value: "OTHER", label: "Other (specify)…" } as const;

/**
 * Subtype presets per category. Every list ends with Other (specify) so
 * unlisted awards can always be entered via customTypeLabel.
 * UNIVERSITY uses degreeType (which also includes Other) instead of subtype.
 */
export const QUALIFICATION_SUBTYPE_OPTIONS: Record<
  string,
  readonly { value: string; label: string }[]
> = {
  CXC: [
    { value: "CSEC", label: "CSEC" },
    { value: "CAPE", label: "CAPE" },
    { value: "CVQ", label: "CVQ" },
    { value: "CCSLC", label: "CCSLC" },
    OTHER_SPECIFY,
  ],
  CAMBRIDGE: [
    { value: "IGCSE", label: "IGCSE" },
    { value: "O_LEVEL", label: "O Level" },
    { value: "AS_LEVEL", label: "AS Level" },
    { value: "A_LEVEL", label: "A Level" },
    OTHER_SPECIFY,
  ],
  PEARSON_EDEXCEL: [
    { value: "IGCSE", label: "International GCSE / IGCSE" },
    { value: "IAL", label: "IAL (International A Level)" },
    OTHER_SPECIFY,
  ],
  IB: [
    { value: "IBDP", label: "IB Diploma (IBDP)" },
    { value: "IBCP", label: "IB Career-related Programme (IBCP)" },
    OTHER_SPECIFY,
  ],
  VOCATIONAL: [
    { value: "CITY_AND_GUILDS", label: "City & Guilds" },
    { value: "NVQ", label: "NVQ" },
    { value: "NTVET", label: "NTVET / TVET" },
    { value: "NCTVET", label: "NCTVET" },
    { value: "HEART_NSTA", label: "HEART / NSTA" },
    { value: "NTA", label: "NTA" },
    { value: "ILM", label: "ILM" },
    { value: "BTEC", label: "BTEC" },
    { value: "NEBOSH", label: "NEBOSH" },
    { value: "IOSH", label: "IOSH" },
    { value: "HIGHFIELD", label: "Highfield / HABC" },
    OTHER_SPECIFY,
  ],
  PROFESSIONAL: [
    { value: "ACCA", label: "ACCA" },
    { value: "CIMA", label: "CIMA" },
    { value: "CPA", label: "CPA" },
    { value: "PMP", label: "PMP" },
    { value: "COMPTIA", label: "CompTIA" },
    { value: "CISCO", label: "Cisco (CCNA / CCNP)" },
    { value: "MICROSOFT", label: "Microsoft certification" },
    { value: "AWS", label: "AWS certification" },
    { value: "ITIL", label: "ITIL" },
    { value: "SHRM", label: "SHRM / HR certification" },
    OTHER_SPECIFY,
  ],
  TRADE_LICENCE: [
    { value: "TRADE", label: "Trade licence" },
    { value: "PROFESSIONAL_LICENCE", label: "Professional licence" },
    { value: "PERMIT", label: "Permit" },
    OTHER_SPECIFY,
  ],
  ADMISSION_ASSESSMENT: [
    { value: "SAT", label: "SAT" },
    { value: "PSAT", label: "PSAT" },
    { value: "AP", label: "AP" },
    { value: "ACT", label: "ACT" },
    { value: "TOEFL", label: "TOEFL" },
    { value: "IELTS", label: "IELTS" },
    { value: "GRE", label: "GRE" },
    { value: "GMAT", label: "GMAT" },
    { value: "LSAT", label: "LSAT" },
    OTHER_SPECIFY,
  ],
  OTHER: [
    { value: "GED", label: "GED" },
    { value: "HSD", label: "High School Diploma" },
    { value: "GCE_O_LEVEL", label: "GCE O Level" },
    { value: "TRANSCRIPT", label: "Transcript" },
    { value: "AWARD", label: "Award" },
    OTHER_SPECIFY,
  ],
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUALIFICATION_DOCUMENT_TYPE_OPTIONS.map((option) => [
    option.value,
    option.label,
  ]),
);

const DEGREE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUALIFICATION_DEGREE_TYPE_OPTIONS.map((option) => [
    option.value,
    option.label,
  ]),
);

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  CXC: "CXC",
  CAMBRIDGE: "Cambridge",
  PEARSON_EDEXCEL: "Pearson Edexcel",
  IB: "IB",
  VOCATIONAL: "Vocational",
  PROFESSIONAL: "Professional",
  TRADE_LICENCE: "Trade licence",
  ADMISSION_ASSESSMENT: "Assessment",
  OTHER: "Other",
  UNIVERSITY: "University",
};

/** Prefer searchable selects when a preset list exceeds this size. */
export const QUALIFICATION_SEARCHABLE_OPTION_THRESHOLD = 8;

export type QualificationTaxonomySearchOption = {
  /** Stable select value (category + subtype/degree). */
  value: string;
  /** Primary label shown in the finder (e.g. CompTIA). */
  label: string;
  /** Category path shown under the label. */
  description: string;
  documentType: string;
  qualificationSubtype: string | null;
  degreeType: string | null;
  /** Extra tokens matched by the finder (aliases, common names). */
  keywords?: string;
};

/**
 * Alias keywords so people can find a category/subtype by brand or exam name
 * even when the preset label is abbreviated.
 */
const TAXONOMY_SEARCH_KEYWORDS: Record<string, string> = {
  "PROFESSIONAL:COMPTIA":
    "comptia a+ network+ security+ cyas+ linux+ it certification vendor",
  "PROFESSIONAL:CISCO": "cisco ccna ccnp ccnp enterprise networking",
  "PROFESSIONAL:MICROSOFT": "microsoft azure m365 mcsa mcp",
  "PROFESSIONAL:AWS": "amazon aws cloud practitioner solutions architect",
  "PROFESSIONAL:ITIL": "itil it service management",
  "PROFESSIONAL:PMP": "pmp project management institute pmi",
  "PROFESSIONAL:ACCA": "acca accounting chartered",
  "PROFESSIONAL:CIMA": "cima management accounting",
  "PROFESSIONAL:CPA": "cpa certified public accountant",
  "PROFESSIONAL:SHRM": "shrm phr sphr human resources hr",
  "VOCATIONAL:NEBOSH": "nebosh health safety",
  "VOCATIONAL:CITY_AND_GUILDS": "city and guilds city&guilds",
  "CXC:CSEC": "csec cxc caribbean secondary",
  "CXC:CAPE": "cape cxc caribbean advanced",
};

/**
 * Flat searchable index across categories, subtypes, and university degrees.
 * Used by the “Find a type” control on the qualification form.
 */
export function buildQualificationTaxonomySearchOptions(): QualificationTaxonomySearchOption[] {
  const options: QualificationTaxonomySearchOption[] = [];

  for (const category of QUALIFICATION_DOCUMENT_TYPE_OPTIONS) {
    if (category.value === "UNIVERSITY") {
      for (const degree of QUALIFICATION_DEGREE_TYPE_OPTIONS) {
        if (degree.value === "OTHER") {
          continue;
        }
        const value = `UNIVERSITY::${degree.value}`;
        options.push({
          value,
          label: degree.label,
          description: category.label,
          documentType: "UNIVERSITY",
          qualificationSubtype: null,
          degreeType: degree.value,
          keywords: TAXONOMY_SEARCH_KEYWORDS[value],
        });
      }
      options.push({
        value: "UNIVERSITY::",
        label: "University award (choose degree type)",
        description: category.label,
        documentType: "UNIVERSITY",
        qualificationSubtype: null,
        degreeType: null,
        keywords: "degree bachelor masters doctorate phd university college",
      });
      continue;
    }

    const subtypes = qualificationSubtypeOptionsFor(category.value);
    options.push({
      value: `${category.value}::`,
      label: category.label,
      description: "Category",
      documentType: category.value,
      qualificationSubtype: null,
      degreeType: null,
      keywords: SHORT_CATEGORY_LABELS[category.value],
    });

    for (const subtype of subtypes) {
      if (subtype.value === "OTHER") {
        continue;
      }
      const value = `${category.value}:${subtype.value}`;
      options.push({
        value,
        label: subtype.label,
        description: category.label,
        documentType: category.value,
        qualificationSubtype: subtype.value,
        degreeType: null,
        keywords: TAXONOMY_SEARCH_KEYWORDS[value],
      });
    }
  }

  return options;
}

export function parseQualificationTaxonomySearchValue(
  value: string,
): Pick<
  QualificationTaxonomySearchOption,
  "documentType" | "qualificationSubtype" | "degreeType"
> | null {
  const match = buildQualificationTaxonomySearchOptions().find(
    (option) => option.value === value,
  );
  if (!match) {
    return null;
  }
  return {
    documentType: match.documentType,
    qualificationSubtype: match.qualificationSubtype,
    degreeType: match.degreeType,
  };
}

export function qualificationSubtypeOptionsFor(
  documentType: string,
): readonly { value: string; label: string }[] {
  return QUALIFICATION_SUBTYPE_OPTIONS[documentType] ?? [];
}

/** Categories where a subtype is required when options exist. */
const REQUIRED_SUBTYPE_TYPES = new Set([
  "CXC",
  "CAMBRIDGE",
  "PEARSON_EDEXCEL",
  "IB",
  "ADMISSION_ASSESSMENT",
]);

/** Exam/board categories that use multi-subject result rows. */
const SUBJECT_ENTRY_TYPES = new Set([
  "CXC",
  "CAMBRIDGE",
  "PEARSON_EDEXCEL",
  "IB",
]);

export function qualificationSubtypeRequired(documentType: string): boolean {
  return REQUIRED_SUBTYPE_TYPES.has(documentType);
}

/**
 * Whether the form should collect subject / result entry rows.
 * Only secondary exam boards (CXC, Cambridge, Pearson, IB).
 */
export function qualificationUsesSubjectEntries(
  documentType: string,
): boolean {
  return SUBJECT_ENTRY_TYPES.has(documentType);
}

/** Helper copy under Subjects / results, keyed by exam-board category. */
export function qualificationSubjectsHelperText(
  documentType: string,
): string {
  switch (documentType) {
    case "CXC":
      return "Add one line per subject on this document. CSEC example: Mathematics — one (I). CAPE: use Level for Unit 1 / Unit 2 when needed.";
    case "CAMBRIDGE":
      return "Add one line per subject (e.g. Mathematics — A). Use Level for AS/A or paper details when needed.";
    case "PEARSON_EDEXCEL":
      return "Add one line per subject or unit. Use Level when the award distinguishes Unit 1 / Unit 2 or similar.";
    case "IB":
      return "Add one line per subject. Use Level for HL / SL when needed.";
    default:
      return "Add one line per subject on this document.";
  }
}

/**
 * Resolve a subtype label within its document category.
 * Avoids collisions (e.g. IGCSE differs for Cambridge vs Pearson).
 */
export function qualificationSubtypeLabel(
  documentType: string | null | undefined,
  subtype: string | null | undefined,
): string | null {
  if (!subtype) {
    return null;
  }

  if (documentType) {
    const options = qualificationSubtypeOptionsFor(documentType);
    const match = options.find((option) => option.value === subtype);
    if (match) {
      return match.label;
    }
  }

  // Fallback: first matching label across categories (legacy callers / unknown type).
  for (const options of Object.values(QUALIFICATION_SUBTYPE_OPTIONS)) {
    const match = options.find((option) => option.value === subtype);
    if (match) {
      return match.label;
    }
  }

  return subtype;
}

export function qualificationDegreeTypeLabel(
  degreeType: string | null | undefined,
): string | null {
  if (!degreeType) {
    return null;
  }

  return DEGREE_TYPE_LABELS[degreeType] ?? degreeType;
}

/**
 * Whether the form should collect a free-text customTypeLabel for this
 * category / subtype / degree type combination.
 */
export function qualificationNeedsCustomTypeLabel(options: {
  documentType: string;
  qualificationSubtype?: string | null;
  degreeType?: string | null;
}): boolean {
  const { documentType, qualificationSubtype, degreeType } = options;

  if (documentType === "UNIVERSITY" && degreeType === "OTHER") {
    return true;
  }

  if (qualificationSubtype === "OTHER") {
    return true;
  }

  return (
    documentType === "OTHER" &&
    (!qualificationSubtype || qualificationSubtype === "OTHER")
  );
}

/**
 * Use CXC I–VI grade select for CSEC (or CXC with no subtype).
 * CAPE / CVQ / CCSLC use free-text grades.
 */
export function usesCxcGradeSelect(options: {
  documentType: string;
  qualificationSubtype?: string | null;
}): boolean {
  if (options.documentType !== "CXC") {
    return false;
  }

  const subtype = options.qualificationSubtype?.trim() || null;
  return !subtype || subtype === "CSEC";
}

/**
 * Map free-text / legacy CXC grades onto stable codes I–VI.
 * Returns null when the value is empty or unrecognized.
 */
export function normalizeCxcGrade(
  raw: string | null | undefined,
): CxcGradeCode | null {
  if (!raw) {
    return null;
  }

  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/^GRADE\s*/i, "")
    .replace(/[\s._-]+/g, "");

  return CXC_GRADE_ALIASES[cleaned] ?? null;
}

type CxcGradeDisplayOptions = {
  documentType: string;
  qualificationSubtype?: string | null;
};

/**
 * Friendly label for stored CXC CSEC grades (I → "one (I)").
 * Only expands Roman numerals when the document uses the CXC grade select;
 * Cambridge / IB / other free-text grades are returned as-is.
 */
export function cxcGradeDisplayLabel(
  raw: string | null | undefined,
  options?: CxcGradeDisplayOptions,
): string | null {
  if (!raw) {
    return null;
  }

  if (
    options &&
    !usesCxcGradeSelect({
      documentType: options.documentType,
      qualificationSubtype: options.qualificationSubtype,
    })
  ) {
    return raw;
  }

  // Without document context, only expand recognized CXC codes (callers that
  // already know they are showing CSEC grades). Prefer passing options.
  const normalized = normalizeCxcGrade(raw);
  if (!normalized) {
    return raw;
  }

  const match = CXC_GRADE_OPTIONS.find((option) => option.value === normalized);
  return match?.label ?? raw;
}

type DisplayLabelOptions = {
  documentType: string;
  qualificationSubtype?: string | null;
  customTypeLabel?: string | null;
  degreeType?: string | null;
};

/**
 * Human-readable document type for lists and print.
 * Builds from category + subtype + degree type / custom label.
 */
export function qualificationDocumentTypeDisplayLabel(
  options: DisplayLabelOptions,
): string {
  const {
    documentType,
    qualificationSubtype,
    customTypeLabel,
    degreeType,
  } = options;

  const trimmedCustom = customTypeLabel?.trim() || null;
  const subtype = qualificationSubtype?.trim() || null;

  if (documentType === "OTHER") {
    if (subtype && subtype !== "OTHER") {
      const subtypeLabel = qualificationSubtypeLabel(documentType, subtype);
      return subtypeLabel ?? subtype;
    }
    if (trimmedCustom) {
      return trimmedCustom;
    }
    return "Other qualifications";
  }

  if (documentType === "UNIVERSITY") {
    if (degreeType === "OTHER" && trimmedCustom) {
      return trimmedCustom;
    }
    const typeLabel = qualificationDegreeTypeLabel(degreeType);
    return typeLabel ?? "University qualifications";
  }

  const categoryLabel =
    DOCUMENT_TYPE_LABELS[documentType] ?? documentType;
  const shortCategory =
    SHORT_CATEGORY_LABELS[documentType] ?? categoryLabel;

  if (subtype === "OTHER" && trimmedCustom) {
    return `${shortCategory} · ${trimmedCustom}`;
  }

  if (subtype) {
    const subtypeLabel = qualificationSubtypeLabel(documentType, subtype);
    if (subtypeLabel) {
      return `${shortCategory} · ${subtypeLabel}`;
    }
  }

  return categoryLabel;
}

/**
 * Derive the stored `title` from document type (+ subtype / degree / custom).
 * Keeps the DB title column populated without a form Title field.
 */
export function deriveQualificationDocumentTitle(
  options: DisplayLabelOptions,
): string {
  return qualificationDocumentTypeDisplayLabel(options);
}

/**
 * Meta line parts for list/print: issuer, year, issue date, programme.
 * Omits the type label when it duplicates the document title.
 */
export function qualificationDocumentMetaParts(options: {
  title: string;
  documentType: string;
  qualificationSubtype?: string | null;
  customTypeLabel?: string | null;
  degreeType?: string | null;
  issuer?: string | null;
  year?: number | null;
  issueDate?: string | null;
  programme?: string | null;
}): string[] {
  const typeLabel = qualificationDocumentTypeDisplayLabel({
    documentType: options.documentType,
    qualificationSubtype: options.qualificationSubtype,
    customTypeLabel: options.customTypeLabel,
    degreeType: options.degreeType,
  });

  const parts: string[] = [];

  if (typeLabel !== options.title) {
    parts.push(typeLabel);
  }

  if (options.programme?.trim()) {
    parts.push(options.programme.trim());
  }

  if (options.issuer?.trim()) {
    parts.push(options.issuer.trim());
  }

  if (options.year != null) {
    parts.push(String(options.year));
  }

  if (options.issueDate?.trim()) {
    parts.push(options.issueDate.trim());
  }

  return parts;
}

type SubjectSummaryEntry = {
  subjectOrName: string;
  gradeOrResult: string | null;
  level?: string | null;
};

/**
 * Compact subject line for exam-board qualification lists
 * (e.g. "3 subjects · Mathematics — one (I), English — two (II)…").
 */
export function formatQualificationSubjectSummary(
  entries: SubjectSummaryEntry[],
  options: {
    documentType: string;
    qualificationSubtype?: string | null;
  },
  maxVisible = 3,
): string | null {
  if (entries.length === 0) {
    return null;
  }

  const parts = entries.map((entry) => {
    const grade = cxcGradeDisplayLabel(entry.gradeOrResult, options);
    const base = grade
      ? `${entry.subjectOrName} — ${grade}`
      : entry.subjectOrName;
    return entry.level ? `${base} (${entry.level})` : base;
  });

  if (parts.length <= maxVisible) {
    return parts.join(", ");
  }

  return `${entries.length} subjects · ${parts.slice(0, maxVisible).join(", ")}…`;
}
