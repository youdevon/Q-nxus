import { describe, expect, it } from "vitest";

import {
  correspondenceNotificationIdentity,
  historicalRecipientReadState,
} from "@/src/modules/hr/lib/correspondence-notification-backfill";

describe("correspondence notification backfill", () => {
  it("uses a stable correspondence identity for dedupe", () => {
    expect(correspondenceNotificationIdentity("letter-123")).toEqual({
      actionUrl: "/me/documents/letter-123",
      relatedType: "EmployeeCorrespondence",
      relatedId: "letter-123",
    });
  });

  it("maps issued letters to unread recipients", () => {
    expect(
      historicalRecipientReadState(
        "ISSUED",
        null,
        new Date("2026-07-01T00:00:00.000Z"),
      ),
    ).toEqual({
      status: "UNREAD",
      readAt: null,
    });
  });

  it("maps acknowledged letters to read recipients", () => {
    const acknowledgedAt = new Date("2026-07-10T14:30:00.000Z");

    expect(
      historicalRecipientReadState(
        "ACKNOWLEDGED",
        acknowledgedAt,
        new Date("2026-07-01T00:00:00.000Z"),
      ),
    ).toEqual({
      status: "READ",
      readAt: acknowledgedAt,
    });
  });
});
