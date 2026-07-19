"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildAuditChangeRows,
  formatAuditAction,
  formatAuditDateTime,
  formatAuditEntityType,
  formatAuditHeadline,
  formatAuditIpAddress,
  formatAuditModule,
  formatWorkstationLabel,
  humanizeAuditDescription,
} from "@/src/lib/audit-display";
import type { AuditTrailData } from "@/src/modules/admin/data/get-audit-events";

type AuditEvent = AuditTrailData["events"][number];

function formatActorName(user: AuditEvent["user"]): string {
  if (!user) {
    return "System";
  }

  return `${user.firstName} ${user.lastName}`;
}

function AuditEventDetailModal({
  event,
  referenceLabels,
  open,
  onOpenChange,
}: {
  event: AuditEvent | null;
  referenceLabels: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!event) {
    return null;
  }

  const workstation = formatWorkstationLabel({
    clientHostName: event.clientHostName,
    userAgent: event.userAgent,
  });
  const ipAddress = formatAuditIpAddress(event.ipAddress);
  const humanDescription = humanizeAuditDescription(event.description, {
    entityId: event.entityId,
    entityLabel: event.entityLabel,
    referenceLabels,
  });
  const headline =
    humanDescription || formatAuditHeadline(event.action, event.entityType);
  const actorName = formatActorName(event.user);
  const entitySummary = event.entityLabel
    ? `${formatAuditEntityType(event.entityType)} · ${event.entityLabel}`
    : formatAuditEntityType(event.entityType);
  const hasPayload = event.oldValues !== null || event.newValues !== null;
  const changeRows = hasPayload
    ? buildAuditChangeRows(event.oldValues, event.newValues, {
        referenceLabels,
      })
    : [];
  const changed = changeRows.filter((row) => row.changed);
  const summaryRows = changed.length > 0 ? changed : changeRows;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,56rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg">Audit event details</DialogTitle>
          <DialogDescription className="text-sm text-foreground">
            {headline}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Time</dt>
              <dd className="mt-1 text-sm tabular-nums">
                {formatAuditDateTime(event.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Actor</dt>
              <dd className="mt-1 text-sm font-medium">{actorName}</dd>
              {event.user?.email ? (
                <dd className="text-xs text-muted-foreground">
                  {event.user.email}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Action</dt>
              <dd className="mt-1">
                <Badge variant="outline">
                  {formatAuditAction(event.action)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Module</dt>
              <dd className="mt-1 text-sm">
                {formatAuditModule(event.moduleKey)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Entity</dt>
              <dd className="mt-1 text-sm">{entitySummary}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">IP address</dt>
              <dd className="mt-1 font-mono text-sm">{ipAddress ?? "—"}</dd>
            </div>
            {workstation ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-muted-foreground">Workstation</dt>
                <dd className="mt-1 text-sm">{workstation}</dd>
              </div>
            ) : null}
          </dl>

          <section>
            <h3 className="mb-3 text-sm font-semibold tracking-wide uppercase">
              {changed.length > 0
                ? `Changes (${changed.length})`
                : changeRows.length > 0
                  ? "Recorded values"
                  : "Changes"}
            </h3>

            {changeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No field changes recorded for this event.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Field</th>
                      <th className="px-4 py-3 font-medium">Previous</th>
                      <th className="px-4 py-3 font-medium">New</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summaryRows.map((row) => (
                      <tr key={row.field} className="align-top">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {row.label}
                        </td>
                        <td className="px-4 py-3 break-words text-muted-foreground">
                          {row.before}
                        </td>
                        <td className="px-4 py-3 break-words">{row.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {hasPayload ? (
            <details className="rounded-lg border border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                Technical JSON
              </summary>
              <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                    Previous
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">
                    {JSON.stringify(event.oldValues ?? null, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                    New
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">
                    {JSON.stringify(event.newValues ?? null, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          ) : null}
        </div>

        <DialogFooter className="shrink-0" showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function AuditEventsTable({
  events,
  referenceLabels,
}: {
  events: AuditTrailData["events"];
  referenceLabels: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((event) => event.id === selectedId) ?? null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Time</th>
              <th className="px-3 py-3 font-medium">Actor</th>
              <th className="px-3 py-3 font-medium">Action / entity</th>
              <th className="px-3 py-3 font-medium">Description</th>
              <th className="px-3 py-3 font-medium">IP</th>
              <th className="px-3 py-3 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((event) => {
              const ipAddress = formatAuditIpAddress(event.ipAddress);
              const humanDescription = humanizeAuditDescription(
                event.description,
                {
                  entityId: event.entityId,
                  entityLabel: event.entityLabel,
                  referenceLabels,
                },
              );
              const headline =
                humanDescription ||
                formatAuditHeadline(event.action, event.entityType);
              const actorName = formatActorName(event.user);
              const actorTitle = event.user?.email ?? undefined;
              const entitySummary = event.entityLabel
                ? `${formatAuditEntityType(event.entityType)} · ${event.entityLabel}`
                : formatAuditEntityType(event.entityType);
              const hasPayload =
                event.oldValues !== null || event.newValues !== null;
              const hasWorkstation = Boolean(
                formatWorkstationLabel({
                  clientHostName: event.clientHostName,
                  userAgent: event.userAgent,
                }),
              );
              const hasDetails = hasPayload || hasWorkstation;
              const changeCount = hasPayload
                ? buildAuditChangeRows(event.oldValues, event.newValues, {
                    referenceLabels,
                  }).filter((row) => row.changed).length
                : 0;

              return (
                <tr
                  key={event.id}
                  className={
                    hasDetails
                      ? "cursor-pointer hover:bg-muted/30"
                      : "hover:bg-muted/30"
                  }
                  onClick={
                    hasDetails ? () => setSelectedId(event.id) : undefined
                  }
                  onKeyDown={
                    hasDetails
                      ? (keyboardEvent) => {
                          if (
                            keyboardEvent.key === "Enter" ||
                            keyboardEvent.key === " "
                          ) {
                            keyboardEvent.preventDefault();
                            setSelectedId(event.id);
                          }
                        }
                      : undefined
                  }
                  tabIndex={hasDetails ? 0 : undefined}
                  aria-label={
                    hasDetails ? `View details: ${headline}` : undefined
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-muted-foreground">
                    {formatAuditDateTime(event.createdAt)}
                  </td>
                  <td
                    className="max-w-[10rem] truncate px-3 py-2.5 font-medium"
                    title={actorTitle}
                  >
                    {actorName}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Badge variant="outline" className="shrink-0">
                        {formatAuditAction(event.action)}
                      </Badge>
                      <span
                        className="min-w-0 truncate text-xs text-muted-foreground"
                        title={entitySummary}
                      >
                        {entitySummary}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-md truncate px-3 py-2.5" title={headline}>
                    {headline}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {ipAddress ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {hasDetails ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setSelectedId(event.id);
                        }}
                      >
                        {changeCount > 0
                          ? `View (${changeCount})`
                          : "View"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AuditEventDetailModal
        event={selected}
        referenceLabels={referenceLabels}
        open={selected !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedId(null);
          }
        }}
      />
    </>
  );
}
