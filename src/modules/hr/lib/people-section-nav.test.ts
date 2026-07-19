import { describe, expect, it } from "vitest";
import {
  ClipboardList,
  FolderOpen,
  Network,
  Users,
} from "lucide-react";

import { resolvePeopleSectionIcon } from "@/src/modules/hr/lib/people-section-nav";

describe("resolvePeopleSectionIcon", () => {
  it("maps Employees routes to Users", () => {
    expect(resolvePeopleSectionIcon("/people")).toBe(Users);
    expect(resolvePeopleSectionIcon("/people/employees/emp-1")).toBe(Users);
    expect(
      resolvePeopleSectionIcon("/people/employees/emp-1/contracts"),
    ).toBe(Users);
  });

  it("maps Documents and Team documents to FolderOpen", () => {
    expect(resolvePeopleSectionIcon("/people/documents")).toBe(FolderOpen);
    expect(resolvePeopleSectionIcon("/people/documents/missing")).toBe(
      FolderOpen,
    );
    expect(resolvePeopleSectionIcon("/people/team-documents")).toBe(
      FolderOpen,
    );
  });

  it("maps Leave and leave admin children to ClipboardList", () => {
    expect(resolvePeopleSectionIcon("/people/leave")).toBe(ClipboardList);
    expect(resolvePeopleSectionIcon("/people/leave/new")).toBe(ClipboardList);
    expect(resolvePeopleSectionIcon("/people/leave/balances")).toBe(
      ClipboardList,
    );
    expect(resolvePeopleSectionIcon("/people/leave/workflow")).toBe(
      ClipboardList,
    );
    expect(resolvePeopleSectionIcon("/people/leave/holidays")).toBe(
      ClipboardList,
    );
    expect(resolvePeopleSectionIcon("/people/leave/types")).toBe(
      ClipboardList,
    );
  });

  it("maps Organization structure to Network", () => {
    expect(resolvePeopleSectionIcon("/people/structure")).toBe(Network);
    expect(resolvePeopleSectionIcon("/people/structure/departments/d-1")).toBe(
      Network,
    );
  });

  it("returns null outside People sections", () => {
    expect(resolvePeopleSectionIcon("/contracts")).toBeNull();
    expect(resolvePeopleSectionIcon("/me")).toBeNull();
    expect(resolvePeopleSectionIcon("/")).toBeNull();
  });
});
