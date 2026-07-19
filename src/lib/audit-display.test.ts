import { describe, expect, it } from "vitest";

import {
  formatAuditDisplayValue,
  formatAuditIpAddress,
  humanizeAuditDescription,
  looksLikeOpaqueId,
  normalizeClientIp,
} from "@/src/lib/audit-display";

describe("normalizeClientIp / formatAuditIpAddress", () => {
  it("returns IPv4 addresses", () => {
    expect(normalizeClientIp("203.0.113.10")).toBe("203.0.113.10");
    expect(formatAuditIpAddress("203.0.113.10")).toBe("203.0.113.10");
  });

  it("extracts IPv4 from x-forwarded-for lists", () => {
    expect(normalizeClientIp("203.0.113.10, 198.51.100.1")).toBe(
      "203.0.113.10",
    );
  });

  it("unwraps IPv6-mapped IPv4", () => {
    expect(normalizeClientIp("::ffff:192.0.2.44")).toBe("192.0.2.44");
  });

  it("omits pure IPv6 including loopback", () => {
    expect(normalizeClientIp("::1")).toBeNull();
    expect(normalizeClientIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBeNull();
    expect(formatAuditIpAddress("::1")).toBeNull();
  });

  it("prefers IPv4 when both appear in a list", () => {
    expect(normalizeClientIp("::1, 203.0.113.55")).toBe("203.0.113.55");
  });
});

describe("looksLikeOpaqueId", () => {
  it("detects Prisma cuid-style ids", () => {
    expect(looksLikeOpaqueId("cmrp4d180000ii6sbabteihhj")).toBe(true);
  });

  it("rejects names and emails", () => {
    expect(looksLikeOpaqueId("Jane Doe")).toBe(false);
    expect(looksLikeOpaqueId("user@example.com")).toBe(false);
  });
});

describe("humanizeAuditDescription", () => {
  it("replaces the entity id with a label", () => {
    expect(
      humanizeAuditDescription("Withdrew leave request cmrp4d180000ii6sbabteihhj.", {
        entityId: "cmrp4d180000ii6sbabteihhj",
        entityLabel: "LR-2026-0042",
      }),
    ).toBe("Withdrew leave request LR-2026-0042.");
  });

  it("strips unresolved opaque ids", () => {
    expect(
      humanizeAuditDescription(
        "Cancelled approved leave request cmrp4d180000ii6sbabteihhj.",
      ),
    ).toBe("Cancelled approved leave request.");
  });
});

describe("formatAuditDisplayValue", () => {
  it("resolves opaque ids via reference labels", () => {
    expect(
      formatAuditDisplayValue("cmrp4d180000ii6sbabteihhj", {
        referenceLabels: {
          cmrp4d180000ii6sbabteihhj: "Finance",
        },
      }),
    ).toBe("Finance");
  });

  it("hides unresolved opaque ids", () => {
    expect(formatAuditDisplayValue("cmrp4d180000ii6sbabteihhj")).toBe("—");
  });
});
