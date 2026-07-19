"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  createEmployeeTrainingRecord,
  updateEmployeeTrainingRecord,
  type TrainingFormState,
} from "@/src/modules/hr/actions/manage-employee-training";

const initialState: TrainingFormState = {
  status: "idle",
  message: "",
};

type TrainingFormProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  mode: "create" | "edit";
  initial?: {
    id: string;
    courseName: string;
    provider: string | null;
    completedAt: string;
    expiryDate: string | null;
    employeeVisible: boolean;
  };
};

export function TrainingForm({ employee, mode, initial }: TrainingFormProps) {
  const action =
    mode === "create"
      ? createEmployeeTrainingRecord
      : updateEmployeeTrainingRecord;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const cancelHref = `/people/employees/${employee.id}/documents`;

  return (
    <form action={formAction}>
      <input type="hidden" name="employeeId" value={employee.id} />
      {mode === "edit" && initial ? (
        <input type="hidden" name="trainingId" value={initial.id} />
      ) : null}

      <PageShell>
        <PeoplePageHeader
          title={mode === "create" ? "Add training" : "Edit training"}
          description={`${employee.firstName} ${employee.lastName} · ${employee.employeeNumber}`}
          backHref={cancelHref}
          backLabel="Employee file"
          actions={
            <FormPageActions cancelHref={cancelHref}>
              <Button type="submit" disabled={pending}>
                <Save />
                {pending ? "Saving…" : "Save"}
              </Button>
            </FormPageActions>
          }
        />

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="courseName">
              Course name
            </label>
            <Input
              id="courseName"
              name="courseName"
              defaultValue={initial?.courseName ?? ""}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="provider">
              Provider
            </label>
            <Input
              id="provider"
              name="provider"
              defaultValue={initial?.provider ?? ""}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="completedAt">
              Completed on
            </label>
            <Input
              id="completedAt"
              name="completedAt"
              type="date"
              defaultValue={
                initial?.completedAt ?? new Date().toISOString().slice(0, 10)
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="expiryDate">
              Expiry date
            </label>
            <Input
              id="expiryDate"
              name="expiryDate"
              type="date"
              defaultValue={initial?.expiryDate ?? ""}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="attachment">
              Attachment
            </label>
            <Input
              id="attachment"
              name="attachment"
              type="file"
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
            />
          </div>
        </section>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="employeeVisible"
            value="true"
            defaultChecked={initial?.employeeVisible ?? true}
            className="mt-0.5 size-4"
          />
          <span className="font-medium">Employee visible</span>
        </label>
      </PageShell>
    </form>
  );
}
