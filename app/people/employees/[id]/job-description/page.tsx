import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, BriefcaseBusiness } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PeopleNav } from "@/src/modules/hr/components/people-nav"
import { getEmployeeCurrentJobDescription } from "@/src/modules/hr/data/get-job-descriptions"

export const metadata: Metadata = {
  title: "Employee Job Description",
}

export const dynamic = "force-dynamic"

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export default async function EmployeeJobDescriptionPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const data = await getEmployeeCurrentJobDescription(id)

  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="Job Description"
        description={`${data.employee.firstName} ${data.employee.lastName} · ${data.employee.employeeNumber}`}
        actions={
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href={`/people/employees/${id}`} />}
          >
            <ArrowLeft />
            Employee profile
          </Button>
        }
      />

      {!data.position ? (
        <div className="border-y border-border py-12 text-center">
          <BriefcaseBusiness className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            No position assigned
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign a position before accessing a job description.
          </p>
        </div>
      ) : !data.jobDescription ? (
        <div className="border-y border-border py-12 text-center">
          <BriefcaseBusiness className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            No active job description
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The assigned position does not yet have an active job-description version.
          </p>
        </div>
      ) : (
        <>
          <section className="border-y border-border py-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">
                {data.jobDescription.title}
              </h2>
              <Badge variant="outline">
                Version {data.jobDescription.versionNumber}
              </Badge>
              {data.position.code && (
                <Badge variant="secondary">
                  {data.position.code}
                </Badge>
              )}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              {data.position.department}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Effective from {data.jobDescription.effectiveFrom}
            </p>
          </section>

          {data.jobDescription.summary && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                Summary
              </h2>
              <p className="whitespace-pre-wrap border-y border-border py-5 text-sm">
                {data.jobDescription.summary}
              </p>
            </section>
          )}

          {data.jobDescription.positionPurpose && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                Position purpose
              </h2>
              <p className="whitespace-pre-wrap border-y border-border py-5 text-sm">
                {data.jobDescription.positionPurpose}
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
              Reporting relationship
            </h2>
            <div className="grid gap-5 border-y border-border py-5 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  Reports to
                </p>
                <p className="mt-1 text-sm font-medium">
                  {data.jobDescription.reportsTo ?? "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Supervisory responsibility
                </p>
                <p className="mt-1 text-sm font-medium">
                  {data.jobDescription.supervisoryResponsibility ??
                    "Not specified"}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
              Duties and performance criteria
            </h2>

            <div className="divide-y divide-border border-y border-border">
              {data.jobDescription.criteria.map((criterion) => (
                <article key={criterion.id} className="py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {label(criterion.criterionType)}
                    </Badge>
                    <h3 className="font-medium">
                      {criterion.title}
                    </h3>
                    {Number(criterion.weight) > 0 && (
                      <Badge variant="secondary">
                        {criterion.weight}%
                      </Badge>
                    )}
                  </div>

                  {criterion.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm">
                      {criterion.description}
                    </p>
                  )}

                  {criterion.measurement && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Measurement: {criterion.measurement}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                Qualifications
              </h2>
              <p className="whitespace-pre-wrap border-y border-border py-5 text-sm">
                {data.jobDescription.qualifications ??
                  "Not specified"}
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                Required experience
              </h2>
              <p className="whitespace-pre-wrap border-y border-border py-5 text-sm">
                {data.jobDescription.requiredExperience ??
                  "Not specified"}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
