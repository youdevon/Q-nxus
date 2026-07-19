"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checklistItemStatusBadgeVariant } from "@/src/config/ui-colors";
import {
  markAssumptionOfDutySigned,
  setChecklistItemNotApplicable,
  uploadChecklistCredentialDocument,
  uploadChecklistDirectAttachment,
  type ChecklistActionState,
} from "@/src/modules/hr/actions/manage-employee-file-checklist";
import type { EmployeeFileChecklistView } from "@/src/modules/hr/data/get-employee-file-checklist";
import {
  checklistStatusLabel,
  supportsCredentialUpload,
  type EmployeeFileChecklistStatus,
} from "@/src/modules/hr/lib/employee-file-checklist";

const initialState: ChecklistActionState = {
  status: "idle",
  message: "",
};

function useActionToast(state: ChecklistActionState) {
  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
}

function NotApplicableForm({
  employeeId,
  itemType,
  notApplicable,
}: {
  employeeId: string;
  itemType: string;
  notApplicable: boolean;
}) {
  const [state, action, pending] = useActionState(
    setChecklistItemNotApplicable,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="itemType" value={itemType} />
      <input
        type="hidden"
        name="notApplicable"
        value={notApplicable ? "0" : "1"}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {notApplicable ? "Mark applicable" : "Mark N/A"}
      </Button>
    </form>
  );
}

function CredentialUploadForm({
  employeeId,
  itemType,
}: {
  employeeId: string;
  itemType: string;
}) {
  const [state, action, pending] = useActionState(
    uploadChecklistCredentialDocument,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="itemType" value={itemType} />
      <Input
        type="file"
        name="attachment"
        accept=".pdf,.doc,.docx,image/*"
        className="max-w-56 text-xs"
        required
      />
      <Button type="submit" size="sm" disabled={pending}>
        Upload
      </Button>
    </form>
  );
}

function AssumptionControls({
  employeeId,
  status,
}: {
  employeeId: string;
  status: EmployeeFileChecklistStatus;
}) {
  const [signState, signAction, signPending] = useActionState(
    markAssumptionOfDutySigned,
    initialState,
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadChecklistDirectAttachment,
    initialState,
  );
  useActionToast(signState);
  useActionToast(uploadState);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "SIGNED" ? (
          <form action={signAction}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="clear" value="1" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={signPending}
            >
              Clear signed
            </Button>
          </form>
        ) : (
          <form action={signAction}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <Button type="submit" size="sm" disabled={signPending}>
              Mark signed
            </Button>
          </form>
        )}
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={
            <Link href={`/people/employees/${employeeId}/documents/new`} />
          }
        >
          New letter
        </Button>
      </div>
      <form
        action={uploadAction}
        className="flex flex-wrap items-center justify-end gap-2"
      >
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="itemType" value="ASSUMPTION_OF_DUTY" />
        <Input
          type="file"
          name="attachment"
          accept=".pdf,.doc,.docx,image/*"
          className="max-w-56 text-xs"
          required
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={uploadPending}
        >
          Upload signed form
        </Button>
      </form>
    </div>
  );
}

type EmployeeFileChecklistProps = {
  employeeId: string;
  checklist: EmployeeFileChecklistView;
  canManage?: boolean;
  readOnly?: boolean;
};

export function EmployeeFileChecklist({
  employeeId,
  checklist,
  canManage = false,
  readOnly = false,
}: EmployeeFileChecklistProps) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Employee file checklist
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {checklist.completeCount} of {checklist.totalCount} complete
        </p>
      </div>

      <div className="mb-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={checklist.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Employee file completeness"
        >
          <div
            className="h-full rounded-full bg-foreground/70 transition-[width]"
            style={{ width: `${checklist.percentComplete}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-border/70">
        {checklist.items.map((item) => (
          <div
            key={item.itemType}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.label}</p>
                <Badge variant={checklistItemStatusBadgeVariant(item.status)}>
                  {checklistStatusLabel(item.status)}
                </Badge>
              </div>
              {item.linkedLabel ? (
                <p className="text-xs text-muted-foreground">
                  {item.sourceKind === "qualification"
                    ? "Qualification"
                    : item.sourceKind === "credential"
                      ? "Credential"
                      : item.sourceKind === "correspondence"
                        ? "Letter"
                        : item.sourceKind === "manual"
                          ? "HR confirmation"
                          : "Attachment"}
                  {": "}
                  {item.linkedHref ? (
                    <Link
                      href={item.linkedHref}
                      className="underline-offset-2 hover:underline"
                    >
                      {item.linkedLabel}
                    </Link>
                  ) : (
                    item.linkedLabel
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {item.status === "NOT_APPLICABLE"
                    ? "Not required for this employee."
                    : "No linked document yet."}
                </p>
              )}
              {item.downloadHref ? (
                <p className="text-xs">
                  <Link
                    href={item.downloadHref}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    Download
                  </Link>
                </p>
              ) : null}
              {!readOnly && item.notes ? (
                <p className="text-xs text-muted-foreground">{item.notes}</p>
              ) : null}
            </div>

            {canManage && !readOnly ? (
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                {item.allowsNotApplicable ? (
                  <NotApplicableForm
                    employeeId={employeeId}
                    itemType={item.itemType}
                    notApplicable={item.notApplicable}
                  />
                ) : null}

                {item.itemType === "ACADEMIC_CERTIFICATES" &&
                item.status === "MISSING" ? (
                  <Button
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    render={
                      <Link
                        href={`/people/employees/${employeeId}/qualifications/new`}
                      />
                    }
                  >
                    Add qualification
                  </Button>
                ) : null}

                {supportsCredentialUpload(item.itemType) &&
                item.status !== "NOT_APPLICABLE" ? (
                  <CredentialUploadForm
                    employeeId={employeeId}
                    itemType={item.itemType}
                  />
                ) : null}

                {item.itemType === "ASSUMPTION_OF_DUTY" &&
                item.status !== "NOT_APPLICABLE" ? (
                  <AssumptionControls
                    employeeId={employeeId}
                    status={item.status}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
