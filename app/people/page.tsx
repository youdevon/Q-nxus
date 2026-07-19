import type { Metadata } from "next";

import { EmployeeDirectory } from "@/src/modules/hr/components/employee-directory";
import {
  getEmployees,
  type EmployeeDirectoryFilters,
} from "@/src/modules/hr/data/get-employees";
import { requirePeopleDirectoryAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "People",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  status?: string;
  employmentType?: string;
  workforceCategory?: string;
  departmentId?: string;
  page?: string;
  show?: string;
  sort?: string;
  order?: string;
}>;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePeopleDirectoryAccess();

  const params = await searchParams;

  const filters: EmployeeDirectoryFilters = {
    query: params.query,
    status: params.status,
    employmentType: params.employmentType,
    workforceCategory: params.workforceCategory,
    departmentId: params.departmentId,
    page: params.page ? Number(params.page) : 1,
    show: params.show === "all" ? "all" : undefined,
    sort: params.sort,
    order: params.order,
  };

  const data = await getEmployees(filters);

  return <EmployeeDirectory data={data} filters={filters} />;
}
