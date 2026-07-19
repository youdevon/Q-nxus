import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  Send,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  acknowledgePerformanceAppraisal,
  cancelPerformanceAppraisal,
  completePerformanceAppraisal,
  reviewPerformanceAppraisal,
  submitPerformanceAppraisal,
} from "@/src/modules/hr/actions/manage-performance-appraisal";
import { getPerformanceAppraisalProfile } from "@/src/modules/hr/data/get-performance-appraisals";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Performance Appraisal",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function PerformanceAppraisalPage({
  params,
}: {
  params: Promise<{
    id: string;
    appraisalId: string;
  }>;
}) {
  await requirePeopleManageAccess();

  const { id, appraisalId } = await params;

  const appraisal = await getPerformanceAppraisalProfile(id, appraisalId);

  if (!appraisal) {
    notFound();
  }

  const editable =
    appraisal.status === "DRAFT" || appraisal.status === "IN_PROGRESS";

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title={appraisal.title}
        description={`${appraisal.employee.firstName} ${appraisal.employee.lastName} · ${appraisal.employee.employeeNumber}`}
        backHref={`/people/employees/${id}/appraisals`}
        backLabel="Appraisals"
        actions={
          editable ? (
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/people/employees/${id}/appraisals/${appraisal.id}/edit`}
                />
              }
            >
              <Pencil />
              Enter ratings
            </Button>
          ) : undefined
        }
      />

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Appraisal Workflow
        </h2>

        <div className="flex flex-wrap gap-2">
          {(appraisal.status === "DRAFT" ||
            appraisal.status === "IN_PROGRESS") && (
            <form action={submitPerformanceAppraisal}>
              <input
                type="hidden"
                name="employeeId"
                value={appraisal.employee.id}
              />
              <input type="hidden" name="appraisalId" value={appraisal.id} />

              <Button type="submit">
                <Send />
                Submit appraisal
              </Button>
            </form>
          )}

          {appraisal.status === "SUBMITTED" && (
            <form action={reviewPerformanceAppraisal}>
              <input
                type="hidden"
                name="employeeId"
                value={appraisal.employee.id}
              />
              <input type="hidden" name="appraisalId" value={appraisal.id} />

              <Button type="submit">
                <ShieldCheck />
                Record supervisor review
              </Button>
            </form>
          )}

          {appraisal.status === "SUPERVISOR_REVIEWED" && (
            <form action={acknowledgePerformanceAppraisal}>
              <input
                type="hidden"
                name="employeeId"
                value={appraisal.employee.id}
              />
              <input type="hidden" name="appraisalId" value={appraisal.id} />

              <Button type="submit">
                <UserCheck />
                Record employee acknowledgement
              </Button>
            </form>
          )}

          {appraisal.status === "EMPLOYEE_ACKNOWLEDGED" && (
            <form action={completePerformanceAppraisal}>
              <input
                type="hidden"
                name="employeeId"
                value={appraisal.employee.id}
              />
              <input type="hidden" name="appraisalId" value={appraisal.id} />

              <Button type="submit">
                <CheckCircle2 />
                Complete appraisal
              </Button>
            </form>
          )}

          {(appraisal.status === "DRAFT" ||
            appraisal.status === "IN_PROGRESS" ||
            appraisal.status === "SUBMITTED") && (
            <form action={cancelPerformanceAppraisal}>
              <input
                type="hidden"
                name="employeeId"
                value={appraisal.employee.id}
              />
              <input type="hidden" name="appraisalId" value={appraisal.id} />

              <Button type="submit" variant="destructive">
                <XCircle />
                Cancel appraisal
              </Button>
            </form>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <ClipboardCheck className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {appraisal.title}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {appraisal.appraisalNumber ?? "No appraisal reference"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {appraisal.periodStart} to{" "}
                {appraisal.periodEnd}
              </p>
            </div>
          </div>

          <Badge
            variant={
              appraisal.status === "COMPLETED"
                ? "success"
                : appraisal.status === "DRAFT"
                  ? "warning"
                  : "secondary"
            }
          >
            {label(appraisal.status)}
          </Badge>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Assignment</p>
          <p className="mt-1 text-sm font-medium">
            {appraisal.assignment?.positionTitle ??
              appraisal.assignment?.departmentName ??
              "Not linked"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Job description</p>
          <p className="mt-1 text-sm font-medium">
            {appraisal.jobDescription
              ? `Version ${appraisal.jobDescription.versionNumber}`
              : "Not linked"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Supervisor</p>
          <p className="mt-1 text-sm font-medium">
            {appraisal.supervisor?.name ?? "Not assigned"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Overall score</p>
          <p className="mt-1 text-sm font-medium">
            {appraisal.overallScore
              ? `${appraisal.overallScore} / 100`
              : "Not rated"}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Appraisal criteria
        </h2>

        <div className="divide-y divide-border/70">
          {appraisal.criteria.map((criterion) => (
            <article
              key={criterion.id}
              className="grid gap-5 py-6 lg:grid-cols-[1fr_8rem_8rem_9rem]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{criterion.title}</p>
                  <Badge variant="outline">
                    {label(criterion.criterionType)}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {criterion.description ?? "No description provided."}
                </p>

                {criterion.measurement && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Measurement: {criterion.measurement}
                  </p>
                )}

                {criterion.employeeComments && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Employee comment:{" "}
                    {criterion.employeeComments}
                  </p>
                )}

                {criterion.supervisorComments && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Supervisor comment:{" "}
                    {criterion.supervisorComments}
                  </p>
                )}

                {criterion.evidence && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Evidence: {criterion.evidence}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="mt-1 text-sm font-medium">{criterion.weight}%</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Final rating</p>
                <p className="mt-1 text-sm font-medium">
                  {criterion.finalRating ?? "Not rated"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Weighted score</p>
                <p className="mt-1 text-sm font-medium">
                  {criterion.weightedScore ?? "Not calculated"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Overall Comments and Development
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Employee comments</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {appraisal.employeeComments || "No employee comments recorded."}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Supervisor comments</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {appraisal.supervisorComments ||
                "No supervisor comments recorded."}
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">Development plan</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {appraisal.developmentPlan || "No development plan recorded."}
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
