import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrganizationChartWorkspace } from "@/src/modules/hr/components/organization-chart-workspace";
import { getOrganizationChart } from "@/src/modules/hr/data/get-organization-chart";
import { getPeopleStructure } from "@/src/modules/hr/data/get-people-structure";
import { requirePeopleDirectoryAccess } from "@/src/modules/hr/data/require-people-access";
import type { OrganizationSelection } from "@/src/modules/hr/lib/organization-chart-view";

export const metadata: Metadata = {
  title: "Organization chart",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  department?: string;
  position?: string;
}>;

function parseSearchSelection(params: {
  department?: string;
  position?: string;
}): OrganizationSelection | undefined {
  if (params.position) {
    return {
      type: "position",
      positionId: params.position,
    };
  }

  if (params.department) {
    return {
      type: "department",
      departmentId: params.department,
    };
  }

  return undefined;
}

export default async function OrganizationChartPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePeopleDirectoryAccess();

  const [departments, chartData] = await Promise.all([
    getPeopleStructure(),
    getOrganizationChart(),
  ]);

  if (!chartData) {
    notFound();
  }

  const params = await searchParams;
  const initialSelection = parseSearchSelection(params);

  return (
    <OrganizationChartWorkspace
      departments={departments}
      chartData={chartData}
      initialSelection={initialSelection}
    />
  );
}
