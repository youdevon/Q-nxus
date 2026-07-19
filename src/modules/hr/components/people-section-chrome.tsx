import type { ReactNode } from "react";

/**
 * People/Leave layout wrapper. The section hamburger is mounted by
 * `PeoplePageHeader` so title, actions, and menu share one header band.
 */
export function PeopleSectionChrome({ children }: { children: ReactNode }) {
  return children;
}
