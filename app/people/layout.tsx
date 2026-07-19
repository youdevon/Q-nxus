import type { ReactNode } from "react";

import { PeopleSectionChrome } from "@/src/modules/hr/components/people-section-chrome";

export default function PeopleLayout({ children }: { children: ReactNode }) {
  return <PeopleSectionChrome>{children}</PeopleSectionChrome>;
}
