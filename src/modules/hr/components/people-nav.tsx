"use client";

import type { ReactNode } from "react";

export { PeopleSectionMenu } from "@/src/modules/hr/components/people-section-menu";

/**
 * @deprecated Prefer passing buttons as `actions` on `PeoplePageHeader`.
 * Kept as a pass-through so existing wrappers still compile.
 */
export function PeopleHeaderActions({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/**
 * @deprecated Use `PeoplePageHeader` so the hamburger stays in one spot.
 * Nested call sites still importing this get no duplicate menu.
 *
 * Intentionally hook-free: Fast Refresh must not reuse an old `PeopleNav`
 * instance that previously called hooks when this file is edited.
 */
export function PeopleNav() {
  return null;
}
