"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { correspondenceResponseStatusBadgeVariant } from "@/src/config/ui-colors";
import { formatDisplayDateTime } from "@/src/lib/format";
import {
  reviewEmployeeCorrespondenceResponse,
  submitEmployeeCorrespondenceResponse,
  type CorrespondenceResponseActionState,
} from "@/src/modules/hr/actions/manage-employee-correspondence-response";
import type { CorrespondenceResponseSummary } from "@/src/modules/hr/data/get-employee-correspondence";

const initialState: CorrespondenceResponseActionState = {
  status: "idle",
  message: "",
};

function formatDateTime(value: string): string {
  return formatDisplayDateTime(value);
}

function useActionToast(state: CorrespondenceResponseActionState) {
  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
}

function ResponseStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={correspondenceResponseStatusBadgeVariant(status)}>
      {status === "OPEN" ? "Open" : "Reviewed"}
    </Badge>
  );
}

function ResponseAttachment({
  attachment,
}: {
  attachment: NonNullable<CorrespondenceResponseSummary["attachment"]>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
      <p className="text-sm font-medium">{attachment.fileName}</p>
      <div className="flex gap-2">
        <Button
          nativeButton={false}
          size="sm"
          variant="outline"
          render={<Link href={attachment.viewHref} target="_blank" />}
        >
          View
        </Button>
        <Button
          nativeButton={false}
          size="sm"
          variant="outline"
          render={<Link href={attachment.downloadHref} />}
        >
          <Download />
          Download
        </Button>
      </div>
    </div>
  );
}

export function CorrespondenceResponseSubmitForm({
  correspondenceId,
  canUpdate,
  existingBody,
}: {
  correspondenceId: string;
  canUpdate: boolean;
  existingBody?: string;
}) {
  const [state, action, pending] = useActionState(
    submitEmployeeCorrespondenceResponse,
    initialState,
  );
  useActionToast(state);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SectionHeading>Submit response</SectionHeading>
        {canUpdate ? <Badge variant="outline">Update while open</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Provide a short written statement in response to this letter. You may
        update it while HR has not yet reviewed it.
      </p>
      <form action={action} className="grid max-w-xl gap-3">
        <input type="hidden" name="correspondenceId" value={correspondenceId} />
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="responseBody">
            Your statement
          </label>
          <textarea
            id="responseBody"
            name="body"
            rows={5}
            required
            defaultValue={existingBody ?? ""}
            className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            placeholder="Your response…"
          />
          {state.fieldErrors?.body ? (
            <p className="text-xs text-destructive">{state.fieldErrors.body}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="responseAttachment">
            Attachment (optional)
          </label>
          <Input
            id="responseAttachment"
            name="attachment"
            type="file"
            accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
          />
          <p className="text-xs text-muted-foreground">
            PDF, Word, or image · max 15 MB
          </p>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {canUpdate ? "Update response" : "Submit response"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function CorrespondenceResponseSection({
  correspondenceId,
  employeeId,
  allowsEmployeeResponse,
  canSubmit,
  canUpdate,
  canReview,
  response,
}: {
  correspondenceId: string;
  employeeId: string;
  allowsEmployeeResponse: boolean;
  canSubmit: boolean;
  canUpdate: boolean;
  canReview: boolean;
  response: CorrespondenceResponseSummary | null;
}) {
  if (!allowsEmployeeResponse && !response) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SectionHeading>Employee response</SectionHeading>
        {response ? <ResponseStatusBadge status={response.status} /> : null}
      </div>

      {canSubmit ? (
        <CorrespondenceResponseSubmitForm
          correspondenceId={correspondenceId}
          canUpdate={canUpdate}
          existingBody={response?.body}
        />
      ) : null}

      {response && (!canSubmit || response.status === "REVIEWED") ? (
        <article className="space-y-3 rounded-md border border-border/70 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {response.body}
          </p>
          {response.attachment ? (
            <ResponseAttachment attachment={response.attachment} />
          ) : null}
          <p className="text-xs text-muted-foreground">
            Submitted {formatDateTime(response.submittedAt)}
            {response.reviewedAt
              ? ` · Reviewed ${formatDateTime(response.reviewedAt)}`
              : ""}
            {response.reviewedByName ? ` · ${response.reviewedByName}` : ""}
          </p>
          {response.reviewNote ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                HR note
              </p>
              <p className="mt-1 whitespace-pre-wrap">{response.reviewNote}</p>
            </div>
          ) : null}
          {canReview ? (
            <CorrespondenceResponseReviewForm
              responseId={response.id}
              employeeId={employeeId}
              correspondenceId={correspondenceId}
            />
          ) : null}
        </article>
      ) : null}

      {allowsEmployeeResponse && !response && !canSubmit ? (
        <p className="text-sm text-muted-foreground">
          Awaiting employee response.
        </p>
      ) : null}
    </section>
  );
}

function CorrespondenceResponseReviewForm({
  responseId,
  employeeId,
  correspondenceId,
}: {
  responseId: string;
  employeeId: string;
  correspondenceId: string;
}) {
  const [state, action, pending] = useActionState(
    reviewEmployeeCorrespondenceResponse,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={action} className="grid max-w-xl gap-3 border-t border-border/70 pt-4">
      <input type="hidden" name="responseId" value={responseId} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="correspondenceId" value={correspondenceId} />
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="reviewNote">
          HR note (optional)
        </label>
        <textarea
          id="reviewNote"
          name="reviewNote"
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
          placeholder="Brief note for the record…"
        />
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          Mark as reviewed
        </Button>
      </div>
    </form>
  );
}
