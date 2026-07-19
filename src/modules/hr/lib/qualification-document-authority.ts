/**
 * Caribbean / HR display ranking for qualification documents.
 * Highest authority first when listing on the employee file.
 *
 * Order (approximate):
 * UNIVERSITY (degree band) → PROFESSIONAL → TRADE_LICENCE / VOCATIONAL →
 * IB → Cambridge A/AS → Pearson IAL → CAPE → CXC CSEC → Cambridge IGCSE/O →
 * Pearson IGCSE → admission assessments → OTHER
 */

/** Coarse category order used when subtype is unknown. */
export const QUALIFICATION_DOCUMENT_AUTHORITY_ORDER = [
  "UNIVERSITY",
  "PROFESSIONAL",
  "TRADE_LICENCE",
  "VOCATIONAL",
  "IB",
  "CAMBRIDGE",
  "PEARSON_EDEXCEL",
  "CXC",
  "ADMISSION_ASSESSMENT",
  "OTHER",
] as const;

export type QualificationDocumentAuthorityType =
  (typeof QUALIFICATION_DOCUMENT_AUTHORITY_ORDER)[number];

/**
 * Academic bands derived from QualificationDegreeType for UNIVERSITY sorting.
 * Lower index = higher authority.
 */
export const QUALIFICATION_DEGREE_BAND_AUTHORITY_ORDER = [
  "DOCTORAL",
  "POSTGRADUATE",
  "UNDERGRADUATE",
  "OTHER_HIGHER_ED",
] as const;

export type QualificationDegreeBand =
  (typeof QUALIFICATION_DEGREE_BAND_AUTHORITY_ORDER)[number];

const DOCTORAL_TYPES = new Set([
  "PHD",
  "DBA",
  "EDD",
  "DENG",
  "MD",
  "DRPH",
  "PSYD",
  "DNP",
  "JD",
]);

const POSTGRADUATE_TYPES = new Set([
  "PGCERT",
  "PGDIP",
  "MA",
  "MSC",
  "MBA",
  "MED",
  "MENG",
  "LLM",
  "MPA",
  "MPH",
  "MSW",
  "MPHIL",
  "EMBA",
]);

const UNDERGRADUATE_TYPES = new Set([
  "BA",
  "BSC",
  "BBA",
  "BCOM",
  "BED",
  "BENG",
  "LLB",
  "MBBS",
  "BN",
  "BFA",
  "BTECH",
  "BSW",
  "BPHARM",
]);

/** Map a specific award code to an academic band for ranking. */
export function qualificationDegreeBand(
  degreeType: string | null | undefined,
): QualificationDegreeBand {
  if (!degreeType) {
    return "OTHER_HIGHER_ED";
  }
  if (DOCTORAL_TYPES.has(degreeType)) {
    return "DOCTORAL";
  }
  if (POSTGRADUATE_TYPES.has(degreeType)) {
    return "POSTGRADUATE";
  }
  if (UNDERGRADUATE_TYPES.has(degreeType)) {
    return "UNDERGRADUATE";
  }
  // ASSOCIATE, CERTIFICATE, DIPLOMA, HNC/HND, FOUNDATION, etc.
  return "OTHER_HIGHER_ED";
}

/**
 * Fine-grained authority score (lower = higher authority).
 * Incorporates subtype so Cambridge A Level ranks above CXC CSEC, etc.
 */
export function qualificationAuthorityScore(options: {
  documentType: string;
  qualificationSubtype?: string | null;
}): number {
  const type = options.documentType;
  const subtype = options.qualificationSubtype?.trim() || null;

  // Other (specify) ranks at the bottom of its category.
  const otherPenalty = subtype === "OTHER" ? 40 : 0;

  switch (type) {
    case "UNIVERSITY":
      return 0;
    case "PROFESSIONAL":
      return 100 + otherPenalty;
    case "TRADE_LICENCE":
      return 200 + otherPenalty;
    case "VOCATIONAL":
      return 250 + otherPenalty;
    case "IB":
      if (subtype === "OTHER") return 340;
      return subtype === "IBCP" ? 305 : 300;
    case "CAMBRIDGE":
      if (subtype === "OTHER") return 480;
      if (subtype === "A_LEVEL") return 400;
      if (subtype === "AS_LEVEL") return 410;
      if (subtype === "O_LEVEL") return 650;
      if (subtype === "IGCSE") return 660;
      return 420;
    case "PEARSON_EDEXCEL":
      if (subtype === "OTHER") return 540;
      if (subtype === "IAL") return 500;
      if (subtype === "IGCSE") return 700;
      return 510;
    case "CXC":
      if (subtype === "OTHER") return 640;
      if (subtype === "CAPE") return 550;
      if (subtype === "CSEC" || !subtype) return 600;
      if (subtype === "CVQ") return 610;
      if (subtype === "CCSLC") return 620;
      return 605;
    case "ADMISSION_ASSESSMENT":
      return 800 + otherPenalty;
    case "OTHER":
      return 900 + (subtype === "OTHER" || !subtype ? 20 : 0);
    default:
      return 1000;
  }
}

export function qualificationDocumentAuthorityRank(
  documentType: string,
): number {
  const index = (
    QUALIFICATION_DOCUMENT_AUTHORITY_ORDER as readonly string[]
  ).indexOf(documentType);
  return index === -1
    ? QUALIFICATION_DOCUMENT_AUTHORITY_ORDER.length
    : index;
}

export function qualificationDegreeBandAuthorityRank(
  degreeType: string | null | undefined,
): number {
  const band = qualificationDegreeBand(degreeType);
  const bandIndex = (
    QUALIFICATION_DEGREE_BAND_AUTHORITY_ORDER as readonly string[]
  ).indexOf(band);
  // Within OTHER_HIGHER_ED: certs/diplomas > honorary > other specify
  if (band === "OTHER_HIGHER_ED") {
    if (degreeType === "HONORARY") return bandIndex * 10 + 5;
    if (degreeType === "OTHER" || !degreeType) return bandIndex * 10 + 9;
    return bandIndex * 10;
  }
  return bandIndex * 10;
}

type SortableQualificationDocument = {
  documentType: string;
  qualificationSubtype?: string | null;
  degreeType?: string | null;
  year?: number | null;
  issueDate?: string | Date | null;
  title?: string | null;
};

function issueDateTime(
  value: string | Date | null | undefined,
): number | null {
  if (value == null || value === "") {
    return null;
  }

  const time =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Sort by authority score (highest first), then degree band when both are
 * UNIVERSITY, then newer year/issueDate, then title.
 */
export function compareQualificationDocumentsByAuthority(
  a: SortableQualificationDocument,
  b: SortableQualificationDocument,
): number {
  const scoreDiff =
    qualificationAuthorityScore({
      documentType: a.documentType,
      qualificationSubtype: a.qualificationSubtype,
    }) -
    qualificationAuthorityScore({
      documentType: b.documentType,
      qualificationSubtype: b.qualificationSubtype,
    });
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  if (a.documentType === "UNIVERSITY" && b.documentType === "UNIVERSITY") {
    const levelDiff =
      qualificationDegreeBandAuthorityRank(a.degreeType) -
      qualificationDegreeBandAuthorityRank(b.degreeType);
    if (levelDiff !== 0) {
      return levelDiff;
    }
  }

  const yearA = a.year ?? null;
  const yearB = b.year ?? null;
  if (yearA !== yearB) {
    if (yearA === null) {
      return 1;
    }
    if (yearB === null) {
      return -1;
    }
    return yearB - yearA;
  }

  const dateA = issueDateTime(a.issueDate);
  const dateB = issueDateTime(b.issueDate);
  if (dateA !== dateB) {
    if (dateA === null) {
      return 1;
    }
    if (dateB === null) {
      return -1;
    }
    return dateB - dateA;
  }

  return (a.title ?? "").localeCompare(b.title ?? "", undefined, {
    sensitivity: "base",
  });
}

export function sortQualificationDocumentsByAuthority<
  T extends SortableQualificationDocument,
>(items: readonly T[]): T[] {
  return [...items].sort(compareQualificationDocumentsByAuthority);
}
