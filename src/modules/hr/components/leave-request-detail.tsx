import { CircleCheck, Download, FileText, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { PageShell } from "@/src/components/layout/page-shell";
import { leaveStatusBadgeVariant } from "@/src/config/ui-colors";
import { LeaveDecisionForm } from "@/src/modules/hr/components/leave-decision-form";
import { LeaveLifecycleActions } from "@/src/modules/hr/components/leave-lifecycle-actions";
import type { LeaveRequestDetail } from "@/src/modules/hr/data/get-leave-requests";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatQuantity(value: string): string {
  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeaveRequestDetailView({
  request,
}: {
  request: LeaveRequestDetail;
}) {
  const dayLabel = Number(request.requestedQuantity) === 1 ? "day" : "days";

  return (
    <PageShell>
      <PageHeader
        title={request.leaveTypeName}
        description={
          request.requestNumber
            ? `${request.requestNumber} · ${request.employeeName}`
            : request.employeeName
        }
        backHref="/leave"
        backLabel="Leave"
      />

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-2">
            <Badge variant={leaveStatusBadgeVariant(request.status)}>
              {label(request.status)}
            </Badge>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Date range</p>
          <p className="mt-2 text-sm font-medium">
            {formatDate(request.startDate)} –{" "}
            {formatDate(request.endDate)}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Working days</p>
          <p className="mt-2 text-sm font-medium">
            {formatQuantity(request.requestedQuantity)} {dayLabel}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Submitted</p>
          <p className="mt-2 text-sm font-medium">
            {request.submittedAt
              ? new Intl.DateTimeFormat("en-TT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(request.submittedAt))
              : "—"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 border-b border-border py-6 md:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Employee</p>
          <p className="mt-1 font-medium">{request.employeeName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {request.employeeNumber}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Contract</p>
          <p className="mt-1 font-medium">{request.contractNumber ?? "—"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {request.jobTitle}
          </p>
        </div>
      </section>

      {(request.reason || request.employeeComment) && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <MessageSquareText className="size-4 text-muted-foreground" />
            <SectionHeading>Request notes</SectionHeading>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {request.reason && (
              <div>
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {request.reason}
                </p>
              </div>
            )}

            {request.employeeComment && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Comment for approver
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {request.employeeComment}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {request.attachments.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <SectionHeading>Supporting documents</SectionHeading>
          </div>

          <ul className="divide-y divide-border/70">
            {request.attachments.map((attachment) => {
              const sizeLabel = formatFileSize(attachment.fileSize);

              return (
                <li
                  key={attachment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{attachment.fileName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[
                        attachment.mimeType,
                        sizeLabel || null,
                        new Intl.DateTimeFormat("en-TT", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(attachment.uploadedAt)),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      render={
                        <a
                          href={attachment.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <FileText />
                      View
                    </Button>
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      render={<a href={attachment.downloadUrl} download />}
                    >
                      <Download />
                      Download
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CircleCheck className="size-4 text-muted-foreground" />
          <SectionHeading>Approval</SectionHeading>
        </div>

        <div className="space-y-5">
          {request.approvalSteps.map((step) => {
            const isHrStep =
              step.stepNumber > 1 &&
              !step.approverName &&
              !step.approverPositionTitle;
            const stepTitle = isHrStep
              ? "HR confirmation"
              : (step.approverName ??
                step.approverPositionTitle ??
                `Step ${step.stepNumber}`);
            const stepMeta = isHrStep
              ? "Anyone with leave management access"
              : [step.approverName ? step.approverPositionTitle : null, step.approverEmail]
                  .filter(Boolean)
                  .join(" ·") || "Approver";

            return (
              <div
                key={step.id}
                className="flex flex-wrap items-start justify-between gap-3"
              >
                <div>
                  <p className="font-medium">{stepTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stepMeta}</p>
                  {step.decisionComment && (
                    <p className="mt-2 text-sm">{step.decisionComment}</p>
                  )}
                </div>

                <Badge variant={leaveStatusBadgeVariant(step.status)}>
                  {label(step.status)}
                </Badge>
              </div>
            );
          })}

          {request.finalDecisionByName && (
            <p className="text-sm text-muted-foreground">
              Final decision by {request.finalDecisionByName}
              {request.finalDecisionComment
                ? ` — ${request.finalDecisionComment}`
                : ""}
            </p>
          )}

          {request.canDecide && (
            <div className="border-t border-border pt-5">
              <LeaveDecisionForm
                leaveRequestId={request.id}
                mode={request.decisionMode}
              />
            </div>
          )}

          {(request.canWithdraw || request.canCancel) && (
            <LeaveLifecycleActions
              leaveRequestId={request.id}
              canWithdraw={request.canWithdraw}
              canCancel={request.canCancel}
            />
          )}
        </div>
      </section>
    </PageShell>
  );
}
