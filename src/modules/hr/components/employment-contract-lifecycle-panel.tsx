"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  activateEmploymentContract,
  decideEmploymentContract,
  signEmploymentContract,
  submitEmploymentContract,
  uploadEmploymentContractDocument,
  type ContractLifecycleState,
} from "@/src/modules/hr/actions/manage-employment-contract-lifecycle";
import { contractStatusLabel } from "@/src/modules/hr/lib/contract-lifecycle";

const idle: ContractLifecycleState = { status: "idle", message: "" };

function useLifecycleToast(state: ContractLifecycleState) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
}

export function EmploymentContractLifecyclePanel({
  contractId,
  employeeId,
  status,
  employeeSignedAt,
  orgSignedAt,
  documentFileName,
  canManage,
  isEmployeeSelf,
}: {
  contractId: string;
  employeeId: string;
  status: string;
  employeeSignedAt: string | null;
  orgSignedAt: string | null;
  documentFileName: string | null;
  canManage: boolean;
  isEmployeeSelf: boolean;
}) {
  const [submitState, submitAction, submitPending] = useActionState(
    submitEmploymentContract,
    idle,
  );
  const [decideState, decideAction, decidePending] = useActionState(
    decideEmploymentContract,
    idle,
  );
  const [signState, signAction, signPending] = useActionState(
    signEmploymentContract,
    idle,
  );
  const [activateState, activateAction, activatePending] = useActionState(
    activateEmploymentContract,
    idle,
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadEmploymentContractDocument,
    idle,
  );

  useLifecycleToast(submitState);
  useLifecycleToast(decideState);
  useLifecycleToast(signState);
  useLifecycleToast(activateState);
  useLifecycleToast(uploadState);

  return (
    <section className="space-y-4 border-y border-border py-5">
      <div>
        <p className="text-xs text-muted-foreground">Lifecycle</p>
        <p className="mt-1 text-sm font-semibold">
          {contractStatusLabel(status)}
        </p>
        <ol className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {[
            "DRAFT",
            "PENDING_APPROVAL",
            "APPROVED",
            "AWAITING_SIGNATURE",
            "ACTIVE",
          ].map((step) => (
            <li
              key={step}
              className={
                status === step
                  ? "rounded-md bg-primary/10 px-2 py-1 font-medium text-foreground"
                  : "rounded-md bg-muted px-2 py-1"
              }
            >
              {contractStatusLabel(step)}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          Employee acceptance:{" "}
          <span className="font-medium">
            {employeeSignedAt ? employeeSignedAt.slice(0, 10) : "Pending"}
          </span>
        </p>
        <p>
          Organization signature:{" "}
          <span className="font-medium">
            {orgSignedAt ? orgSignedAt.slice(0, 10) : "Pending"}
          </span>
        </p>
      </div>

      {canManage && status === "DRAFT" ? (
        <form action={submitAction}>
          <input type="hidden" name="contractId" value={contractId} />
          <Button type="submit" disabled={submitPending}>
            {submitPending ? "Submitting…" : "Submit for approval"}
          </Button>
        </form>
      ) : null}

      {canManage && status === "PENDING_APPROVAL" ? (
        <form action={decideAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="contractId" value={contractId} />
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs text-muted-foreground" htmlFor="comment">
              Comment
            </label>
            <Textarea id="comment" name="comment" rows={2} className="mt-1" />
          </div>
          <Button
            type="submit"
            name="decision"
            value="APPROVE"
            disabled={decidePending}
          >
            Approve
          </Button>
          <Button
            type="submit"
            name="decision"
            value="REJECT"
            variant="outline"
            disabled={decidePending}
          >
            Return to draft
          </Button>
        </form>
      ) : null}

      {(status === "APPROVED" || status === "AWAITING_SIGNATURE") &&
      (isEmployeeSelf || canManage) &&
      !employeeSignedAt ? (
        <form action={signAction}>
          <input type="hidden" name="contractId" value={contractId} />
          <input type="hidden" name="party" value="employee" />
          <Button type="submit" disabled={signPending}>
            {signPending ? "Recording…" : "Accept contract (employee)"}
          </Button>
        </form>
      ) : null}

      {(status === "APPROVED" || status === "AWAITING_SIGNATURE") &&
      canManage &&
      !orgSignedAt ? (
        <form action={signAction}>
          <input type="hidden" name="contractId" value={contractId} />
          <input type="hidden" name="party" value="org" />
          <Button type="submit" variant="outline" disabled={signPending}>
            {signPending ? "Recording…" : "Sign for organization"}
          </Button>
        </form>
      ) : null}

      {canManage &&
      (status === "DRAFT" ||
        status === "APPROVED" ||
        status === "AWAITING_SIGNATURE") ? (
        <form action={activateAction}>
          <input type="hidden" name="contractId" value={contractId} />
          <Button type="submit" disabled={activatePending}>
            {activatePending ? "Activating…" : "Activate contract"}
          </Button>
        </form>
      ) : null}

      {canManage ? (
        <form
          action={uploadAction}
          className="flex flex-wrap items-end gap-3"
          encType="multipart/form-data"
        >
          <input type="hidden" name="contractId" value={contractId} />
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="document">
              Filed contract PDF
              {documentFileName ? ` (${documentFileName})` : ""}
            </label>
            <Input
              id="document"
              name="document"
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="mt-1"
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={uploadPending}>
            {uploadPending ? "Uploading…" : "Upload document"}
          </Button>
          {documentFileName ? (
            <Button
              nativeButton={false}
              variant="ghost"
              render={
                <a
                  href={`/people/employees/${employeeId}/contracts/${contractId}/document`}
                />
              }
            >
              Download
            </Button>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
