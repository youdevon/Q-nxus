"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import {
  createJobDescription,
  updateJobDescription,
  type JobDescriptionFormState,
} from "@/src/modules/hr/actions/save-job-description";
import type {
  JobDescriptionRecord,
  PositionJobDescriptionData,
} from "@/src/modules/hr/data/get-job-descriptions";

type CriterionRow = {
  rowId: string;
  criterionType: string;
  title: string;
  description: string;
  measurement: string;
  weight: string;
  sortOrder: number;
  isActive: boolean;
};

type JobDescriptionFormProps = {
  position: PositionJobDescriptionData["position"];
  jobDescription?: JobDescriptionRecord;
};

const initialState: JobDescriptionFormState = {
  status: "idle",
  message: "",
};

function createRow(index: number): CriterionRow {
  return {
    rowId: crypto.randomUUID(),
    criterionType: "DUTY",
    title: "",
    description: "",
    measurement: "",
    weight: "0",
    sortOrder: index + 1,
    isActive: true,
  };
}

export function JobDescriptionForm({
  position,
  jobDescription,
}: JobDescriptionFormProps) {
  const readOnly =
    Boolean(jobDescription) && jobDescription?.status !== "DRAFT";

  const action = jobDescription ? updateJobDescription : createJobDescription;

  const [state, formAction, pending] = useActionState(action, initialState);

  const [rows, setRows] = useState<CriterionRow[]>(
    jobDescription?.criteria.map((criterion) => ({
      rowId: criterion.id,
      criterionType: criterion.criterionType,
      title: criterion.title,
      description: criterion.description ?? "",
      measurement: criterion.measurement ?? "",
      weight: criterion.weight,
      sortOrder: criterion.sortOrder,
      isActive: criterion.isActive,
    })) ?? [],
  );

  const totalWeight = useMemo(
    () =>
      rows
        .filter((row) =>
          [
            "PERFORMANCE_OBJECTIVE",
            "KEY_PERFORMANCE_INDICATOR",
            "TECHNICAL_COMPETENCY",
            "BEHAVIOURAL_COMPETENCY",
          ].includes(row.criterionType),
        )
        .reduce((total, row) => total + (Number(row.weight) || 0), 0),
    [rows],
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  function updateRow(rowId: string, values: Partial<CriterionRow>) {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...values } : row)),
    );
  }

  return (
    <form action={formAction}>
      <PageShell size="lg">
      <PeoplePageHeader
        title={
          jobDescription
            ? `Job Description Version ${jobDescription.versionNumber}`
            : "New Job Description"
        }
        description={`${position.title} · ${position.department.name}`}
        backHref={`/people/structure/positions/${position.id}/job-descriptions`}
        backLabel="Versions"
        actions={
          <FormPageActions
            cancelHref={`/people/structure/positions/${position.id}/job-descriptions`}
          >
            <Button type="submit" disabled={pending || readOnly}>
              <Save />
              {pending ? "Saving…" : "Save job description"}
            </Button>
          </FormPageActions>
        }
      />

      <input type="hidden" name="positionId" value={position.id} />

      {jobDescription && (
        <>
          <input type="hidden" name="id" value={jobDescription.id} />
          <input
            type="hidden"
            name="updatedAt"
            value={jobDescription.updatedAt}
          />
        </>
      )}

      {state.status !== "idle" && (
        <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {readOnly && (
        <div className="text-sm text-muted-foreground">
          This version is {jobDescription?.status.toLowerCase()} and is
          read-only. Create a new version to make changes.
        </div>
      )}

      <fieldset disabled={readOnly} className="contents">
        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            Position overview
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">
                Job description title
              </label>
              <Input
                name="title"
                defaultValue={jobDescription?.title ?? position.title}
                className="mt-2"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">Summary</label>
              <Textarea
                name="summary"
                defaultValue={jobDescription?.summary ?? ""}
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">Position purpose</label>
              <Textarea
                name="positionPurpose"
                defaultValue={jobDescription?.positionPurpose ?? ""}
                rows={4}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Reports to</label>
              <Input
                name="reportsTo"
                defaultValue={jobDescription?.reportsTo ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Supervisory responsibility
              </label>
              <Input
                name="supervisoryResponsibility"
                defaultValue={jobDescription?.supervisoryResponsibility ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Effective from</label>
              <Input
                name="effectiveFrom"
                type="date"
                defaultValue={jobDescription?.effectiveFrom ?? ""}
                className="mt-2"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Effective until</label>
              <Input
                name="effectiveUntil"
                type="date"
                defaultValue={jobDescription?.effectiveUntil ?? ""}
                className="mt-2"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            Requirements
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Qualifications</label>
              <Textarea
                name="qualifications"
                defaultValue={jobDescription?.qualifications ?? ""}
                rows={6}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Required experience</label>
              <Textarea
                name="requiredExperience"
                defaultValue={jobDescription?.requiredExperience ?? ""}
                rows={6}
                className="mt-2"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                Duties and appraisal criteria
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Weighted appraisal criteria total {totalWeight}%.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRows((current) => [...current, createRow(current.length)])
              }
            >
              <Plus />
              Add criterion
            </Button>
          </div>

          <div className="space-y-6">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No duties or criteria have been added.
              </p>
            ) : (
              rows.map((row, index) => (
                <article
                  key={row.rowId}
                  className="grid gap-4 border-b border-border pb-6 md:grid-cols-2 lg:grid-cols-4"
                >
                  <input
                    type="hidden"
                    name="criterionRowIds"
                    value={row.rowId}
                  />

                  <div>
                    <label className="text-sm font-medium">
                      Criterion type
                    </label>
                    <select
                      name={`criterionType:${row.rowId}`}
                      value={row.criterionType}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          criterionType: event.target.value,
                        })
                      }
                      className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="DUTY">Duty</option>
                      <option value="RESPONSIBILITY">Responsibility</option>
                      <option value="PERFORMANCE_OBJECTIVE">
                        Performance objective
                      </option>
                      <option value="KEY_PERFORMANCE_INDICATOR">
                        Key performance indicator
                      </option>
                      <option value="TECHNICAL_COMPETENCY">
                        Technical competency
                      </option>
                      <option value="BEHAVIOURAL_COMPETENCY">
                        Behavioural competency
                      </option>
                      <option value="QUALIFICATION">Qualification</option>
                      <option value="EXPERIENCE">Experience</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      name={`criterionTitle:${row.rowId}`}
                      value={row.title}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          title: event.target.value,
                        })
                      }
                      className="mt-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Weight %</label>
                    <Input
                      name={`criterionWeight:${row.rowId}`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.weight}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          weight: event.target.value,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      name={`criterionDescription:${row.rowId}`}
                      value={row.description}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          description: event.target.value,
                        })
                      }
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Measurement method
                    </label>
                    <Textarea
                      name={`criterionMeasurement:${row.rowId}`}
                      value={row.measurement}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          measurement: event.target.value,
                        })
                      }
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Sort order</label>
                    <Input
                      name={`criterionSortOrder:${row.rowId}`}
                      type="number"
                      min={0}
                      value={row.sortOrder}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          sortOrder: Number(event.target.value) || index + 1,
                        })
                      }
                      className="mt-2"
                    />

                    <label className="mt-4 flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name={`criterionActive:${row.rowId}`}
                        checked={row.isActive}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            isActive: event.target.checked,
                          })
                        }
                        className="size-4"
                      />
                      Active criterion
                    </label>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-4"
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.rowId !== row.rowId),
                        )
                      }
                    >
                      <Trash2 />
                      Remove
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </fieldset>

      <footer className="flex justify-end border-t border-border pt-5">
        <Button type="submit" disabled={pending || readOnly}>
          <Save />
          {pending
            ? "Saving…"
            : readOnly
              ? "Historical version"
              : "Save job description"}
        </Button>
      </footer>
      </PageShell>
    </form>
  );
}
