import Link from "next/link"
import {
  BriefcaseBusiness,
  Building2,
  Plus,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure"
import { PeopleNav } from "./people-nav"

type PeopleStructureWorkspaceProps = {
  departments: DepartmentRecord[]
}

export function PeopleStructureWorkspace({
  departments,
}: PeopleStructureWorkspaceProps) {
  const positionCount = departments.reduce(
    (total, department) =>
      total + department.positions.length,
    0,
  )

  const employeeCount = departments.reduce(
    (total, department) =>
      total + department.employeeCount,
    0,
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="People Structure"
        description="Departments and positions used across employee records."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={departments.length === 0}
              render={
                departments.length > 0 ? (
                  <Link href="/people/structure/positions/new" />
                ) : undefined
              }
            >
              <BriefcaseBusiness />
              New position
            </Button>

            <Button
              render={
                <Link href="/people/structure/departments/new" />
              }
            >
              <Plus />
              New department
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Departments
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {departments.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Active departments
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {
              departments.filter(
                (department) => department.isActive,
              ).length
            }
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Positions
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {positionCount}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Employees assigned
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {employeeCount}
          </p>
        </div>
      </section>

      {departments.length === 0 ? (
        <div className="border-y border-border py-12 text-center">
          <Building2 className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            No departments configured
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create the first department before adding positions.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {departments.map((department) => (
            <section
              key={department.id}
              className="border-y border-border py-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/people/structure/departments/${department.id}`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {department.name}
                    </Link>

                    {department.code && (
                      <Badge variant="outline">
                        {department.code}
                      </Badge>
                    )}

                    <Badge
                      variant={
                        department.isActive
                          ? "default"
                          : "secondary"
                      }
                    >
                      {department.isActive
                        ? "Active"
                        : "Inactive"}
                    </Badge>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {department.description ||
                      "No description provided."}
                  </p>
                </div>

                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Positions
                    </p>
                    <p className="mt-1 font-medium">
                      {department.positions.length}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Employees
                    </p>
                    <p className="mt-1 font-medium">
                      {department.employeeCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="mb-3 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Positions
                </h3>

                {department.positions.length === 0 ? (
                  <p className="border-t border-border py-5 text-sm text-muted-foreground">
                    No positions have been added to this department.
                  </p>
                ) : (
                  <div className="divide-y divide-border border-t border-border">
                    {department.positions.map((position) => (
                      <Link
                        key={position.id}
                        href={`/people/structure/positions/${position.id}`}
                        className="flex flex-col gap-3 py-4 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {position.title}
                            </p>

                            {position.code && (
                              <Badge variant="outline">
                                {position.code}
                              </Badge>
                            )}

                            <Badge
                              variant={
                                position.isActive
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {position.isActive
                                ? "Active"
                                : "Inactive"}
                            </Badge>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {position.description ||
                              "No description provided."}
                          </p>
                        </div>

                        <span className="text-xs text-muted-foreground">
                          {position.employeeCount} employee
                          {position.employeeCount === 1
                            ? ""
                            : "s"}{" "}
                          assigned
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
