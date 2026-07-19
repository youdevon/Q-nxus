import { describe, expect, it } from "vitest";

import { canDownloadQualificationDocument } from "@/src/modules/hr/lib/qualification-access";

describe("canDownloadQualificationDocument", () => {
  const base = {
    canManage: false,
    canViewOwnProfile: true,
    viewerEmployeeId: "emp-1",
    documentEmployeeId: "emp-1",
    employeeVisible: true,
  };

  it("allows HR manage regardless of visibility", () => {
    expect(
      canDownloadQualificationDocument({
        ...base,
        canManage: true,
        canViewOwnProfile: false,
        viewerEmployeeId: null,
        employeeVisible: false,
      }),
    ).toBe(true);
  });

  it("allows the owning employee when visible", () => {
    expect(canDownloadQualificationDocument(base)).toBe(true);
  });

  it("denies the owning employee when not visible", () => {
    expect(
      canDownloadQualificationDocument({
        ...base,
        employeeVisible: false,
      }),
    ).toBe(false);
  });

  it("denies a different employee", () => {
    expect(
      canDownloadQualificationDocument({
        ...base,
        viewerEmployeeId: "emp-2",
      }),
    ).toBe(false);
  });

  it("denies viewers without profile.view_own", () => {
    expect(
      canDownloadQualificationDocument({
        ...base,
        canViewOwnProfile: false,
      }),
    ).toBe(false);
  });
});
