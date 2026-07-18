import { describe, expect, it } from "vitest";

import {
  matchesAssumptionOfDutyCorrespondence,
  matchesCredentialForChecklistItem,
  resolveEmployeeFileChecklist,
  summarizeChecklistCompleteness,
} from "@/src/modules/hr/lib/employee-file-checklist";

describe("matchesCredentialForChecklistItem", () => {
  it("matches ID-style credential names", () => {
    expect(matchesCredentialForChecklistItem("COPY_OF_ID", "National ID")).toBe(
      true,
    );
    expect(matchesCredentialForChecklistItem("COPY_OF_ID", "Passport")).toBe(
      true,
    );
    expect(
      matchesCredentialForChecklistItem("COPY_OF_ID", "Driver's Licence"),
    ).toBe(true);
  });

  it("matches birth and marriage certificate names", () => {
    expect(
      matchesCredentialForChecklistItem(
        "BIRTH_CERTIFICATE",
        "Birth Certificate",
      ),
    ).toBe(true);
    expect(
      matchesCredentialForChecklistItem(
        "MARRIAGE_CERTIFICATE",
        "Copy of Marriage Certificate",
      ),
    ).toBe(true);
  });
});

describe("matchesAssumptionOfDutyCorrespondence", () => {
  it("matches title or subType", () => {
    expect(
      matchesAssumptionOfDutyCorrespondence({
        title: "Assumption of Duty",
        subType: null,
      }),
    ).toBe(true);
    expect(
      matchesAssumptionOfDutyCorrespondence({
        title: "Onboarding letter",
        subType: "ASSUMPTION_OF_DUTY",
      }),
    ).toBe(true);
  });
});

describe("resolveEmployeeFileChecklist", () => {
  it("marks academic certificates uploaded when a qualification has a file", () => {
    const items = resolveEmployeeFileChecklist({
      overrides: [],
      qualifications: [
        {
          id: "q1",
          title: "CXC Certificate",
          hasAttachment: true,
          employeeVisible: true,
        },
      ],
      credentials: [],
      correspondences: [],
    });

    const academic = items.find(
      (item) => item.itemType === "ACADEMIC_CERTIFICATES",
    );
    expect(academic?.status).toBe("UPLOADED");
    expect(academic?.qualificationDocumentId).toBe("q1");
  });

  it("honours marriage certificate not-applicable override", () => {
    const items = resolveEmployeeFileChecklist({
      overrides: [
        {
          itemType: "MARRIAGE_CERTIFICATE",
          notApplicable: true,
          notes: null,
          qualificationDocumentId: null,
          credentialId: null,
          correspondenceId: null,
          fileName: null,
          storageKey: null,
          employeeVisible: true,
          assumptionOfDutySignedAt: null,
        },
      ],
      qualifications: [],
      credentials: [],
      correspondences: [],
    });

    expect(
      items.find((item) => item.itemType === "MARRIAGE_CERTIFICATE")?.status,
    ).toBe("NOT_APPLICABLE");
  });

  it("derives assumption of duty pending vs signed from correspondence", () => {
    const pending = resolveEmployeeFileChecklist({
      overrides: [],
      qualifications: [],
      credentials: [],
      correspondences: [
        {
          id: "c1",
          title: "Assumption of Duty",
          subType: null,
          status: "ISSUED",
          requiresAcknowledgement: true,
          acknowledgedAt: null,
          employeeVisible: true,
        },
      ],
    }).find((item) => item.itemType === "ASSUMPTION_OF_DUTY");

    expect(pending?.status).toBe("PENDING");

    const signed = resolveEmployeeFileChecklist({
      overrides: [],
      qualifications: [],
      credentials: [],
      correspondences: [
        {
          id: "c1",
          title: "Assumption of Duty",
          subType: null,
          status: "ACKNOWLEDGED",
          requiresAcknowledgement: true,
          acknowledgedAt: "2026-07-01T12:00:00.000Z",
          employeeVisible: true,
        },
      ],
    }).find((item) => item.itemType === "ASSUMPTION_OF_DUTY");

    expect(signed?.status).toBe("SIGNED");
  });

  it("treats manual assumption confirmation as signed", () => {
    const item = resolveEmployeeFileChecklist({
      overrides: [
        {
          itemType: "ASSUMPTION_OF_DUTY",
          notApplicable: false,
          notes: null,
          qualificationDocumentId: null,
          credentialId: null,
          correspondenceId: null,
          fileName: null,
          storageKey: null,
          employeeVisible: true,
          assumptionOfDutySignedAt: "2026-07-02T10:00:00.000Z",
        },
      ],
      qualifications: [],
      credentials: [],
      correspondences: [],
    }).find((row) => row.itemType === "ASSUMPTION_OF_DUTY");

    expect(item?.status).toBe("SIGNED");
    expect(item?.sourceKind).toBe("manual");
  });

  it("matches copy of ID credentials by name", () => {
    const item = resolveEmployeeFileChecklist({
      overrides: [],
      qualifications: [],
      credentials: [
        {
          id: "cred-1",
          name: "National ID",
          hasAttachment: true,
          employeeVisible: true,
        },
      ],
      correspondences: [],
    }).find((row) => row.itemType === "COPY_OF_ID");

    expect(item?.status).toBe("UPLOADED");
    expect(item?.credentialId).toBe("cred-1");
  });
});

describe("summarizeChecklistCompleteness", () => {
  it("counts N/A as satisfied and reports missing labels", () => {
    const items = resolveEmployeeFileChecklist({
      overrides: [
        {
          itemType: "MARRIAGE_CERTIFICATE",
          notApplicable: true,
          notes: null,
          qualificationDocumentId: null,
          credentialId: null,
          correspondenceId: null,
          fileName: null,
          storageKey: null,
          employeeVisible: true,
          assumptionOfDutySignedAt: null,
        },
      ],
      qualifications: [
        {
          id: "q1",
          title: "Degree",
          hasAttachment: true,
          employeeVisible: true,
        },
      ],
      credentials: [
        {
          id: "id1",
          name: "Passport",
          hasAttachment: true,
          employeeVisible: true,
        },
        {
          id: "birth1",
          name: "Birth Certificate",
          hasAttachment: true,
          employeeVisible: true,
        },
      ],
      correspondences: [
        {
          id: "c1",
          title: "Assumption of Duty",
          subType: null,
          status: "ACKNOWLEDGED",
          requiresAcknowledgement: true,
          acknowledgedAt: "2026-07-01T12:00:00.000Z",
          employeeVisible: true,
        },
      ],
    });

    const summary = summarizeChecklistCompleteness(items);
    expect(summary.totalCount).toBe(5);
    expect(summary.completeCount).toBe(5);
    expect(summary.percentComplete).toBe(100);
    expect(summary.isComplete).toBe(true);
    expect(summary.missingLabels).toEqual([]);
  });

  it("treats pending assumption as incomplete", () => {
    const items = resolveEmployeeFileChecklist({
      overrides: [],
      qualifications: [],
      credentials: [],
      correspondences: [
        {
          id: "c1",
          title: "Assumption of Duty",
          subType: null,
          status: "ISSUED",
          requiresAcknowledgement: true,
          acknowledgedAt: null,
          employeeVisible: true,
        },
      ],
    });

    const summary = summarizeChecklistCompleteness(items);
    expect(summary.completeCount).toBe(0);
    expect(summary.percentComplete).toBe(0);
    expect(summary.missingLabels).toContain("Signed Assumption of Duty forms");
  });
});
