import type { Metadata } from "next";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { OrganizationHolidaysWorkspace } from "@/src/modules/hr/components/organization-holidays-workspace";
import { PeopleNav } from "@/src/modules/hr/components/people-nav";
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
    <PageShell>
      <PeopleNav />
      <PageHeader
        title="Organization Holidays"
        description="Public holidays reduce working-day counts when employees request leave."
      />
      <OrganizationHolidaysWorkspace holidays={holidays} />
    </PageShell>
  );
}
