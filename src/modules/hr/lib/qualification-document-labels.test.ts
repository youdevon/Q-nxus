import { describe, expect, it } from "vitest";

import {
  buildQualificationTaxonomySearchOptions,
  cxcGradeDisplayLabel,
  deriveQualificationDocumentTitle,
  formatQualificationSubjectSummary,
  normalizeCxcGrade,
  parseQualificationTaxonomySearchValue,
  qualificationDegreeTypeLabel,
  qualificationDocumentMetaParts,
  qualificationDocumentTypeDisplayLabel,
  qualificationNeedsCustomTypeLabel,
  qualificationSubjectsHelperText,
  qualificationSubtypeLabel,
  qualificationUsesSubjectEntries,
  QUALIFICATION_DOCUMENT_TYPE_OPTIONS,
  QUALIFICATION_SUBTYPE_OPTIONS,
  usesCxcGradeSelect,
} from "./qualification-document-labels";

describe("qualification-document-labels", () => {
  it("labels degree types for display", () => {
    expect(qualificationDegreeTypeLabel("ASSOCIATE")).toBe(
      "Associate Degree (AA/AS/AAS)",
    );
    expect(qualificationDegreeTypeLabel("BSC")).toBe("BSc/BS");
    expect(qualificationDegreeTypeLabel("MBA")).toBe("MBA");
    expect(qualificationDegreeTypeLabel("PHD")).toBe("PhD/DPhil");
    expect(qualificationDegreeTypeLabel(null)).toBeNull();
  });

  it("offers Other (specify) on every category subtype list", () => {
    const categoriesWithSubtypes = QUALIFICATION_DOCUMENT_TYPE_OPTIONS.filter(
      (option) => option.value !== "UNIVERSITY",
    );

    for (const category of categoriesWithSubtypes) {
      const options = QUALIFICATION_SUBTYPE_OPTIONS[category.value] ?? [];
      expect(options.length).toBeGreaterThan(0);
      expect(options.some((option) => option.value === "OTHER")).toBe(true);
    }
  });

  it("lists CompTIA under professional certifications for taxonomy search", () => {
    const options = buildQualificationTaxonomySearchOptions();
    const comptia = options.find((option) => option.value === "PROFESSIONAL:COMPTIA");
    expect(comptia).toMatchObject({
      label: "CompTIA",
      description: "Professional certifications",
      documentType: "PROFESSIONAL",
      qualificationSubtype: "COMPTIA",
    });
    expect(comptia?.keywords?.toLowerCase()).toContain("a+");

    const byAlias = options.filter((option) => {
      const haystack = [
        option.label,
        option.description,
        option.keywords,
        option.value,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes("comptia") || haystack.includes("security+");
    });
    expect(byAlias.some((option) => option.value === "PROFESSIONAL:COMPTIA")).toBe(
      true,
    );

    expect(parseQualificationTaxonomySearchValue("PROFESSIONAL:COMPTIA")).toEqual({
      documentType: "PROFESSIONAL",
      qualificationSubtype: "COMPTIA",
      degreeType: null,
    });
  });

  it("resolves subtype labels by document category (IGCSE collision)", () => {
    expect(qualificationSubtypeLabel("CAMBRIDGE", "IGCSE")).toBe("IGCSE");
    expect(qualificationSubtypeLabel("PEARSON_EDEXCEL", "IGCSE")).toBe(
      "International GCSE / IGCSE",
    );
    expect(qualificationSubtypeLabel("CXC", "CSEC")).toBe("CSEC");
    expect(qualificationSubtypeLabel(null, "CSEC")).toBe("CSEC");
    expect(qualificationSubtypeLabel("CXC", null)).toBeNull();
  });

  it("shows category with subtype, university degree type, and custom other", () => {
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "UNIVERSITY",
        degreeType: "MSC",
      }),
    ).toBe("MSc/MS");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "UNIVERSITY",
        degreeType: "OTHER",
        customTypeLabel: "Licentiate in Theology",
      }),
    ).toBe("Licentiate in Theology");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "CXC",
        qualificationSubtype: "CAPE",
      }),
    ).toBe("CXC · CAPE");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "CXC",
        qualificationSubtype: "OTHER",
        customTypeLabel: "CXC Skills Certificate",
      }),
    ).toBe("CXC · CXC Skills Certificate");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "CAMBRIDGE",
        qualificationSubtype: "A_LEVEL",
      }),
    ).toBe("Cambridge · A Level");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "CAMBRIDGE",
        qualificationSubtype: "IGCSE",
      }),
    ).toBe("Cambridge · IGCSE");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "PEARSON_EDEXCEL",
        qualificationSubtype: "IGCSE",
      }),
    ).toBe("Pearson Edexcel · International GCSE / IGCSE");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "VOCATIONAL",
        qualificationSubtype: "CITY_AND_GUILDS",
      }),
    ).toBe("Vocational · City & Guilds");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "PROFESSIONAL",
        qualificationSubtype: "OTHER",
        customTypeLabel: "SHRM-CP",
      }),
    ).toBe("Professional · SHRM-CP");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "TRADE_LICENCE",
        qualificationSubtype: "OTHER",
        customTypeLabel: "Electrician licence (parish)",
      }),
    ).toBe("Trade licence · Electrician licence (parish)");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "OTHER",
        qualificationSubtype: "GED",
      }),
    ).toBe("GED");
    expect(
      qualificationDocumentTypeDisplayLabel({
        documentType: "OTHER",
        qualificationSubtype: "OTHER",
        customTypeLabel: "City & Guilds legacy",
      }),
    ).toBe("City & Guilds legacy");
    expect(
      qualificationDocumentTypeDisplayLabel({ documentType: "TRADE_LICENCE" }),
    ).toBe("Trade licences");
  });

  it("omits type from meta when it duplicates the title", () => {
    expect(
      qualificationDocumentMetaParts({
        title: "CXC · CSEC",
        documentType: "CXC",
        qualificationSubtype: "CSEC",
        issuer: "CXC",
        year: 2018,
        issueDate: "18 Jan 2018",
      }),
    ).toEqual(["CXC", "2018", "18 Jan 2018"]);

    expect(
      qualificationDocumentMetaParts({
        title: "MSc/MS",
        documentType: "UNIVERSITY",
        degreeType: "MSC",
        programme: "Computer Science",
        issuer: "UWI",
        year: 2020,
      }),
    ).toEqual(["Computer Science", "UWI", "2020"]);
  });

  it("derives stored title from category, subtype, and degree type", () => {
    expect(
      deriveQualificationDocumentTitle({
        documentType: "UNIVERSITY",
        degreeType: "BA",
      }),
    ).toBe("BA");
    expect(
      deriveQualificationDocumentTitle({
        documentType: "UNIVERSITY",
        degreeType: "OTHER",
        customTypeLabel: "Doctor of Ministry",
      }),
    ).toBe("Doctor of Ministry");
    expect(
      deriveQualificationDocumentTitle({
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("CXC · CSEC");
    expect(
      deriveQualificationDocumentTitle({
        documentType: "OTHER",
        customTypeLabel: "City & Guilds",
      }),
    ).toBe("City & Guilds");
  });

  it("requires custom type label for Other subtype or degree", () => {
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "VOCATIONAL",
        qualificationSubtype: "OTHER",
      }),
    ).toBe(true);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "CXC",
        qualificationSubtype: "OTHER",
      }),
    ).toBe(true);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "CAMBRIDGE",
        qualificationSubtype: "OTHER",
      }),
    ).toBe(true);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "ADMISSION_ASSESSMENT",
        qualificationSubtype: "OTHER",
      }),
    ).toBe(true);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "TRADE_LICENCE",
        qualificationSubtype: "OTHER",
      }),
    ).toBe(true);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "VOCATIONAL",
        qualificationSubtype: "BTEC",
      }),
    ).toBe(false);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "UNIVERSITY",
        degreeType: "OTHER",
      }),
    ).toBe(true);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "UNIVERSITY",
        degreeType: "MBA",
      }),
    ).toBe(false);
    expect(
      qualificationNeedsCustomTypeLabel({
        documentType: "OTHER",
        qualificationSubtype: "GED",
      }),
    ).toBe(false);
  });

  it("uses CXC grade select only for CSEC", () => {
    expect(
      usesCxcGradeSelect({ documentType: "CXC", qualificationSubtype: "CSEC" }),
    ).toBe(true);
    expect(
      usesCxcGradeSelect({ documentType: "CXC", qualificationSubtype: null }),
    ).toBe(true);
    expect(
      usesCxcGradeSelect({ documentType: "CXC", qualificationSubtype: "CAPE" }),
    ).toBe(false);
    expect(
      usesCxcGradeSelect({
        documentType: "CXC",
        qualificationSubtype: "OTHER",
      }),
    ).toBe(false);
    expect(
      usesCxcGradeSelect({
        documentType: "CAMBRIDGE",
        qualificationSubtype: "IGCSE",
      }),
    ).toBe(false);
  });

  it("shows subject entries only for exam-board categories", () => {
    expect(qualificationUsesSubjectEntries("CXC")).toBe(true);
    expect(qualificationUsesSubjectEntries("CAMBRIDGE")).toBe(true);
    expect(qualificationUsesSubjectEntries("PEARSON_EDEXCEL")).toBe(true);
    expect(qualificationUsesSubjectEntries("IB")).toBe(true);
    expect(qualificationUsesSubjectEntries("UNIVERSITY")).toBe(false);
    expect(qualificationUsesSubjectEntries("PROFESSIONAL")).toBe(false);
    expect(qualificationUsesSubjectEntries("VOCATIONAL")).toBe(false);
    expect(qualificationUsesSubjectEntries("TRADE_LICENCE")).toBe(false);
    expect(qualificationUsesSubjectEntries("ADMISSION_ASSESSMENT")).toBe(
      false,
    );
    expect(qualificationUsesSubjectEntries("OTHER")).toBe(false);
  });

  it("returns category-aware subjects helper text", () => {
    expect(qualificationSubjectsHelperText("CXC")).toContain("CSEC");
    expect(qualificationSubjectsHelperText("CAMBRIDGE")).toContain(
      "Mathematics",
    );
    expect(qualificationSubjectsHelperText("IB")).toContain("HL / SL");
  });

  it("normalizes CXC grade aliases to I–VI", () => {
    expect(normalizeCxcGrade("I")).toBe("I");
    expect(normalizeCxcGrade("one")).toBe("I");
    expect(normalizeCxcGrade("Grade 1")).toBe("I");
    expect(normalizeCxcGrade("II")).toBe("II");
    expect(normalizeCxcGrade("2")).toBe("II");
    expect(normalizeCxcGrade("two")).toBe("II");
    expect(normalizeCxcGrade("III")).toBe("III");
    expect(normalizeCxcGrade("Grade III")).toBe("III");
    expect(normalizeCxcGrade("three")).toBe("III");
    expect(normalizeCxcGrade("IV")).toBe("IV");
    expect(normalizeCxcGrade("4")).toBe("IV");
    expect(normalizeCxcGrade("four")).toBe("IV");
    expect(normalizeCxcGrade("V")).toBe("V");
    expect(normalizeCxcGrade("five")).toBe("V");
    expect(normalizeCxcGrade("VI")).toBe("VI");
    expect(normalizeCxcGrade("6")).toBe("VI");
    expect(normalizeCxcGrade("six")).toBe("VI");
    expect(normalizeCxcGrade("Pass")).toBeNull();
    expect(normalizeCxcGrade(null)).toBeNull();
  });

  it("displays friendly CXC grade labels only for CSEC context", () => {
    expect(
      cxcGradeDisplayLabel("I", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("one (I)");
    expect(
      cxcGradeDisplayLabel("II", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("two (II)");
    expect(
      cxcGradeDisplayLabel("III", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("three (III)");
    expect(
      cxcGradeDisplayLabel("IV", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("four (IV)");
    expect(
      cxcGradeDisplayLabel("V", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("five (V)");
    expect(
      cxcGradeDisplayLabel("VI", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("six (VI)");
    expect(
      cxcGradeDisplayLabel("Grade 2", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("two (II)");
    expect(
      cxcGradeDisplayLabel("Pass", {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBe("Pass");
    expect(cxcGradeDisplayLabel(null)).toBeNull();

    // Cambridge / IB / CAPE: leave letter grades alone
    expect(
      cxcGradeDisplayLabel("A", {
        documentType: "CAMBRIDGE",
        qualificationSubtype: "IGCSE",
      }),
    ).toBe("A");
    expect(
      cxcGradeDisplayLabel("I", {
        documentType: "CAMBRIDGE",
        qualificationSubtype: "A_LEVEL",
      }),
    ).toBe("I");
    expect(
      cxcGradeDisplayLabel("II", {
        documentType: "CXC",
        qualificationSubtype: "CAPE",
      }),
    ).toBe("II");
    expect(
      cxcGradeDisplayLabel("7", {
        documentType: "IB",
        qualificationSubtype: "IBDP",
      }),
    ).toBe("7");
  });

  it("formats compact subject summaries for exam boards", () => {
    expect(
      formatQualificationSubjectSummary(
        [
          { subjectOrName: "Mathematics", gradeOrResult: "I" },
          { subjectOrName: "English", gradeOrResult: "II" },
        ],
        { documentType: "CXC", qualificationSubtype: "CSEC" },
      ),
    ).toBe("Mathematics — one (I), English — two (II)");

    expect(
      formatQualificationSubjectSummary(
        [
          { subjectOrName: "Math", gradeOrResult: "I" },
          { subjectOrName: "English", gradeOrResult: "II" },
          { subjectOrName: "Biology", gradeOrResult: "III" },
          { subjectOrName: "Chemistry", gradeOrResult: "IV" },
        ],
        { documentType: "CXC", qualificationSubtype: "CSEC" },
      ),
    ).toBe(
      "4 subjects · Math — one (I), English — two (II), Biology — three (III)…",
    );

    expect(
      formatQualificationSubjectSummary(
        [{ subjectOrName: "Mathematics", gradeOrResult: "A" }],
        { documentType: "CAMBRIDGE", qualificationSubtype: "IGCSE" },
      ),
    ).toBe("Mathematics — A");
  });
});
