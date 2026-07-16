import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  ClipboardCheck,
  Plus,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PeopleNav } from "@/src/modules/hr/components/people-nav"
import { getEmployeeAppraisalHistory } from "@/src/modules/hr/data/get-performance-appraisals"

export const metadata: Metadata = {
  title: "Performance Appraisals",
}

export const dynamic = "force-dynamic"

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

export default async function EmployeeAppraisalsPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const history = await getEmployeeAppraisalHistory(id)

  if (!history) {
    notFound()
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="Performance Appraisals"
        description={`${history.employee.firstName} ${history.employee.lastName} · ${history.employee.employeeNumber}`}
        actions={
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={`/people/employees/${history.employee.id}`}
                />
              }
            >
              <ArrowLeft />
              Employee profile
            </Button>

            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/people/employees/${history.employee.id}/appraisals/new`}
                />
              }
            >
              <Plus />
              New appraisal
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Appraisals
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {history.appraisals.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Draft
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {
              history.appraisals.filter(
                (appraisal) =>
                  appraisal.status === "DRAFT",
              ).length
            }
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            In progress
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {
              history.appraisals.filter(
                (appraisal) =>
                  appraisal.status === "IN_PROGRESS" ||
                  appraisal.status === "SUBMITTED" ||
                  appraisal.status ===
                    "SUPERVISOR_REVIEWED",
              ).length
            }
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Completed
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {
              history.appraisals.filter(
                (appraisal) =>
                  appraisal.status === "COMPLETED",
              ).length
            }
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Appraisal history
          </h2>
        </div>

        {history.appraisals.length === 0 ? (
          <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
            No performance appraisals have been created.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {history.appraisals.map((appraisal) => (
              <Link
                key={appraisal.id}
                href={`/people/employees/${history.employee.id}/appraisals/${appraisal.id}`}
                className="grid gap-5 py-5 hover:bg-muted/20 md:grid-cols-[1fr_11rem_11rem_10rem]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {appraisal.title}
                    </p>

                    <Badge
                      variant={
                        appraisal.status === "COMPLETED"
                          ? "default"
                          : appraisal.status === "DRAFT"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {label(appraisal.status)}
                    </Badge>
                  </div>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {appraisal.appraisalNumber ??
                      "No reference number"}
                  </p>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Supervisor:{" "}
                    {appraisal.supervisorName ??
                      "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Period
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {appraisal.periodStart}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    to {appraisal.periodEnd}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Criteria
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {appraisal.criterionCount}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Score
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {appraisal.overallScore
                      ? `${appraisal.overallScore} / 100`
                      : "Not rated"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
