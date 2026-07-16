import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Pencil,
  UsersRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { PeopleNav } from "@/src/modules/hr/components/people-nav"
import { getDepartmentProfile } from "@/src/modules/hr/data/get-people-structure"

export const metadata: Metadata = {
  title: "Department",
}

export const dynamic = "force-dynamic"

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const department = await getDepartmentProfile(id)

  if (!department) {
    notFound()
  }

  return (
    <PageShell size="lg">
      <PeopleNav />

      <PageHeader
        title={department.name}
        description="Department profile, positions and assigned employees."
        actions={
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/people/structure" />}
            >
              <ArrowLeft />
              Structure
            </Button>

            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/people/structure/departments/${department.id}/edit`}
                />
              }
            >
              <Pencil />
              Edit department
            </Button>
          </>
        }
      />

      <section className="border-y border-border py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <Building2 className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                {department.name}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {department.code || "No code"}
              </p>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                {department.description ||
                  "No description provided."}
              </p>
            </div>
          </div>

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
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Positions
          </h2>
        </div>

        {department.positions.length === 0 ? (
          <p className="border-y border-border py-6 text-sm text-muted-foreground">
            No positions are assigned to this department.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {department.positions.map((position) => (
              <Link
                key={position.id}
                href={`/people/structure/positions/${position.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium">
                    {position.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {position.description ||
                      "No description provided."}
                  </p>
                </div>

                <span className="text-xs text-muted-foreground">
                  {position.employeeCount} employee
                  {position.employeeCount === 1
                    ? ""
                    : "s"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UsersRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Assigned employees
          </h2>
        </div>

        {department.employees.length === 0 ? (
          <p className="border-y border-border py-6 text-sm text-muted-foreground">
            No employees are assigned to this department.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {department.employees.map((employee) => (
              <Link
                key={employee.id}
                href={`/people/employees/${employee.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {employee.employeeNumber}
                  </p>
                </div>

                <span className="text-xs text-muted-foreground">
                  {employee.positionTitle || "Unassigned"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}
