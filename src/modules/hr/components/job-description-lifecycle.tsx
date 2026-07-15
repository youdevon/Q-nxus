import Link from "next/link"
import {
  CheckCircle2,
  Copy,
  FileText,
  Plus,
  RotateCcw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import {
  activateJobDescription,
  cloneJobDescription,
  retireJobDescription,
} from "@/src/modules/hr/actions/save-job-description"
import type { JobDescriptionLifecycleData } from "@/src/modules/hr/data/get-job-descriptions"
import { PeopleNav } from "./people-nav"

type JobDescriptionLifecycleProps = {
  data: JobDescriptionLifecycleData
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" {
  if (status === "ACTIVE") {
    return "default"
  }

  if (status === "DRAFT") {
    return "outline"
  }

  return "secondary"
}

export function JobDescriptionLifecycle({
  data,
}: JobDescriptionLifecycleProps) {
  const currentVersion = data.versions.find(
    (version) => version.isCurrent,
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="Job Description Versions"
        description={`${data.position.title} · ${data.position.department.name}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/people/structure" />}
            >
              Structure
            </Button>

            <Button
              render={
                <Link
                  href={`/people/structure/positions/${data.position.id}/job-descriptions/new`}
                />
              }
            >
              <Plus />
              New version
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Versions
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {data.versions.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Current version
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {currentVersion
              ? `v${currentVersion.versionNumber}`
              : "—"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Draft versions
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {
              data.versions.filter(
                (version) => version.status === "DRAFT",
              ).length
            }
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Position code
          </p>
          <p className="mt-1 font-mono text-lg font-semibold">
            {data.position.code ?? "—"}
          </p>
        </div>
      </section>

      {data.versions.length === 0 ? (
        <div className="border-y border-border py-12 text-center">
          <FileText className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            No job descriptions created
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create the first version for this position.
          </p>
        </div>
      ) : (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Version history
            </h2>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {data.versions.map((version) => {
              const editable = version.status === "DRAFT"
              const weightComplete =
                version.totalAppraisalWeight === 100

              return (
                <article key={version.id} className="py-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">
                          Version {version.versionNumber}
                        </h3>

                        <Badge variant={statusVariant(version.status)}>
                          {label(version.status)}
                        </Badge>

                        {version.isCurrent && (
                          <Badge variant="default">
                            <CheckCircle2 />
                            Current
                          </Badge>
                        )}

                        <Badge
                          variant={
                            weightComplete
                              ? "outline"
                              : "secondary"
                          }
                        >
                          Appraisal weight{" "}
                          {version.totalAppraisalWeight}%
                        </Badge>
                      </div>

                      <p className="mt-3 text-sm font-medium">
                        {version.title}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Effective {version.effectiveFrom}
                        {version.effectiveUntil
                          ? ` to ${version.effectiveUntil}`
                          : " onward"}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {version.criterionCount} criterion
                        {version.criterionCount === 1 ? "" : "s"}
                      </p>

                      {!weightComplete &&
                        version.totalAppraisalWeight > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Appraisal criteria should normally total
                            100% before activation.
                          </p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        render={
                          <Link
                            href={`/people/structure/positions/${data.position.id}/job-descriptions/${version.id}`}
                          />
                        }
                      >
                        {editable ? "Edit" : "View"}
                      </Button>

                      <form action={cloneJobDescription}>
                        <input
                          type="hidden"
                          name="id"
                          value={version.id}
                        />
                        <input
                          type="hidden"
                          name="positionId"
                          value={data.position.id}
                        />

                        <Button
                          type="submit"
                          variant="outline"
                        >
                          <Copy />
                          Copy as new version
                        </Button>
                      </form>

                      {!version.isCurrent &&
                        version.status === "DRAFT" && (
                          <form action={activateJobDescription}>
                            <input
                              type="hidden"
                              name="id"
                              value={version.id}
                            />
                            <input
                              type="hidden"
                              name="positionId"
                              value={data.position.id}
                            />

                            <Button
                              type="submit"
                              disabled={
                                version.totalAppraisalWeight >
                                100
                              }
                            >
                              <CheckCircle2 />
                              Activate
                            </Button>
                          </form>
                        )}

                      {version.isCurrent && (
                        <form action={retireJobDescription}>
                          <input
                            type="hidden"
                            name="id"
                            value={version.id}
                          />
                          <input
                            type="hidden"
                            name="positionId"
                            value={data.position.id}
                          />

                          <Button
                            type="submit"
                            variant="outline"
                          >
                            <RotateCcw />
                            Retire
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
