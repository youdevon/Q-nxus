"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleStop } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/src/components/layout/page-header";
import { FormPageActions } from "@/src/components/layout/page-actions";
import {
  closeEmploymentContract,
  type CloseContractFormState,
} from "@/src/modules/hr/actions/close-employment-contract";
import type { EmploymentContractProfile } from "@/src/modules/hr/data/get-employment-contracts";
import { PeopleNav } from "./people-nav";

const initialState: CloseContractFormState = {
  status: "idle",
  message: "",
};

export function CloseEmploymentContractForm({
  contract,
}: {
  contract: EmploymentContractProfile;
}) {
  const [state, action, pending] = useActionState(
    closeEmploymentContract,
    initialState,
  );

  const [updateEmployeeStatus, setUpdateEmployeeStatus] = useState(false);

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

      <input type="hidden" name="employeeId" value={contract.employee.id} />

      <input type="hidden" name="contractId" value={contract.id} />

      <input type="hidden" name="updatedAt" value={contract.updatedAt} />

      <PageHeader
        title="Close Employment Contract"
        description={`${contract.employee.firstName} ${contract.employee.lastName} · ${contract.employee.employeeNumber}`}
        backHref={`/people/employees/${contract.employee.id}/contracts/${contract.id}`}
        backLabel="Contract"
        actions={
          <FormPageActions
            cancelHref={`/people/employees/${contract.employee.id}/contracts/${contract.id}`}
          >
            <Button type="submit" variant="destructive" disabled={pending}>
              <CircleStop />
              {pending ? "Closing…" : "Close contract"}
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
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Closure information
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="closureStatus" className="text-sm font-medium">
              Closure type
            </label>

            <select
              id="closureStatus"
              name="closureStatus"
              defaultValue="EXPIRED"
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="EXPIRED">Contract completed or expired</option>
              <option value="TERMINATED">Contract terminated</option>
              <option value="CANCELLED">Contract cancelled</option>
            </select>
          </div>

          <div>
            <label htmlFor="effectiveDate" className="text-sm font-medium">
              Effective date
            </label>

            <Input
              id="effectiveDate"
              name="effectiveDate"
              type="date"
              min={contract.startDate}
              defaultValue={contract.endDate ?? ""}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label htmlFor="documentReference" className="text-sm font-medium">
              Document reference
            </label>

            <Input
              id="documentReference"
              name="documentReference"
              defaultValue={contract.documentReference ?? ""}
              className="mt-2"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="terminationReason" className="text-sm font-medium">
              Closure or termination reason
            </label>

            <Textarea
              id="terminationReason"
              name="terminationReason"
              rows={4}
              className="mt-2"
            />
          </div>

          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              name="updateEmployeeStatus"
              checked={updateEmployeeStatus}
              onChange={(event) =>
                setUpdateEmployeeStatus(event.target.checked)
              }
              className="size-4"
            />

            <span className="text-sm font-medium">
              Update the employee’s employment status
            </span>
          </label>

          {updateEmployeeStatus && (
            <div>
              <label htmlFor="employeeStatus" className="text-sm font-medium">
                New employee status
              </label>

              <select
                id="employeeStatus"
                name="employeeStatus"
                defaultValue="INACTIVE"
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
                <option value="RETIRED">Retired</option>
                <option value="ON_LEAVE">On leave</option>
              </select>
            </div>
          )}

          <label className="flex items-start gap-3 border-t border-border pt-5 md:col-span-2">
            <input
              type="checkbox"
              name="confirmed"
              className="mt-0.5 size-4"
              required
            />

            <span className="text-sm">
              I confirm that this contract should be closed. This record will
              remain in the employee’s contract history and will no longer be
              marked as current.
            </span>
          </label>
        </div>
      </section>
    </form>
  );
}
