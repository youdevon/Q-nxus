import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BriefcaseBusiness,
  FileText,
  Network,
  Pencil,
  UserPlus,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  activeStateBadgeVariant,
  employmentStatusBadgeVariant,
} from "@/src/config/ui-colors";
import { getPositionProfile } from "@/src/modules/hr/data/get-people-structure";
import { requirePeopleDirectoryAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Position",
};

export const dynamic = "force-dynamic";

export default async function PositionPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const capabilities = await requirePeopleDirectoryAccess();
  const canManage = capabilities.can("people.manage");

  const { id } = await params;
  const position = await getPositionProfile(id);

  if (!position) {
    notFound();
  }

  const currentJobDescription = position.jobDescriptions.find(
    (jobDescription) => jobDescription.isCurrent,
  );

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title={position.title}
        description={`${position.department.name} position profile.`}
        backHref="/people/structure"
        backLabel="Organization"
        actions={
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={`/people/structure/positions/${position.id}/job-descriptions`}
                />
              }
            >
              <FileText />
              Job descriptions
            </Button>

            {canManage ? (
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/structure/positions/${position.id}/reporting`}
                  />
                }
              >
                <Network />
                Edit reporting line
              </Button>
            ) : null}

            {canManage ? (
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/structure/positions/${position.id}/assignments/new`}
                  />
                }
              >
                <UserPlus />
                Assign employee
              </Button>
            ) : null}

            {canManage ? (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/people/structure/positions/${position.id}/edit`}
                  />
                }
              >
                <Pencil />
                Edit position
              </Button>
            ) : null}
          </>
        }
      />

      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <BriefcaseBusiness className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {position.title}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {position.code || "No code"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {position.department.name}
              </p>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                {position.description || "No description provided."}
              </p>
            </div>
          </div>

          <Badge variant={activeStateBadgeVariant(position.isActive)}>
            {position.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Employees assigned</p>
          <p className="mt-1 text-2xl font-semibold">
            {position.employees.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Job-description versions
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {position.jobDescriptions.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Current version</p>
          <p className="mt-1 text-sm font-medium">
            {currentJobDescription
              ? `v${currentJobDescription.versionNumber}`
              : "None"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Department</p>
          <Link
            href={`/people/structure/departments/${position.department.id}`}
            className="mt-1 block text-sm font-medium hover:underline"
          >
            {position.department.name}
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UsersRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Assigned employees
            </h2>
          </div>

          {canManage ? (
            <Button
              nativeButton={false}
              size="sm"
              render={
                <Link
                  href={`/people/structure/positions/${position.id}/assignments/new`}
                />
              }
            >
              <UserPlus />
              Assign employee
            </Button>
          ) : null}
        </div>

        {position.employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No employees are assigned to this position yet. Use Assign employee
            to place someone here.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {position.employees.map((employee) => (
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

                <Badge
                  variant={employmentStatusBadgeVariant(
                    employee.employmentStatus,
                  )}
                >
                  {employee.employmentStatus}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
