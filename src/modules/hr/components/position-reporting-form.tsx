"use client";

import { useActionState, useEffect } from "react";
import { Network, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  updatePositionReporting,
  type PositionReportingFormState,
} from "@/src/modules/hr/actions/update-position-reporting";
import type { PositionReportingEditorData } from "@/src/modules/hr/data/get-organization-chart";
import { PeopleNav } from "./people-nav";

const initialState: PositionReportingFormState = {
  status: "idle",
  message: "",
};

export function PositionReportingForm({
  data,
}: {
  data: PositionReportingEditorData;
}) {
  const [state, action, pending] = useActionState(
    updatePositionReporting,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  return (
    <form
      action={action}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <PeopleNav />

      <input type="hidden" name="positionId" value={data.position.id} />

      <input type="hidden" name="updatedAt" value={data.position.updatedAt} />

      <input type="hidden" name="returnTo" value="/people/structure" />

      <PageHeader
        title="Edit Reporting Relationship"
        description={`${data.position.title} · ${data.position.departmentName}`}
        backHref={`/people/structure/positions/${data.position.id}`}
        backLabel="Position"
        actions={
          <FormPageActions
            cancelHref={`/people/structure/positions/${data.position.id}`}
          >
            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save reporting line"}
            </Button>
          </FormPageActions>
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

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Position hierarchy
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Position</p>
            <p className="mt-1 text-sm font-medium">{data.position.title}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {data.position.code ?? "No position code"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Department</p>
            <p className="mt-1 text-sm font-medium">
              {data.position.departmentName}
            </p>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="reportsToPositionId"
              className="text-sm font-medium"
            >
              Reports to position
            </label>

            <select
              id="reportsToPositionId"
              name="reportsToPositionId"
              defaultValue={data.position.reportsToPositionId ?? ""}
              className="mt-2 flex h-10 w-full border border-input bg-transparent px-3 text-sm"
            >
              <option value="">No reporting position — top level</option>

              {data.availableManagers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.title}
                  {manager.code ? ` (${manager.code})` : ""}
                  {" ·"}
                  {manager.departmentName}
                  {manager.currentHolderNames.length > 0
                    ? ` · ${manager.currentHolderNames.join(",")}`
                    : " · Vacant"}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-muted-foreground">
              Positions below this position are excluded to prevent circular
              reporting relationships.
            </p>
          </div>
        </div>
      </section>
    </form>
  );
}
