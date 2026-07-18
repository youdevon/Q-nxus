import { describe, expect, it } from "vitest";

import {
  filterMeSectionNavItems,
  isMeSectionActive,
  meSectionNavItems,
  resolveMeSectionIcon,
} from "@/src/modules/hr/lib/me-section-nav";

describe("meSectionNavItems", () => {
  it("includes Qualifications as a self-service destination", () => {
    expect(meSectionNavItems.map((item) => item.href)).toEqual([
      "/me",
      "/me/documents",
      "/me/qualifications",
      "/me/contracts",
      "/me/leave",
      "/me/payslips",
    ]);
  });
});

describe("filterMeSectionNavItems", () => {
  const canAny = (...permissions: string[]) =>
    permissions.includes("people.profile.view_own") ||
    permissions.includes("leave.request");

  it("hides employee-file tabs for non-employee payees", () => {
    const visible = filterMeSectionNavItems(meSectionNavItems, {
      canAny,
      workforceCategory: "BOARD",
    });

    expect(visible.map((item) => item.href)).toEqual([
      "/me",
      "/me/contracts",
      "/me/payslips",
    ]);
  });

  it("keeps employee-file tabs for full employees", () => {
    const visible = filterMeSectionNavItems(meSectionNavItems, {
      canAny,
      workforceCategory: "EMPLOYEE",
    });

    expect(visible.map((item) => item.href)).toEqual([
      "/me",
      "/me/documents",
      "/me/qualifications",
      "/me/contracts",
      "/me/leave",
      "/me/payslips",
    ]);
  });
});

describe("isMeSectionActive", () => {
  it("matches Profile only on exact /me", () => {
    expect(isMeSectionActive("/me", "/me")).toBe(true);
    expect(isMeSectionActive("/me/documents", "/me")).toBe(false);
    expect(isMeSectionActive("/me/qualifications", "/me")).toBe(false);
  });

  it("matches nested paths for other sections", () => {
    expect(isMeSectionActive("/me/documents", "/me/documents")).toBe(true);
    expect(
      isMeSectionActive("/me/documents/letter-1", "/me/documents"),
    ).toBe(true);
    expect(isMeSectionActive("/me/qualifications", "/me/qualifications")).toBe(
      true,
    );
    expect(isMeSectionActive("/me/leave/new", "/me/leave")).toBe(true);
  });
});

describe("resolveMeSectionIcon", () => {
  it("returns the Profile icon only on exact /me", () => {
    const profile = meSectionNavItems.find((item) => item.href === "/me");
    expect(resolveMeSectionIcon("/me")).toBe(profile?.icon);
    expect(resolveMeSectionIcon("/me/documents")).not.toBe(profile?.icon);
  });

  it("returns the section icon for nested paths", () => {
    const qualifications = meSectionNavItems.find(
      (item) => item.href === "/me/qualifications",
    );
    const leave = meSectionNavItems.find((item) => item.href === "/me/leave");
    expect(resolveMeSectionIcon("/me/qualifications")).toBe(
      qualifications?.icon,
    );
    expect(resolveMeSectionIcon("/me/leave/new")).toBe(leave?.icon);
  });
});
