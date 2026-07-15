import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/src/components/layout/page-header"
import type {
  EmployeeDirectoryData,
  EmployeeDirectoryFilters,
} from "@/src/modules/hr/data/get-employees"
import { PeopleNav } from "./people-nav"

type EmployeeDirectoryProps = {
  data: EmployeeDirectoryData
  filters: EmployeeDirectoryFilters
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function buildPageUrl(
  filters: EmployeeDirectoryFilters,
  page: number,
): string {
  const params = new URLSearchParams()

  if (filters.query) {
    params.set("query", filters.query)
  }

  if (filters.status) {
    params.set("status", filters.status)
  }

  if (filters.employmentType) {
    params.set("employmentType", filters.employmentType)
  }

  if (filters.departmentId) {
    params.set("departmentId", filters.departmentId)
  }

  params.set("page", String(page))

  return `/people?${params.toString()}`
}

export function EmployeeDirectory({
  data,
  filters,
}: EmployeeDirectoryProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="Employees"
        description="Manage employee records, work assignments and employment status."
        actions={
          <Button render={<Link href="/people/employees/new" />}>
            <Plus />
            New employee
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Total employees
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.total}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.summary.active}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">On leave</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.summary.onLeave}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Other statuses
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.summary.inactive}
          </p>
        </div>
      </section>

      <form
        method="get"
        className="grid gap-4 border-y border-border py-5 md:grid-cols-2 lg:grid-cols-4"
      >
        <div className="md:col-span-2 lg:col-span-4">
          <label htmlFor="query" className="text-sm font-medium">
            Search employees
          </label>
          <Input
            id="query"
            name="query"
            defaultValue={filters.query ?? ""}
            placeholder="Name, employee number or email"
            className="mt-2"
          />
        </div>

        <div>
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TERMINATED">Terminated</option>
            <option value="RETIRED">Retired</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="employmentType"
            className="text-sm font-medium"
          >
            Employment type
          </label>
          <select
            id="employmentType"
            name="employmentType"
            defaultValue={filters.employmentType ?? ""}
            className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
          >
            <option value="">All types</option>
            <option value="PERMANENT">Permanent</option>
            <option value="CONTRACT">Contract</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="PART_TIME">Part time</option>
            <option value="INTERN">Intern</option>
            <option value="CONSULTANT">Consultant</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="departmentId"
            className="text-sm font-medium"
          >
            Department
          </label>
          <select
            id="departmentId"
            name="departmentId"
            defaultValue={filters.departmentId ?? ""}
            className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
          >
            <option value="">All departments</option>
            {data.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit">
            <Search />
            Apply filters
          </Button>

          <Button
            variant="outline"
            render={<Link href="/people" />}
          >
            Clear
          </Button>
        </div>
      </form>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Employee directory
            </h2>
          </div>

          <span className="text-xs text-muted-foreground">
            {data.total} matching record
            {data.total === 1 ? "" : "s"}
          </span>
        </div>

        {data.employees.length === 0 ? (
          <div className="border-y border-border py-12 text-center">
            <Users className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              No employees found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create the first employee or adjust the filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 font-medium">Number</th>
                  <th className="px-3 py-3 font-medium">
                    Department
                  </th>
                  <th className="px-3 py-3 font-medium">Position</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Hire date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {data.employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-3 py-4">
                      <Link
                        href={`/people/employees/${employee.id}`}
                        className="font-medium hover:underline"
                      >
                        {employee.preferredName ??
                          employee.firstName}{" "}
                        {employee.lastName}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {employee.workEmail ?? "No work email"}
                      </p>
                    </td>

                    <td className="px-3 py-4 font-mono text-xs">
                      {employee.employeeNumber}
                    </td>

                    <td className="px-3 py-4">
                      {employee.department?.name ?? "Unassigned"}
                    </td>

                    <td className="px-3 py-4">
                      {employee.position?.title ?? "Unassigned"}
                    </td>

                    <td className="px-3 py-4">
                      {label(employee.employmentType)}
                    </td>

                    <td className="px-3 py-4">
                      <Badge
                        variant={
                          employee.employmentStatus === "ACTIVE"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {label(employee.employmentStatus)}
                      </Badge>
                    </td>

                    <td className="px-3 py-4">
                      {employee.hireDate.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Page {data.page} of {data.totalPages}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={data.page <= 1}
            render={
              data.page > 1 ? (
                <Link
                  href={buildPageUrl(filters, data.page - 1)}
                />
              ) : (
                <span />
              )
            }
          >
            <ChevronLeft />
            Previous
          </Button>

          <Button
            variant="outline"
            disabled={data.page >= data.totalPages}
            render={
              data.page < data.totalPages ? (
                <Link
                  href={buildPageUrl(filters, data.page + 1)}
                />
              ) : (
                <span />
              )
            }
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </footer>
    </div>
  )
}
