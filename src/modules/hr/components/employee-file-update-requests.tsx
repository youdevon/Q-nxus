"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDisplayDate } from "@/src/lib/format";
import {
  resolveQualificationUpdateRequest,
  submitEmployeeFileUpdateRequest,
  type FileUpdateRequestActionState,
} from "@/src/modules/hr/actions/manage-employee-file-update-requests";
import type { EmployeeFileUpdateRequestItem } from "@/src/modules/hr/data/get-employee-file-update-requests";

const initialState: FileUpdateRequestActionState = {
  status: "idle",
  message: "",
};

function useActionToast(state: FileUpdateRequestActionState) {
  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
}

function formatDate(value: string): string {
  return formatDisplayDate(value);
}

export function QualificationUpdateRequestForm() {
  const [state, action, pending] = useActionState(
    submitEmployeeFileUpdateRequest,
    initialState,
  );
  useActionToast(state);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase">
        Complete your file
      </h2>
      <p className="text-sm text-muted-foreground">
        Request an HR update and optionally attach a supporting document. You
        cannot edit file records yourself.
      </p>
      <form action={action} className="grid max-w-xl gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="requestType">
            Request type
          </label>
          <select
            id="requestType"
            name="requestType"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            defaultValue="QUALIFICATION_UPDATE"
          >
            <option value="QUALIFICATION_UPDATE">Qualification update</option>
            <option value="COPY_OF_ID">Copy of ID</option>
            <option value="BIRTH_CERTIFICATE">Birth certificate</option>
            <option value="CREDENTIAL">Credential / licence</option>
            <option value="TRAINING">Training record</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="title">
            Title
          </label>
          <Input
            id="title"
            name="title"
            required
            placeholder="e.g. Add CAPE certificate"
          />
          {state.fieldErrors?.title ? (
            <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="note">
            Note (optional)
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            placeholder="What should HR update?"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="attachment">
            Attachment (optional)
          </label>
          <Input
            id="attachment"
            name="attachment"
            type="file"
            accept=".pdf,.doc,.docx,image/*"
          />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            Submit request
          </Button>
        </div>
      </form>
    </section>
  );
}

export function EmployeeFileUpdateRequestsList({
  requests,
  canManage = false,
  employeeId,
}: {
  requests: EmployeeFileUpdateRequestItem[];
  canManage?: boolean;
  employeeId: string;
}) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
        File update requests
      </h2>
      <div className="divide-y divide-border/70">
        {requests.map((request) => (
          <UpdateRequestRow
            key={request.id}
            request={request}
            canManage={canManage}
            employeeId={employeeId}
          />
        ))}
      </div>
    </section>
  );
}

function UpdateRequestRow({
  request,
  canManage,
  employeeId,
}: {
  request: EmployeeFileUpdateRequestItem;
  canManage: boolean;
  employeeId: string;
}) {
  const [state, action, pending] = useActionState(
    resolveQualificationUpdateRequest,
    initialState,
  );
  useActionToast(state);

  return (
    <article className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{request.title}</p>
          <Badge
            variant={request.status === "OPEN" ? "warning" : "secondary"}
          >
            {request.status === "OPEN" ? "Open" : "Resolved"}
          </Badge>
        </div>
        {request.note ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {request.note}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Submitted {formatDate(request.createdAt)}
          {request.resolvedAt
            ? ` · Resolved ${formatDate(request.resolvedAt)}`
            : ""}
        </p>
      </div>
      {canManage && request.status === "OPEN" ? (
        <form action={action}>
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Mark resolved
          </Button>
        </form>
      ) : null}
    </article>
  );
}
