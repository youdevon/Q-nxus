"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Workflow } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import {
  saveLeaveWorkflowSettings,
  type LeaveWorkflowFormState,
} from "@/src/modules/hr/actions/save-leave-workflow-settings";
import type { LeaveWorkflowSettingsPageData } from "@/src/modules/hr/data/get-leave-workflow-settings-page";
import {
  LEAVE_WORKFLOW_MODES,
  leaveWorkflowModeLabel,
  leaveWorkflowRequiresFinalApprover,
  type LeaveWorkflowMode,
} from "@/src/modules/hr/lib/leave-workflow-settings";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";

const initialState: LeaveWorkflowFormState = {
  status: "idle",
  message: "",
};

export function LeaveWorkflowSettingsForm({
  data,
}: {
  data: LeaveWorkflowSettingsPageData;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<LeaveWorkflowMode>(data.settings.mode);
  const [state, formAction, pending] = useActionState(
    saveLeaveWorkflowSettings,
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

  const needsFinal = leaveWorkflowRequiresFinalApprover(mode);

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Leave workflow"
        description="Choose how leave requests are acknowledged and approved. The final approver is a position — typically General Manager."
      />

      <form action={formAction} className="space-y-8">
        {state.status === "error" ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Workflow className="size-4 text-muted-foreground" />
            <SectionHeading>Approval mode</SectionHeading>
          </div>

          <div className="space-y-3">
            {LEAVE_WORKFLOW_MODES.map((item) => (
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
                    {leaveWorkflowModeLabel(item)}
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
            Required for acknowledgement-then-final and final-only modes.
            Pick the General Manager (or equivalent) position.
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

        <section className="space-y-4">
          <SectionHeading>Acknowledgement rules</SectionHeading>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="requireAllAcksBeforeFinal"
              defaultChecked={data.settings.requireAllAcksBeforeFinal}
              className="mt-1 size-4"
            />
            <span>
              <span className="block text-sm font-medium">
                Require all acknowledgements before final approval
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Final approver cannot approve or reject until the reporting line
                has acknowledged.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="ackOrder" className="text-sm font-medium">
              Acknowledgement order
            </label>
            <select
              id="ackOrder"
              name="ackOrder"
              defaultValue={data.settings.ackOrder}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ANY">Any order (all required before final)</option>
              <option value="SEQUENTIAL">Sequential up the reporting line</option>
            </select>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading>Vacation use-or-lose alerts</SectionHeading>
          <p className="text-sm text-muted-foreground">
            When a contract ends within 30 days and vacation balance remains,
            notify these people. Unused vacation does not roll to a new
            contract.
          </p>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="notifyEmployee"
              defaultChecked={data.forfeitureSettings.notifyEmployee}
              className="mt-1 size-4"
            />
            <span className="text-sm font-medium">Notify the employee</span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="notifySupervisor"
              defaultChecked={data.forfeitureSettings.notifySupervisor}
              className="mt-1 size-4"
            />
            <span className="text-sm font-medium">
              Notify the reporting supervisor
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="notifyLeaveManagers"
              defaultChecked={data.forfeitureSettings.notifyLeaveManagers}
              className="mt-1 size-4"
            />
            <span>
              <span className="block text-sm font-medium">
                Notify leave managers
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Users with the leave.manage permission.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="sendEmailAlerts"
              defaultChecked={data.forfeitureSettings.sendEmailAlerts}
              className="mt-1 size-4"
            />
            <span>
              <span className="block text-sm font-medium">
                Also send email alerts
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Queues email for recipients who have an address on file.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="notifyHrRoleCodes" className="text-sm font-medium">
              Also notify these role codes
            </label>
            <input
              id="notifyHrRoleCodes"
              name="notifyHrRoleCodes"
              defaultValue={data.forfeitureSettings.notifyHrRoleCodes.join(", ")}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="HR_ADMINISTRATOR"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma-separated access role codes (defaults to HR_ADMINISTRATOR).
            </p>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Save />
            Save workflow
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

function modeHelp(mode: LeaveWorkflowMode): string {
  switch (mode) {
    case "MANAGER_THEN_HR":
      return "Direct manager approves, then HR confirms (current default).";
    case "DIRECT_MANAGER":
      return "Reporting-line manager decides; no HR confirmation step.";
    case "REPORTING_LINE_ACK_THEN_FINAL":
      return "Everyone between the employee and the final approver acknowledges; then the final approver decides.";
    case "FINAL_ONLY":
      return "Only the configured final approver (e.g. GM) approves or rejects.";
    case "MANAGER_THEN_FINAL":
      return "Direct manager approves first, then the final approver decides.";
    default:
      return "";
  }
}
