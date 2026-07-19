import type { Metadata } from "next";

import { PageShell } from "@/src/components/layout/page-shell";
import { OrganizationHolidaysWorkspace } from "@/src/modules/hr/components/organization-holidays-workspace";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { getOrganizationHolidays } from "@/src/modules/hr/data/get-organization-holidays";
import { requireLeaveManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Organization Holidays",
};

export const dynamic = "force-dynamic";

export default async function OrganizationHolidaysPage() {
  await requireLeaveManageAccess();

  const holidays = await getOrganizationHolidays();

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Organization Holidays"
        description="Public holidays reduce working-day counts when employees request leave."
      />
      <OrganizationHolidaysWorkspace holidays={holidays} />
    </PageShell>
  );
}
