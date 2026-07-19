"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  saveContractWorkflowSettings,
  type ContractWorkflowFormState,
} from "@/src/modules/hr/actions/save-contract-workflow-settings";
import type { ContractWorkflowSettingsPageData } from "@/src/modules/hr/data/get-contract-workflow-settings-page";
import {
  CONTRACT_WORKFLOW_MODES,
  contractWorkflowModeLabel,
  contractWorkflowRequiresFinalApprover,
  type ContractWorkflowMode,
} from "@/src/modules/hr/lib/contract-workflow-settings";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";

const initialState: ContractWorkflowFormState = {
  status: "idle",
  message: "",
};

export function ContractWorkflowSettingsForm({
  data,
}: {
  data: ContractWorkflowSettingsPageData;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ContractWorkflowMode>(data.settings.mode);
  const [state, formAction, pending] = useActionState(
    saveContractWorkflowSettings,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);

  const needsFinal = contractWorkflowRequiresFinalApprover(mode);

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Contract workflow"
        description="Choose how employment contracts are approved and whether both employee and organization must accept before activation."
        backHref="/contracts"
        backLabel="Contract monitoring"
      />

      <form action={formAction} className="space-y-8">
        {state.status === "error" ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <FileSignature className="size-4 text-muted-foreground" />
            <SectionHeading>Approval mode</SectionHeading>
          </div>

          <div className="space-y-3">
            {CONTRACT_WORKFLOW_MODES.map((item) => (
              <label
                key={item}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 px-4 py-3 hover:bg-muted/20"
              >
                <input
                  type="radio"
                  name="mode"
                  value={item}
                  checked={mode === item}
                  onChange={() => setMode(item)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">
                    {contractWorkflowModeLabel(item)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {modeHelp(item)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading>Final approver position</SectionHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            Required when using final-approver mode. Contracts submitted for
            approval are assigned to the holder of this position.
          </p>

          <select
            name="finalApproverPositionId"
            defaultValue={data.settings.finalApproverPositionId ?? ""}
            required={needsFinal}
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {needsFinal ? "Select position…" : "None (not required)"}
            </option>
            {data.positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title}
                {position.departmentName ? ` · ${position.departmentName}` : ""}
                {position.holderName ? ` · ${position.holderName}` : " · Vacant"}
              </option>
            ))}
          </select>
        </section>

        <section>
          <SectionHeading>Signatures</SectionHeading>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 px-4 py-3 hover:bg-muted/20">
            <input
              type="checkbox"
              name="requireDualSignature"
              value="true"
              defaultChecked={data.settings.requireDualSignature}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                Require dual signature
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Both employee acceptance and organization signature must be
                recorded before activation (except Save &amp; activate shortcut
                from draft).
              </span>
            </span>
          </label>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Save />
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

function modeHelp(mode: ContractWorkflowMode): string {
  switch (mode) {
    case "PEOPLE_MANAGE_AUTO":
      return "HR / contracts managers can submit straight to awaiting signature (auto-approve).";
    case "FINAL_APPROVER_POSITION":
      return "Submitted contracts wait for the final approver position before signature.";
    default:
      return "";
  }
}
