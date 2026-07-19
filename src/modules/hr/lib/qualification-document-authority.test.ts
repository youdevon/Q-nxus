import { describe, expect, it } from "vitest";

import {
  compareQualificationDocumentsByAuthority,
  QUALIFICATION_DOCUMENT_AUTHORITY_ORDER,
  qualificationAuthorityScore,
  qualificationDegreeBandAuthorityRank,
  qualificationDocumentAuthorityRank,
  sortQualificationDocumentsByAuthority,
} from "./qualification-document-authority";

describe("qualification-document-authority", () => {
  it("ranks University highest and Other lowest at category level", () => {
    expect(qualificationDocumentAuthorityRank("UNIVERSITY")).toBe(0);
    expect(qualificationDocumentAuthorityRank("PROFESSIONAL")).toBe(1);
    expect(qualificationDocumentAuthorityRank("TRADE_LICENCE")).toBe(2);
    expect(qualificationDocumentAuthorityRank("VOCATIONAL")).toBe(3);
    expect(qualificationDocumentAuthorityRank("IB")).toBe(4);
    expect(qualificationDocumentAuthorityRank("CAMBRIDGE")).toBe(5);
    expect(qualificationDocumentAuthorityRank("PEARSON_EDEXCEL")).toBe(6);
    expect(qualificationDocumentAuthorityRank("CXC")).toBe(7);
    expect(qualificationDocumentAuthorityRank("ADMISSION_ASSESSMENT")).toBe(8);
    expect(qualificationDocumentAuthorityRank("OTHER")).toBe(9);
    expect(qualificationDocumentAuthorityRank("UNKNOWN")).toBeGreaterThan(
      qualificationDocumentAuthorityRank("OTHER"),
    );
  });

  it("orders Caribbean secondary boards by subtype authority", () => {
    expect(
      qualificationAuthorityScore({
        documentType: "CAMBRIDGE",
        qualificationSubtype: "A_LEVEL",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "PEARSON_EDEXCEL",
        qualificationSubtype: "IAL",
      }),
    );
    expect(
      qualificationAuthorityScore({
        documentType: "PEARSON_EDEXCEL",
        qualificationSubtype: "IAL",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "CXC",
        qualificationSubtype: "CAPE",
      }),
    );
    expect(
      qualificationAuthorityScore({
        documentType: "CXC",
        qualificationSubtype: "CAPE",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    );
    expect(
      qualificationAuthorityScore({
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "CAMBRIDGE",
        qualificationSubtype: "IGCSE",
      }),
    );
    expect(
      qualificationAuthorityScore({
        documentType: "CAMBRIDGE",
        qualificationSubtype: "IGCSE",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "PEARSON_EDEXCEL",
        qualificationSubtype: "IGCSE",
      }),
    );
    expect(QUALIFICATION_DOCUMENT_AUTHORITY_ORDER).toEqual([
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
    ]);
  });

  it("ranks Other (specify) below named subtypes within a category", () => {
    expect(
      qualificationAuthorityScore({
        documentType: "PROFESSIONAL",
        qualificationSubtype: "ACCA",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "PROFESSIONAL",
        qualificationSubtype: "OTHER",
      }),
    );
    expect(
      qualificationAuthorityScore({
        documentType: "CXC",
        qualificationSubtype: "CSEC",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "CXC",
        qualificationSubtype: "OTHER",
      }),
    );
    expect(
      qualificationAuthorityScore({
        documentType: "VOCATIONAL",
        qualificationSubtype: "BTEC",
      }),
    ).toBeLessThan(
      qualificationAuthorityScore({
        documentType: "VOCATIONAL",
        qualificationSubtype: "OTHER",
      }),
    );
  });

  it("ranks doctoral degree types above postgraduate and undergraduate", () => {
    expect(qualificationDegreeBandAuthorityRank("PHD")).toBeLessThan(
      qualificationDegreeBandAuthorityRank("MBA"),
    );
    expect(qualificationDegreeBandAuthorityRank("MBA")).toBeLessThan(
      qualificationDegreeBandAuthorityRank("BSC"),
    );
    expect(qualificationDegreeBandAuthorityRank("BSC")).toBeLessThan(
      qualificationDegreeBandAuthorityRank("ASSOCIATE"),
    );
    expect(qualificationDegreeBandAuthorityRank("ASSOCIATE")).toBeLessThan(
      qualificationDegreeBandAuthorityRank("HONORARY"),
    );
    expect(qualificationDegreeBandAuthorityRank("HONORARY")).toBeLessThan(
      qualificationDegreeBandAuthorityRank("OTHER"),
    );
    expect(qualificationDegreeBandAuthorityRank(null)).toBe(
      qualificationDegreeBandAuthorityRank("OTHER"),
    );
  });

  it("sorts by authority first, then newer year within the same type", () => {
    const sorted = sortQualificationDocumentsByAuthority([
      {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
        year: 2020,
        title: "CXC 2020",
      },
      {
        documentType: "UNIVERSITY",
        degreeType: "BSC",
        year: 2015,
        title: "BSc",
      },
      {
        documentType: "CXC",
        qualificationSubtype: "CSEC",
        year: 2018,
        title: "CXC 2018",
      },
      {
        documentType: "PROFESSIONAL",
        year: 2019,
        title: "ACCA",
      },
      {
        documentType: "CXC",
        qualificationSubtype: "CAPE",
        year: 2017,
        title: "CAPE",
      },
      {
        documentType: "VOCATIONAL",
        year: 2020,
        title: "Vocational",
      },
      {
        documentType: "OTHER",
        year: 2021,
        title: "Other",
      },
      {
        documentType: "ADMISSION_ASSESSMENT",
        qualificationSubtype: "SAT",
        year: 2022,
        title: "SAT",
      },
    ]);

    expect(sorted.map((item) => item.title)).toEqual([
      "BSc",
      "ACCA",
      "Vocational",
      "CAPE",
      "CXC 2020",
      "CXC 2018",
      "SAT",
      "Other",
    ]);
  });

  it("within University, sorts by degree band then year", () => {
    const sorted = sortQualificationDocumentsByAuthority([
      {
        documentType: "UNIVERSITY",
        degreeType: "BSC",
        year: 2020,
        title: "BSc",
      },
      {
        documentType: "UNIVERSITY",
        degreeType: "PHD",
        year: 2010,
        title: "PhD",
      },
      {
        documentType: "UNIVERSITY",
        degreeType: "MSC",
        year: 2018,
        title: "MSc",
      },
      {
        documentType: "UNIVERSITY",
        degreeType: "ASSOCIATE",
        year: 2022,
        title: "AA",
      },
      {
        documentType: "UNIVERSITY",
        degreeType: "OTHER",
        year: 2021,
        title: "Custom degree",
      },
    ]);

    expect(sorted.map((item) => item.title)).toEqual([
      "PhD",
      "MSc",
      "BSc",
      "AA",
      "Custom degree",
    ]);
  });

  it("uses issueDate when years match, and title as final tiebreaker", () => {
    expect(
      compareQualificationDocumentsByAuthority(
        {
          documentType: "UNIVERSITY",
          degreeType: "BA",
          year: 2020,
          issueDate: "2020-06-01",
          title: "A",
        },
        {
          documentType: "UNIVERSITY",
          degreeType: "BA",
          year: 2020,
          issueDate: "2020-12-01",
          title: "B",
        },
      ),
    ).toBeGreaterThan(0);

    expect(
      compareQualificationDocumentsByAuthority(
        {
          documentType: "UNIVERSITY",
          degreeType: "BA",
          year: 2020,
          title: "Alpha",
        },
        {
          documentType: "UNIVERSITY",
          degreeType: "BA",
          year: 2020,
          title: "Beta",
        },
      ),
    ).toBe("Alpha".localeCompare("Beta", undefined, { sensitivity: "base" }));
  });
});
