import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  KeyRound,
  Mail,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav"
import { getUserAccess } from "@/src/modules/admin/data/get-user-access"

export const metadata: Metadata = {
  title: "User Account",
}

export const dynamic = "force-dynamic"

type UserAccountPageProps = {
  params: Promise<{
    id: string
  }>
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function dateTime(value: Date | null): string {
  if (!value) {
    return "Not recorded"
  }

  return value
    .toISOString()
    .replace("T", " ")
    .slice(0, 19)
}

function dateOnly(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "Open-ended"
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

export default async function UserAccountPage({
  params,
}: UserAccountPageProps) {
  const { id } = await params
  const user = await getUserAccess(id)

  if (!user) {
    notFound()
  }

  const activeAssignments = user.assignments.filter(
    (assignment) =>
      assignment.status === "ACTIVE" ||
      assignment.status === "PENDING",
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description="User account, security status and role assignments."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/administration/access" />}
            >
              <ArrowLeft />
              Users and roles
            </Button>

            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/administration/access/users/${user.id}/edit`}
                />
              }
            >
              <Pencil />
              Edit user access
            </Button>
          </div>
        }
      />

      <section className="border-y border-border py-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <UserRound className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                {user.firstName} {user.lastName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                user.status === "ACTIVE" && user.isActive
                  ? "default"
                  : "secondary"
              }
            >
              {label(user.status)}
            </Badge>

            <Badge variant="outline">
              {user.isActive ? "Enabled" : "Disabled"}
            </Badge>

            <Badge variant="outline">
              Version {user.version}
            </Badge>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Account information
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            labelText="First name"
            value={user.firstName}
          />
          <Detail
            labelText="Last name"
            value={user.lastName}
          />
          <Detail
            labelText="Email address"
            value={user.email}
          />
          <Detail
            labelText="Account status"
            value={label(user.status)}
          />
          <Detail
            labelText="Account enabled"
            value={user.isActive ? "Yes" : "No"}
          />
          <Detail
            labelText="Email verified"
            value={dateTime(user.emailVerifiedAt)}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Security information
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            labelText="Last login"
            value={dateTime(user.lastLoginAt)}
          />
          <Detail
            labelText="Failed login attempts"
            value={String(user.failedLoginAttempts)}
          />
          <Detail
            labelText="Locked until"
            value={dateTime(user.lockedUntil)}
          />
          <Detail
            labelText="Last updated"
            value={dateTime(user.updatedAt)}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Role assignments
            </h2>
          </div>

          <span className="text-xs text-muted-foreground">
            {activeAssignments.length} active or pending
          </span>
        </div>

        {user.assignments.length === 0 ? (
          <p className="border-y border-border py-6 text-sm text-muted-foreground">
            No role assignments exist for this user.
          </p>
        ) : (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-200 text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">
                    Effective from
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Effective until
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Assigned
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Reason
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {user.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-3 py-3">
                      <Link
                        href={`/administration/access/roles/${assignment.roleId}`}
                        className="font-medium hover:underline"
                      >
                        {assignment.roleName}
                      </Link>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {assignment.roleCode}
                      </p>
                    </td>

                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          assignment.status === "ACTIVE"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {label(assignment.status)}
                      </Badge>
                    </td>

                    <td className="px-3 py-3">
                      {dateOnly(assignment.effectiveFrom)}
                    </td>

                    <td className="px-3 py-3">
                      {dateOnly(assignment.effectiveUntil)}
                    </td>

                    <td className="px-3 py-3">
                      {dateTime(assignment.assignedAt)}
                    </td>

                    <td className="max-w-72 px-3 py-3 text-muted-foreground">
                      {assignment.reason ?? "Not provided"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          Role assignment and revocation controls are available only
          after selecting Edit.
        </p>

        <Button
          nativeButton={false}
          variant="outline"
          render={
            <Link
              href={`/administration/access/users/${user.id}/edit`}
            />
          }
        >
          <Pencil />
          Edit user access
        </Button>
      </footer>
    </div>
  )
}
