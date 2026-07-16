import Link from "next/link"
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  History,
  FileText,
  Mail,
  Pencil,
  Phone,
  UserPlus,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { formatMoney } from "@/src/lib/format"
import type { EmployeeProfileRecord } from "@/src/modules/hr/data/get-employee-form-data"
import { PeopleNav } from "./people-nav"

type EmployeeProfileProps = {
  employee: EmployeeProfileRecord
  canManage?: boolean
  isOwnProfile?: boolean
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function displayValue(
  value: string | null | undefined,
): string {
  return value?.trim() || "Not provided"
}

function Detail({
  labelText,
  value,
}: {
  labelText: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {labelText}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium">
        {value}
      </p>
    </div>
  )
}

export function EmployeeProfile({
  employee,
  canManage = false,
  isOwnProfile = false,
}: EmployeeProfileProps) {
  const displayName = `${employee.firstName}${
    employee.middleName ? ` ${employee.middleName}` : ""
  } ${employee.lastName}`

  return (
    <PageShell>
      {canManage ? <PeopleNav /> : null}

      <PageHeader
        title={
          isOwnProfile && !canManage
            ? "My Profile"
            : displayName
        }
        description={
          isOwnProfile && !canManage
            ? `Your employee profile · ${employee.employeeNumber}`
            : `Employee profile · ${employee.employeeNumber}`
        }
        actions={
          canManage ? (
            <>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${employee.id}/job-description`}
                  />
                }
              >
                <FileText />
                Job description
              </Button>

              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${employee.id}/contracts`}
                  />
                }
              >
                <CalendarDays />
                Contracts
              </Button>

              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${employee.id}/appraisals`}
                  />
                }
              >
                <ClipboardCheck />
                Appraisals
              </Button>

              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${employee.id}/assignments/new`}
                  />
                }
              >
                <UserPlus />
                Assign to position
              </Button>

              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${employee.id}/assignments`}
                  />
                }
              >
                <History />
                Assignment history
              </Button>

              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/people/employees/${employee.id}/edit`}
                  />
                }
              >
                <Pencil />
                Edit employee
              </Button>
            </>
          ) : isOwnProfile ? (
            <Button
              nativeButton={false}
              render={<Link href="/leave" />}
            >
              <CalendarDays />
              Leave requests
            </Button>
          ) : undefined
        }
      />

      <section className="border-y border-border py-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <UserRound className="size-6 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">
                {employee.preferredName
                  ? `${employee.preferredName} ${employee.lastName}`
                  : displayName}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {employee.employeeNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                employee.employmentStatus === "ACTIVE"
                  ? "default"
                  : "secondary"
              }
            >
              {label(employee.employmentStatus)}
            </Badge>

            <Badge variant="outline">
              {label(employee.employmentType)}
            </Badge>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Personal information
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            labelText="Full name"
            value={displayName}
          />

          <Detail
            labelText="Preferred name"
            value={displayValue(employee.preferredName)}
          />

          <Detail
            labelText="Personal email"
            value={displayValue(employee.personalEmail)}
          />

          <Detail
            labelText="Phone"
            value={displayValue(employee.phone)}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Employment information
            </h2>
          </div>

          <Button
            nativeButton={false}
            size="sm"
            render={
              <Link
                href={`/people/employees/${employee.id}/assignments/new`}
              />
            }
          >
            <UserPlus />
            {employee.position
              ? "Change position"
              : "Assign to position"}
          </Button>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            labelText="Department"
            value={employee.department?.name ?? "Unassigned"}
          />

          <Detail
            labelText="Position"
            value={employee.position?.title ?? "Unassigned"}
          />

          <Detail
            labelText="Department code"
            value={employee.department?.code ?? "Not provided"}
          />

          <Detail
            labelText="Position code"
            value={employee.position?.code ?? "Not provided"}
          />

          <Detail
            labelText="Employment type"
            value={label(employee.employmentType)}
          />

          <Detail
            labelText="Employment status"
            value={label(employee.employmentStatus)}
          />

          <Detail
            labelText="Hire date"
            value={employee.hireDate}
          />

          <Detail
            labelText="Termination date"
            value={employee.terminationDate ?? "Not applicable"}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Contact information
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            labelText="Work email"
            value={displayValue(employee.workEmail)}
          />

          <Detail
            labelText="Personal email"
            value={displayValue(employee.personalEmail)}
          />

          <Detail
            labelText="Telephone"
            value={displayValue(employee.phone)}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Current contract
          </h2>
        </div>

        {employee.currentContract ? (
          <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
            <Detail
              labelText="Contract job title"
              value={employee.currentContract.jobTitle}
            />

            <Detail
              labelText="Salary"
              value={formatMoney(
                employee.currentContract.baseSalary,
                { currency: employee.currentContract.currency },
              )}
            />

            <Detail
              labelText="Start date"
              value={employee.currentContract.startDate}
            />

            <Detail
              labelText="End date"
              value={
                employee.currentContract.endDate ??
                "No end date"
              }
            />
          </div>
        ) : (
          <p className="border-y border-border py-6 text-sm text-muted-foreground">
            No current employment contract is recorded.
          </p>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          {employee.contractCount} contract record
          {employee.contractCount === 1 ? "" : "s"}
        </p>

        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/people" />}
        >
          Return to directory
        </Button>
      </footer>
    </PageShell>
  )
}
