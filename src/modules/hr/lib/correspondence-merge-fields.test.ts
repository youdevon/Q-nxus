import { describe, expect, it } from "vitest";

import {
  applyCorrespondenceMergeFields,
  buildCorrespondenceMergeContext,
} from "@/src/modules/hr/lib/correspondence-merge-fields";

describe("applyCorrespondenceMergeFields", () => {
  it("replaces known placeholders", () => {
    const result = applyCorrespondenceMergeFields(
      "Dear {{employeeName}} ({{employeeNumber}}), NIS {{nisNumber}} BIR {{birNumber}}, position {{position}} as of {{date}}.",
      {
        employeeName: "Ada Lovelace",
        employeeNumber: "E-100",
        position: "Analyst",
        date: "2026-07-17",
        nisNumber: "NIS-1",
        birNumber: "BIR-1",
      },
    );

    expect(result).toBe(
      "Dear Ada Lovelace (E-100), NIS NIS-1 BIR BIR-1, position Analyst as of 2026-07-17.",
    );
  });

  it("leaves unknown placeholders intact", () => {
    expect(
      applyCorrespondenceMergeFields("Hello {{unknown}}", {
        employeeName: "A",
        employeeNumber: "1",
        position: "P",
        date: "2026-01-01",
        nisNumber: "—",
        birNumber: "—",
      }),
    ).toBe("Hello {{unknown}}");
  });
});

describe("buildCorrespondenceMergeContext", () => {
  it("builds context from employee fields", () => {
    const context = buildCorrespondenceMergeContext({
      firstName: "Ada",
      lastName: "Lovelace",
      employeeNumber: "E-100",
      positionTitle: "Analyst",
      nisNumber: "NIS-1",
      birNumber: "BIR-1",
      effectiveDate: new Date("2026-07-17T00:00:00.000Z"),
    });

    expect(context).toEqual({
      employeeName: "Ada Lovelace",
      employeeNumber: "E-100",
      position: "Analyst",
      date: "2026-07-17",
      nisNumber: "NIS-1",
      birNumber: "BIR-1",
    });
  });
});
