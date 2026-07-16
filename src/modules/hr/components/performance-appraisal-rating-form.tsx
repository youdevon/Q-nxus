"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Calculator,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/src/components/layout/page-header"
import {
  savePerformanceAppraisalRatings,
  type PerformanceAppraisalRatingState,
} from "@/src/modules/hr/actions/manage-performance-appraisal"
import type { PerformanceAppraisalProfile } from "@/src/modules/hr/data/get-performance-appraisals"
import { PeopleNav } from "./people-nav"

const initialState: PerformanceAppraisalRatingState = {
  status: "idle",
  message: "",
}

type CriterionRow = {
  id: string
  employeeRating: string
  supervisorRating: string
  finalRating: string
  employeeComments: string
  supervisorComments: string
  evidence: string
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

export function PerformanceAppraisalRatingForm({
  appraisal,
}: {
  appraisal: PerformanceAppraisalProfile
}) {
  const [state, action, pending] = useActionState(
    savePerformanceAppraisalRatings,
    initialState,
  )

  const maximumScore = Number(appraisal.maximumScore)

  const [rows, setRows] = useState<CriterionRow[]>(
    appraisal.criteria.map((criterion) => ({
      id: criterion.id,
      employeeRating: criterion.employeeRating ?? "",
      supervisorRating:
        criterion.supervisorRating ?? "",
      finalRating: criterion.finalRating ?? "",
      employeeComments:
        criterion.employeeComments ?? "",
      supervisorComments:
        criterion.supervisorComments ?? "",
      evidence: criterion.evidence ?? "",
    })),
  )

  const criterionById = useMemo(
    () =>
      new Map(
        appraisal.criteria.map((criterion) => [
          criterion.id,
          criterion,
        ]),
      ),
    [appraisal.criteria],
  )

  const estimatedScore = rows.reduce((total, row) => {
    const criterion = criterionById.get(row.id)
    const rating = Number(row.finalRating)

    if (
      !criterion ||
      !row.finalRating ||
      !Number.isFinite(rating)
    ) {
      return total
    }

    return (
      total +
      (rating / maximumScore) *
        Number(criterion.weight)
    )
  }, 0)

  function updateRow(
    id: string,
    changes: Partial<CriterionRow>,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...changes,
            }
          : row,
      ),
    )
  }

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message)
    }

    if (state.status === "conflict") {
      toast.warning(state.message)
    }
  }, [state])

  return (
    <form
      action={action}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <PeopleNav />

      <input
        type="hidden"
        name="employeeId"
        value={appraisal.employee.id}
      />

      <input
        type="hidden"
        name="appraisalId"
        value={appraisal.id}
      />

      <input
        type="hidden"
        name="updatedAt"
        value={appraisal.updatedAt}
      />

      <input
        type="hidden"
        name="criteriaJson"
        value={JSON.stringify(rows)}
      />

      <PageHeader
        title="Enter Appraisal Ratings"
        description={`${appraisal.employee.firstName} ${appraisal.employee.lastName} · ${appraisal.title}`}
        actions={
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={`/people/employees/${appraisal.employee.id}/appraisals/${appraisal.id}`}
                />
              }
            >
              <ArrowLeft />
              Cancel
            </Button>

            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save ratings"}
            </Button>
          </div>
        }
      />

      {state.status !== "idle" && (
        <div
          role="alert"
          className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      )}

      <section className="grid gap-6 border-y border-border py-6 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Rating scale
          </p>
          <p className="mt-1 text-sm font-medium">
            0 to {appraisal.maximumScore}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Criteria
          </p>
          <p className="mt-1 text-sm font-medium">
            {appraisal.criteria.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Rated criteria
          </p>
          <p className="mt-1 text-sm font-medium">
            {
              rows.filter(
                (row) => row.finalRating.trim().length > 0,
              ).length
            }
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Estimated overall result
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            <Calculator className="size-4" />
            {estimatedScore.toFixed(2)} / 100
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Rating criteria
        </h2>

        <div className="divide-y divide-border border-y border-border">
          {appraisal.criteria.map((criterion, index) => {
            const row = rows.find(
              (item) => item.id === criterion.id,
            )!

            const finalRating = Number(row.finalRating)

            const weightedScore =
              row.finalRating &&
              Number.isFinite(finalRating)
                ? (finalRating / maximumScore) *
                  Number(criterion.weight)
                : null

            return (
              <article
                key={criterion.id}
                className="space-y-6 py-7"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {index + 1}. {criterion.title}
                      </p>

                      <Badge variant="outline">
                        {label(criterion.criterionType)}
                      </Badge>

                      <Badge variant="secondary">
                        Weight {criterion.weight}%
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                      {criterion.description ??
                        "No description provided."}
                    </p>

                    {criterion.measurement && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Measurement:{" "}
                        {criterion.measurement}
                      </p>
                    )}
                  </div>

                  <div className="min-w-36">
                    <p className="text-xs text-muted-foreground">
                      Weighted result
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {weightedScore === null
                        ? "—"
                        : `${weightedScore.toFixed(2)} / ${criterion.weight}`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">
                      Employee rating
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={appraisal.maximumScore}
                      step="0.01"
                      value={row.employeeRating}
                      onChange={(event) =>
                        updateRow(criterion.id, {
                          employeeRating:
                            event.target.value,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Supervisor rating
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={appraisal.maximumScore}
                      step="0.01"
                      value={row.supervisorRating}
                      onChange={(event) =>
                        updateRow(criterion.id, {
                          supervisorRating:
                            event.target.value,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Final agreed rating
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={appraisal.maximumScore}
                      step="0.01"
                      value={row.finalRating}
                      onChange={(event) =>
                        updateRow(criterion.id, {
                          finalRating:
                            event.target.value,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Employee comments
                    </label>
                    <Textarea
                      rows={4}
                      value={row.employeeComments}
                      onChange={(event) =>
                        updateRow(criterion.id, {
                          employeeComments:
                            event.target.value,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Supervisor comments
                    </label>
                    <Textarea
                      rows={4}
                      value={row.supervisorComments}
                      onChange={(event) =>
                        updateRow(criterion.id, {
                          supervisorComments:
                            event.target.value,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Evidence or examples
                    </label>
                    <Textarea
                      rows={4}
                      value={row.evidence}
                      onChange={(event) =>
                        updateRow(criterion.id, {
                          evidence:
                            event.target.value,
                        })
                      }
                      className="mt-2"
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Overall comments
        </h2>

        <div className="grid gap-5 border-y border-border py-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="employeeComments"
              className="text-sm font-medium"
            >
              Employee’s overall comments
            </label>
            <Textarea
              id="employeeComments"
              name="employeeComments"
              rows={5}
              defaultValue={
                appraisal.employeeComments ?? ""
              }
              className="mt-2"
            />
          </div>

          <div>
            <label
              htmlFor="supervisorComments"
              className="text-sm font-medium"
            >
              Supervisor’s overall comments
            </label>
            <Textarea
              id="supervisorComments"
              name="supervisorComments"
              rows={5}
              defaultValue={
                appraisal.supervisorComments ?? ""
              }
              className="mt-2"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="developmentPlan"
              className="text-sm font-medium"
            >
              Development plan
            </label>
            <Textarea
              id="developmentPlan"
              name="developmentPlan"
              rows={5}
              defaultValue={
                appraisal.developmentPlan ?? ""
              }
              className="mt-2"
            />
          </div>
        </div>
      </section>
    </form>
  )
}
