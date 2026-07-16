import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { EmployeeDirectory } from "@/src/modules/hr/components/employee-directory"
import {
  getEmployees,
  type EmployeeDirectoryFilters,
} from "@/src/modules/hr/data/get-employees"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"

export const metadata: Metadata = {
  title: "Employees",
}

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
  query?: string
  status?: string
  employmentType?: string
  departmentId?: string
  page?: string
}>

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const capabilities = await getUserCapabilities()

  if (!capabilities) {
    redirect("/login")
  }

  if (
    !capabilities.canAny(
      "people.directory.view",
      "people.manage",
    )
  ) {
    if (capabilities.employeeId) {
      redirect(`/people/employees/${capabilities.employeeId}`)
    }

    redirect("/")
  }

  const params = await searchParams

  const filters: EmployeeDirectoryFilters = {
    query: params.query,
    status: params.status,
    employmentType: params.employmentType,
    departmentId: params.departmentId,
    page: params.page ? Number(params.page) : 1,
  }

  const data = await getEmployees(filters)

  return <EmployeeDirectory data={data} filters={filters} />
}
