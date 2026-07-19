import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { formatDisplayDate } from "@/src/lib/format";
import { getEmployeeAssignmentHistory } from "@/src/modules/hr/data/get-employee-assignments";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Assignment History",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function EmployeeAssignmentsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePeopleManageAccess();

  const { id } = await params;
  const data = await getEmployeeAssignmentHistory(id);

  if (!data) {
    notFound();
  }

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Assignment History"
        description={`${data.employee.firstName} ${data.employee.lastName} · ${data.employee.employeeNumber}`}
        backHref={`/people/employees/${data.employee.id}`}
        backLabel="Employee"
        actions={
          <Button
            nativeButton={false}
            render={
              <Link
                href={`/people/employees/${data.employee.id}/assignments/new`}
              />
            }
          >
            <Plus />
            Assign to position
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Assignment records</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.assignments.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Current assignment</p>
          <p className="mt-1 text-sm font-medium">
            {data.assignments.find((assignment) => assignment.isCurrent)
              ?.position?.title ??
              data.assignments.find((assignment) => assignment.isCurrent)
                ?.department.name ??
              "Not recorded"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Hire date</p>
          <p className="mt-1 text-sm font-medium">
            {formatDisplayDate(data.employee.hireDate)}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Assignment timeline
          </h2>
        </div>

        {data.assignments.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium">
              No assignment history recorded
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create the employee’s initial assignment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {data.assignments.map((assignment) => (
              <article key={assignment.id} className="py-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        {assignment.position?.title ?? "Department assignment"}
                      </h3>

                      <Badge variant="outline">
                        {label(assignment.assignmentType)}
                      </Badge>

                      {assignment.isCurrent && <Badge>Current</Badge>}

                      {assignment.isActing && (
                        <Badge variant="secondary">Acting</Badge>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                      {assignment.department.name}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDisplayDate(assignment.startDate)} to{" "}
                      {assignment.endDate
                        ? formatDisplayDate(assignment.endDate)
                        : "Present"}
                    </p>

                    {assignment.referenceNumber && (
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        Reference: {assignment.referenceNumber}
                      </p>
                    )}

                    {assignment.reason && (
                      <p className="mt-3 text-sm">{assignment.reason}</p>
                    )}
                  </div>

                  <div className="min-w-48">
                    <p className="text-xs text-muted-foreground">
                      Job description
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {assignment.jobDescription
                        ? `Version ${assignment.jobDescription.versionNumber}`
                        : "Not linked"}
                    </p>

                    {assignment.jobDescription && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {assignment.jobDescription.title}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
