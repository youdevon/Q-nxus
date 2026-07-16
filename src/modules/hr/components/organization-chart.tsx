import Link from "next/link"
import {
  BriefcaseBusiness,
  Network,
  Pencil,
  UserRound,
  UsersRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import type {
  OrganizationChartData,
  OrganizationChartPosition,
} from "@/src/modules/hr/data/get-organization-chart"
import { PeopleNav } from "./people-nav"

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

function PositionNode({
  position,
  depth = 0,
}: {
  position: OrganizationChartPosition
  depth?: number
}) {
  const vacant = position.holders.length === 0

  return (
    <div>
      <article
        className="border-l border-border py-4 pl-4"
        style={{
          marginLeft: `${Math.min(depth, 8) * 1.5}rem`,
        }}
      >
        <div className="flex flex-col gap-4 border-y border-border py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BriefcaseBusiness className="size-4 text-muted-foreground" />

              <h3 className="font-medium">
                {position.title}
              </h3>

              {position.code && (
                <Badge variant="outline">
                  {position.code}
                </Badge>
              )}

              <Badge
                variant={
                  vacant ? "secondary" : "default"
                }
              >
                {vacant ? "Vacant" : "Occupied"}
              </Badge>

              {!position.isActive && (
                <Badge variant="secondary">
                  Inactive
                </Badge>
              )}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {position.departmentName}
            </p>

            {position.holders.length > 0 && (
              <div className="mt-4 space-y-3">
                {position.holders.map((holder) => (
                  <div
                    key={holder.assignmentId}
                    className="flex items-start gap-3"
                  >
                    <UserRound className="mt-0.5 size-4 text-muted-foreground" />

                    <div>
                      <Link
                        href={`/people/employees/${holder.employeeId}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {holder.preferredName
                          ? `${holder.preferredName} — ${holder.employeeName}`
                          : holder.employeeName}
                      </Link>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {holder.employeeNumber}
                        {" · "}
                        {label(holder.assignmentType)}
                        {holder.isActing
                          ? " · Acting"
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {position.directReports.length > 0 && (
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <UsersRound className="size-4" />
                {position.directReports.length} direct
                reporting position
                {position.directReports.length === 1
                  ? ""
                  : "s"}
              </p>
            )}
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/people/structure/positions/${position.id}/reporting`}
              />
            }
          >
            <Pencil />
            Reporting line
          </Button>
        </div>
      </article>

      {position.directReports.map((child) => (
        <PositionNode
          key={child.id}
          position={child}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export function OrganizationChart({
  data,
}: {
  data: OrganizationChartData
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="Organization Chart"
        description={`${data.organization.name} reporting hierarchy`}
        actions={
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/people/structure" />}
          >
            Structure administration
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">
            Departments
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.totals.departments}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Positions
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.totals.positions}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Occupied
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.totals.occupiedPositions}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Vacant
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.totals.vacantPositions}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Acting assignments
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.totals.actingAssignments}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Reporting hierarchy
          </h2>
        </div>

        {data.rootPositions.length === 0 ? (
          <div className="border-y border-border py-12 text-center">
            <Network className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              No top-level positions configured
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create positions or remove a reporting
              relationship to establish the hierarchy.
            </p>
          </div>
        ) : (
          <div>
            {data.rootPositions.map((position) => (
              <PositionNode
                key={position.id}
                position={position}
              />
            ))}
          </div>
        )}
      </section>

      {data.unassignedPositions.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            Positions requiring attention
          </h2>

          <p className="mb-4 text-sm text-muted-foreground">
            These positions point to reporting positions that
            are no longer available in the current structure.
          </p>

          <div>
            {data.unassignedPositions.map((position) => (
              <PositionNode
                key={position.id}
                position={position}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
