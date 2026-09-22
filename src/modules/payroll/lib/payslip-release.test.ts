import { describe, expect, it } from "vitest";

import {
  buildPayslipSecureUrl,
  canReleasePayRunPayslips,
  isPayslipEligibleForRelease,
  payslipDeliveryStatusFromEmailQueue,
  summarizePayslipDelivery,
} from "./payslip-release";

describe("buildPayslipSecureUrl", () => {
  it("builds an absolute self-service URL from APP_BASE_URL-style base", () => {
    expect(buildPayslipSecureUrl("slip_1", "https://payroll.example.com")).toBe(
      "https://payroll.example.com/me/payslip?payslipId=slip_1",
    );
  });

  it("strips trailing slashes and encodes the payslip id", () => {
    expect(
      buildPayslipSecureUrl("a/b", "https://app.example.com/"),
    ).toBe("https://app.example.com/me/payslip?payslipId=a%2Fb");
  });

  it("prefixes http when base lacks a scheme", () => {
    expect(buildPayslipSecureUrl("slip_1", "localhost:3000")).toBe(
      "http://localhost:3000/me/payslip?payslipId=slip_1",
    );
  });

  it("rejects empty payslip ids", () => {
    expect(() => buildPayslipSecureUrl("  ", "https://x.test")).toThrow(
      /required/i,
    );
  });
});

describe("release eligibility", () => {
  it("canReleasePayRunPayslips follows posted lifecycle statuses", () => {
    expect(canReleasePayRunPayslips("DRAFT")).toBe(false);
    expect(canReleasePayRunPayslips("APPROVED")).toBe(false);
    expect(canReleasePayRunPayslips("POSTED")).toBe(true);
    expect(canReleasePayRunPayslips("RECONCILED")).toBe(true);
    expect(canReleasePayRunPayslips("CLOSED")).toBe(true);
  });

  it("isPayslipEligibleForRelease requires POSTED and null releasedAt", () => {
    expect(
      isPayslipEligibleForRelease({ status: "POSTED", releasedAt: null }),
    ).toBe(true);
    expect(
      isPayslipEligibleForRelease({
        status: "POSTED",
        releasedAt: new Date(),
      }),
    ).toBe(false);
    expect(
      isPayslipEligibleForRelease({ status: "DRAFT", releasedAt: null }),
    ).toBe(false);
    expect(
      isPayslipEligibleForRelease({ status: "EXCLUDED", releasedAt: null }),
    ).toBe(false);
  });
});

describe("summarizePayslipDelivery", () => {
  it("counts release and delivery buckets for posted slips only", () => {
    const summary = summarizePayslipDelivery([
      { status: "EXCLUDED", releasedAt: null },
      { status: "POSTED", releasedAt: null },
      {
        status: "POSTED",
        releasedAt: "2026-07-01",
        emailDeliveryStatus: "SENT",
      },
      {
        status: "POSTED",
        releasedAt: "2026-07-01",
        emailDeliveryStatus: "PENDING",
      },
      {
        status: "POSTED",
        releasedAt: "2026-07-01",
        emailDeliveryStatus: "FAILED",
      },
      {
        status: "POSTED",
        releasedAt: "2026-07-01",
        emailDeliveryStatus: "SKIPPED",
      },
    ]);

    expect(summary).toEqual({
      postedCount: 5,
      releasedCount: 4,
      unreleasedCount: 1,
      pendingCount: 1,
      sentCount: 1,
      failedCount: 1,
      skippedCount: 1,
    });
  });
});

describe("payslipDeliveryStatusFromEmailQueue", () => {
  it("maps queue statuses onto payslip delivery statuses", () => {
    expect(payslipDeliveryStatusFromEmailQueue("SENT")).toBe("SENT");
    expect(payslipDeliveryStatusFromEmailQueue("FAILED")).toBe("FAILED");
    expect(payslipDeliveryStatusFromEmailQueue("PENDING")).toBe("PENDING");
    expect(payslipDeliveryStatusFromEmailQueue("PROCESSING")).toBe("PENDING");
    expect(payslipDeliveryStatusFromEmailQueue("CANCELLED")).toBeNull();
  });
});
