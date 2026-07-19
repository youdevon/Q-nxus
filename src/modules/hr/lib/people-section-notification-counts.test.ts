import { describe, expect, it } from "vitest";

import {
  aggregatePeopleSectionCounts,
  formatNotificationBadgeCount,
  mapActionUrlToPeopleSectionHref,
  sumVisiblePeopleSectionCounts,
} from "@/src/modules/hr/lib/people-section-notification-counts";

describe("mapActionUrlToPeopleSectionHref", () => {
  it("maps leave request URLs to /people/leave", () => {
    expect(mapActionUrlToPeopleSectionHref("/people/leave")).toBe(
      "/people/leave",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/leave/abc")).toBe(
      "/people/leave",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/leave/new")).toBe(
      "/people/leave",
    );
  });

  it("maps legacy /leave URLs to /people/leave", () => {
    expect(mapActionUrlToPeopleSectionHref("/leave")).toBe("/people/leave");
    expect(mapActionUrlToPeopleSectionHref("/leave/abc")).toBe("/people/leave");
    expect(mapActionUrlToPeopleSectionHref("/leave/new")).toBe("/people/leave");
  });

  it("maps org documents URLs to /people/documents", () => {
    expect(mapActionUrlToPeopleSectionHref("/people/documents")).toBe(
      "/people/documents",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/documents/missing")).toBe(
      "/people/documents",
    );
  });

  it("maps employee document deep links to Documents", () => {
    expect(
      mapActionUrlToPeopleSectionHref(
        "/people/employees/emp-1/documents/letter-1",
      ),
    ).toBe("/people/documents");
    expect(
      mapActionUrlToPeopleSectionHref("/people/employees/emp-1/documents"),
    ).toBe("/people/documents");
  });

  it("maps other employee deep links to Employees", () => {
    expect(
      mapActionUrlToPeopleSectionHref(
        "/people/employees/emp-1/contracts/c-1",
      ),
    ).toBe("/people");
    expect(mapActionUrlToPeopleSectionHref("/people")).toBe("/people");
  });

  it("maps structure and leave admin URLs", () => {
    expect(mapActionUrlToPeopleSectionHref("/people/structure")).toBe(
      "/people/structure",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/leave/balances")).toBe(
      "/people/leave/balances",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/leave/holidays")).toBe(
      "/people/leave/holidays",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/leave/workflow")).toBe(
      "/people/leave/workflow",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/leave/types")).toBe(
      "/people/leave/types",
    );
    expect(mapActionUrlToPeopleSectionHref("/people/leave/types/abc")).toBe(
      "/people/leave/types",
    );
  });

  it("excludes self-service Me URLs", () => {
    expect(mapActionUrlToPeopleSectionHref("/me/documents")).toBeNull();
    expect(mapActionUrlToPeopleSectionHref("/me/documents/letter-1")).toBeNull();
    expect(mapActionUrlToPeopleSectionHref("/me/leave")).toBeNull();
    expect(mapActionUrlToPeopleSectionHref("/me/leave/new")).toBeNull();
  });

  it("returns null for empty or unrelated URLs", () => {
    expect(mapActionUrlToPeopleSectionHref(null)).toBeNull();
    expect(mapActionUrlToPeopleSectionHref(undefined)).toBeNull();
    expect(mapActionUrlToPeopleSectionHref("/notifications")).toBeNull();
    expect(mapActionUrlToPeopleSectionHref("/payroll")).toBeNull();
  });
});

describe("aggregatePeopleSectionCounts", () => {
  it("aggregates unread action URLs by menu destination", () => {
    expect(
      aggregatePeopleSectionCounts([
        "/people/leave/a",
        "/leave/b",
        "/people/employees/e1/contracts/c1",
        "/people/employees/e1/documents/d1",
        "/me/documents/x",
        null,
      ]),
    ).toEqual({
      "/people/leave": 2,
      "/people": 1,
      "/people/documents": 1,
    });
  });

  it("treats missing action URL lists as empty", () => {
    expect(aggregatePeopleSectionCounts(undefined)).toEqual({});
    expect(aggregatePeopleSectionCounts(null)).toEqual({});
  });
});

describe("sumVisiblePeopleSectionCounts", () => {
  it("sums only visible menu hrefs", () => {
    const counts = {
      "/people/leave": 3,
      "/people": 2,
      "/people/documents": 1,
    };
    expect(
      sumVisiblePeopleSectionCounts(counts, ["/people/leave", "/people"]),
    ).toBe(5);
    expect(sumVisiblePeopleSectionCounts(counts, ["/people/documents"])).toBe(
      1,
    );
  });
});

describe("formatNotificationBadgeCount", () => {
  it("caps display at 9+", () => {
    expect(formatNotificationBadgeCount(1)).toBe("1");
    expect(formatNotificationBadgeCount(9)).toBe("9");
    expect(formatNotificationBadgeCount(10)).toBe("9+");
  });
});
