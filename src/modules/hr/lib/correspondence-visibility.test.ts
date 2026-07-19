import { describe, expect, it } from "vitest";

import {
  canEmployeeAcknowledgeCorrespondence,
  canHrArchiveCorrespondence,
  canHrEditCorrespondence,
  canHrIssueCorrespondence,
  canHrSupersedeCorrespondence,
  defaultRequiresAcknowledgement,
  defaultRetentionUntil,
  getExpiryStatus,
  isAcknowledgementOverdue,
  isEmployeeVisibleCorrespondence,
  isManagerVisibleCorrespondence,
  isRestrictedCategory,
} from "@/src/modules/hr/lib/correspondence-visibility";

describe("isEmployeeVisibleCorrespondence", () => {
  it("hides confidential records even when issued", () => {
    expect(
      isEmployeeVisibleCorrespondence({
        status: "ISSUED",
        employeeVisible: false,
      }),
    ).toBe(false);
  });

  it("hides drafts even when employeeVisible", () => {
    expect(
      isEmployeeVisibleCorrespondence({
        status: "DRAFT",
        employeeVisible: true,
      }),
    ).toBe(false);
  });

  it("shows issued and acknowledged employee-visible records", () => {
    expect(
      isEmployeeVisibleCorrespondence({
        status: "ISSUED",
        employeeVisible: true,
      }),
    ).toBe(true);
    expect(
      isEmployeeVisibleCorrespondence({
        status: "ACKNOWLEDGED",
        employeeVisible: true,
      }),
    ).toBe(true);
  });

  it("hides archived and superseded records from self-service", () => {
    expect(
      isEmployeeVisibleCorrespondence({
        status: "ARCHIVED",
        employeeVisible: true,
      }),
    ).toBe(false);
    expect(
      isEmployeeVisibleCorrespondence({
        status: "SUPERSEDED",
        employeeVisible: true,
      }),
    ).toBe(false);
  });
});

describe("isManagerVisibleCorrespondence", () => {
  it("requires managerVisible and issued lifecycle", () => {
    expect(
      isManagerVisibleCorrespondence({
        status: "ISSUED",
        managerVisible: true,
      }),
    ).toBe(true);
    expect(
      isManagerVisibleCorrespondence({
        status: "DRAFT",
        managerVisible: true,
      }),
    ).toBe(false);
    expect(
      isManagerVisibleCorrespondence({
        status: "ISSUED",
        managerVisible: false,
      }),
    ).toBe(false);
  });
});

describe("canEmployeeAcknowledgeCorrespondence", () => {
  it("allows acknowledgement only for issued visible items that require it", () => {
    expect(
      canEmployeeAcknowledgeCorrespondence({
        status: "ISSUED",
        employeeVisible: true,
        requiresAcknowledgement: true,
      }),
    ).toBe(true);

    expect(
      canEmployeeAcknowledgeCorrespondence({
        status: "ISSUED",
        employeeVisible: true,
        requiresAcknowledgement: false,
      }),
    ).toBe(false);

    expect(
      canEmployeeAcknowledgeCorrespondence({
        status: "ACKNOWLEDGED",
        employeeVisible: true,
        requiresAcknowledgement: true,
      }),
    ).toBe(false);
  });
});

describe("HR lifecycle helpers", () => {
  it("locks edits after issue and supports supersede", () => {
    expect(canHrEditCorrespondence("DRAFT")).toBe(true);
    expect(canHrEditCorrespondence("ISSUED")).toBe(false);
    expect(canHrIssueCorrespondence("DRAFT")).toBe(true);
    expect(canHrIssueCorrespondence("ISSUED")).toBe(false);
    expect(canHrSupersedeCorrespondence("ISSUED")).toBe(true);
    expect(canHrSupersedeCorrespondence("ACKNOWLEDGED")).toBe(true);
    expect(canHrSupersedeCorrespondence("DRAFT")).toBe(false);
  });

  it("allows archive from draft, issued, or acknowledged", () => {
    expect(canHrArchiveCorrespondence("DRAFT")).toBe(true);
    expect(canHrArchiveCorrespondence("ISSUED")).toBe(true);
    expect(canHrArchiveCorrespondence("ACKNOWLEDGED")).toBe(true);
    expect(canHrArchiveCorrespondence("ARCHIVED")).toBe(false);
    expect(canHrArchiveCorrespondence("SUPERSEDED")).toBe(false);
  });
});

describe("defaultRequiresAcknowledgement", () => {
  it("defaults true for disciplinary, warning, instruction, and policy", () => {
    expect(defaultRequiresAcknowledgement("DISCIPLINARY")).toBe(true);
    expect(defaultRequiresAcknowledgement("WARNING")).toBe(true);
    expect(defaultRequiresAcknowledgement("INSTRUCTION")).toBe(true);
    expect(defaultRequiresAcknowledgement("POLICY")).toBe(true);
    expect(defaultRequiresAcknowledgement("COMMENDATION")).toBe(false);
  });
});

describe("restricted categories and retention", () => {
  it("marks medical and identification as restricted", () => {
    expect(isRestrictedCategory("MEDICAL")).toBe(true);
    expect(isRestrictedCategory("IDENTIFICATION")).toBe(true);
    expect(isRestrictedCategory("GENERAL")).toBe(false);
  });

  it("defaults disciplinary retention to two years", () => {
    const retention = defaultRetentionUntil(
      "DISCIPLINARY",
      new Date("2026-01-15T00:00:00.000Z"),
    );
    expect(retention?.toISOString().slice(0, 10)).toBe("2028-01-15");
    expect(defaultRetentionUntil("GENERAL", new Date())).toBeNull();
  });
});

describe("acknowledgement overdue and expiry", () => {
  it("flags overdue acknowledgements after 7 days", () => {
    expect(
      isAcknowledgementOverdue(
        {
          status: "ISSUED",
          requiresAcknowledgement: true,
          issueDate: new Date("2026-07-01T00:00:00.000Z"),
        },
        new Date("2026-07-10T00:00:00.000Z"),
      ),
    ).toBe(true);

    expect(
      isAcknowledgementOverdue(
        {
          status: "ISSUED",
          requiresAcknowledgement: true,
          issueDate: new Date("2026-07-08T00:00:00.000Z"),
        },
        new Date("2026-07-10T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("classifies expiry windows", () => {
    expect(
      getExpiryStatus(
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-10T00:00:00.000Z"),
      ),
    ).toBe("EXPIRED");
    expect(
      getExpiryStatus(
        new Date("2026-07-20T00:00:00.000Z"),
        new Date("2026-07-10T00:00:00.000Z"),
      ),
    ).toBe("EXPIRING");
    expect(
      getExpiryStatus(
        new Date("2026-12-01T00:00:00.000Z"),
        new Date("2026-07-10T00:00:00.000Z"),
      ),
    ).toBe("OK");
  });
});
