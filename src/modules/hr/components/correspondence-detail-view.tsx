"use client";

import Link from "next/link";
import { useRouter, unstable_rethrow } from "next/navigation";
import { useTransition } from "react";
import {
  Archive,
  Bell,
  CircleCheck,
  CopyPlus,
  Download,
  FileText,
  Pencil,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  PageActionsEnd,
} from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { correspondenceStatusBadgeVariant } from "@/src/config/ui-colors";
import { formatDisplayDate, formatDisplayDateTime } from "@/src/lib/format";
import {
  acknowledgeEmployeeCorrespondence,
  archiveEmployeeCorrespondence,
  issueAssumptionOfDutyFromOffer,
  issueEmployeeCorrespondence,
  sendCorrespondenceAcknowledgementReminder,
  supersedeEmployeeCorrespondence,
} from "@/src/modules/hr/actions/manage-employee-correspondence";
import { CorrespondenceResponseSection } from "@/src/modules/hr/components/correspondence-response-section";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import type { CorrespondenceDetail } from "@/src/modules/hr/data/get-employee-correspondence";
import {
  canHrArchiveCorrespondence,
  canHrEditCorrespondence,
  canHrIssueCorrespondence,
  canHrSupersedeCorrespondence,
} from "@/src/modules/hr/lib/correspondence-visibility";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  return formatDisplayDate(value);
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

type CorrespondenceDetailViewProps = {
  detail: CorrespondenceDetail;
  canManage: boolean;
  isSelfService: boolean;
  isManagerView?: boolean;
  listHref: string;
  listBackLabel: string;
  editHref?: string;
  showPeopleNav?: boolean;
};

export function CorrespondenceDetailView({
  detail,
  canManage,
  isSelfService,
  isManagerView = false,
  listHref,
  listBackLabel,
  editHref,
  showPeopleNav = false,
}: CorrespondenceDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function runAction(
    action: (formData: FormData) => Promise<void>,
    successMessage: string,
  ) {
    const formData = new FormData();
    formData.set("employeeId", detail.employee.id);
    formData.set("correspondenceId", detail.id);

    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
        // Non-redirect actions mutate on the server; re-fetch so the page
        // reflects the new status.
        router.refresh();
      } catch (error) {
        // Server actions that redirect() throw a framework-internal error —
        // let Next.js handle it instead of toasting it as a failure.
        unstable_rethrow(error);
        toast.error(
          error instanceof Error ? error.message : "Action failed.",
        );
      }
    });
  }

  const status = detail.status as
    | "DRAFT"
    | "ISSUED"
    | "ACKNOWLEDGED"
    | "ARCHIVED"
    | "SUPERSEDED";
  const canEdit = canManage && canHrEditCorrespondence(status);
  const canIssue = canManage && canHrIssueCorrespondence(status);
  const canArchive = canManage && canHrArchiveCorrespondence(status);
  const canSupersede = canManage && canHrSupersedeCorrespondence(status);
  const canRemind =
    canManage &&
    detail.status === "ISSUED" &&
    detail.requiresAcknowledgement &&
    detail.employeeVisible;
  const canIssueAssumption =
    canManage && detail.canIssueAssumptionOfDuty;

  const headerDescription = `${detail.employee.firstName} ${detail.employee.lastName} · ${detail.employee.employeeNumber}`;
  const headerActions = isManagerView ? undefined : (
    <PageActionsEnd>
                {canEdit && editHref ? (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={<Link href={editHref} />}
                  >
                    <Pencil />
                    Edit draft
                  </Button>
                ) : null}

                {canIssueAssumption ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        issueAssumptionOfDutyFromOffer,
                        "Assumption of duty draft created.",
                      )
                    }
                  >
                    <FileText />
                    Issue assumption of duty
                  </Button>
                ) : null}

                {canSupersede ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        supersedeEmployeeCorrespondence,
                        "Superseding draft created.",
                      )
                    }
                  >
                    <CopyPlus />
                    Supersede
                  </Button>
                ) : null}

                {canRemind ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        sendCorrespondenceAcknowledgementReminder,
                        "Reminder sent.",
                      )
                    }
                  >
                    <Bell />
                    Send reminder
                  </Button>
                ) : null}

                {canArchive ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        archiveEmployeeCorrespondence,
                        "Correspondence archived.",
                      )
                    }
                  >
                    <Archive />
                    Archive
                  </Button>
                ) : null}
                {canIssue ? (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        issueEmployeeCorrespondence,
                        "Correspondence issued.",
                      )
                    }
                  >
                    <Send />
                    Issue
                  </Button>
                ) : null}

                {isSelfService && detail.canAcknowledge ? (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        acknowledgeEmployeeCorrespondence,
                        "Letter acknowledged.",
                      )
                    }
                  >
                    <CircleCheck />
                    Acknowledge
                  </Button>
                ) : null}
            </PageActionsEnd>
  );

  return (
    <PageShell size="lg">
      {showPeopleNav ? (
        <PeoplePageHeader
          title={detail.title}
          description={headerDescription}
          backHref={listHref}
          backLabel={listBackLabel}
          actions={headerActions}
        />
      ) : isSelfService ? (
        <MePageHeader
          title={detail.title}
          description={headerDescription}
          backHref={listHref}
          backLabel={listBackLabel}
          actions={headerActions}
        />
      ) : (
        <PageHeader
          title={detail.title}
          description={headerDescription}
          backHref={listHref}
          backLabel={listBackLabel}
          actions={headerActions}
        />
      )}

      <section className="flex flex-wrap items-center gap-2">
        <Badge variant={correspondenceStatusBadgeVariant(detail.status)}>
          {label(detail.status)}
        </Badge>
        <Badge variant="outline">{label(detail.category)}</Badge>
        {detail.subType ? (
          <Badge variant="secondary">{detail.subType}</Badge>
        ) : null}
        {!isSelfService && !isManagerView ? (
          <Badge variant={detail.employeeVisible ? "secondary" : "outline"}>
            {detail.employeeVisible ? "Employee visible" : "HR confidential"}
          </Badge>
        ) : null}
        {!isSelfService && detail.managerVisible ? (
          <Badge variant="outline">Manager visible</Badge>
        ) : null}
        {detail.requiresAcknowledgement ? (
          <Badge variant="outline">Acknowledgement required</Badge>
        ) : null}
        {detail.allowsEmployeeResponse ? (
          <Badge variant="outline">Employee response allowed</Badge>
        ) : null}
        {detail.isAckOverdue ? (
          <Badge variant="destructive">Acknowledgement overdue</Badge>
        ) : null}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Effective date</p>
          <p className="mt-1 text-sm font-medium">
            {formatDate(detail.effectiveDate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Issue date</p>
          <p className="mt-1 text-sm font-medium">
            {detail.issueDate ? formatDate(detail.issueDate) : "Not issued"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Issued by</p>
          <p className="mt-1 text-sm font-medium">
            {detail.issuedByName ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Retain until</p>
          <p className="mt-1 text-sm font-medium">
            {detail.retentionUntil
              ? formatDate(detail.retentionUntil)
              : "Not set"}
          </p>
        </div>
        {detail.acknowledgedAt ? (
          <div>
            <p className="text-xs text-muted-foreground">Acknowledged</p>
            <p className="mt-1 text-sm font-medium">
              {formatDisplayDateTime(detail.acknowledgedAt)}
              {detail.acknowledgedByName
                ? ` · ${detail.acknowledgedByName}`
                : ""}
            </p>
          </div>
        ) : null}
      </section>

      {detail.body ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <SectionHeading>Letter body</SectionHeading>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {detail.body}
          </p>
        </section>
      ) : null}

      <CorrespondenceResponseSection
        correspondenceId={detail.id}
        employeeId={detail.employee.id}
        allowsEmployeeResponse={detail.allowsEmployeeResponse}
        canSubmit={detail.canSubmitResponse}
        canUpdate={detail.canUpdateResponse}
        canReview={canManage && detail.canReviewResponse}
        response={detail.employeeResponse}
      />

      {detail.chain.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <SectionHeading>Version history</SectionHeading>
          </div>
          <div className="divide-y divide-border/70">
            {detail.chain.map((item) => (
              <Link
                key={item.id}
                href={
                  isSelfService
                    ? `/me/documents/${item.id}`
                    : `/people/employees/${detail.employee.id}/documents/${item.id}`
                }
                className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Effective {formatDate(item.effectiveDate)}
                  </p>
                </div>
                <Badge variant={correspondenceStatusBadgeVariant(item.status)}>
                  {label(item.status)}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {detail.relatedLetters.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <SectionHeading>Related letters</SectionHeading>
          </div>
          <div className="divide-y divide-border/70">
            {detail.relatedLetters.map((item) => (
              <Link
                key={item.id}
                href={
                  isSelfService
                    ? `/me/documents/${item.id}`
                    : `/people/employees/${detail.employee.id}/documents/${item.id}`
                }
                className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Effective {formatDate(item.effectiveDate)}
                  </p>
                </div>
                <Badge variant={correspondenceStatusBadgeVariant(item.status)}>
                  {label(item.status)}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Download className="size-4 text-muted-foreground" />
          <SectionHeading>Attachments</SectionHeading>
        </div>

        {detail.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        ) : (
          <div className="divide-y divide-border/70">
            {detail.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{attachment.fileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      attachment.mimeType,
                      formatFileSize(attachment.fileSize),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
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
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
