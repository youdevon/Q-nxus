"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/src/lib/format";
import { AssetAssignmentDatesForm } from "@/src/modules/assets/components/asset-assign-return-forms";
import type { AssetDetail } from "@/src/modules/assets/data/get-assets";
import { labelAssetEnum } from "@/src/modules/assets/lib/asset-enums";
import { employeeDisplayName } from "@/src/modules/assets/lib/employee-label";

type Assignment = AssetDetail["assignments"][number];

/** Inclusive calendar days held; open assignments use today. */
function custodyDays(outDate: string, backDate: string | null): number | null {
  const start = new Date(`${outDate}T00:00:00`);
  const end = backDate
    ? new Date(`${backDate}T00:00:00`)
    : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * One client island for the full custody timeline (avoids N date-editor forms).
 */
export function AssetMovementHistory({
  assetId,
  assignments,
  canManage,
}: {
  assetId: string;
  assignments: Assignment[];
  canManage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold tracking-wide uppercase">
        Movement history
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Full custody timeline — every time this asset went out and came back.
      </p>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No movements recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {assignments.map((assignment) => {
            const outDate = assignment.assignedAt.slice(0, 10);
            const backDate = assignment.returnedAt?.slice(0, 10) ?? null;
            const daysHeld = custodyDays(outDate, backDate);
            const isEditing = editingId === assignment.id;

            return (
              <li key={assignment.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {assignment.employee ? (
                    <Link
                      href={`/people/employees/${assignment.employee.id}/assets`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {employeeDisplayName(assignment.employee)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        #{assignment.employee.employeeNumber}
                      </span>
                    </Link>
                  ) : assignment.location ? (
                    <span className="font-medium">
                      Office · {assignment.location.name}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {assignment.location.code}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium text-muted-foreground">
                      Unknown custodian
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {!backDate ? (
                      <Badge variant="secondary">Out now</Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {labelAssetEnum(assignment.assignmentType)}
                    </span>
                  </div>
                </div>
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-foreground">Out: </span>
                    {formatDisplayDate(outDate)}
                    {assignment.conditionAtIssue
                      ? ` · ${labelAssetEnum(assignment.conditionAtIssue)}`
                      : ""}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Back: </span>
                    {backDate
                      ? `${formatDisplayDate(backDate)}${
                          assignment.conditionAtReturn
                            ? ` · ${labelAssetEnum(assignment.conditionAtReturn)}`
                            : ""
                        }`
                      : assignment.location
                        ? "Still at location"
                        : "Still with employee"}
                  </div>
                  {daysHeld != null ? (
                    <div className="sm:col-span-2">
                      Held {daysHeld} day{daysHeld === 1 ? "" : "s"}
                    </div>
                  ) : null}
                </dl>
                {assignment.notes ? (
                  <p className="mt-1 text-xs">{assignment.notes}</p>
                ) : null}
                {canManage ? (
                  isEditing ? (
                    <div className="mt-2">
                      <AssetAssignmentDatesForm
                        assetId={assetId}
                        assignmentId={assignment.id}
                        assignedAt={outDate}
                        returnedAt={backDate}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setEditingId(assignment.id)}
                    >
                      Correct dates
                    </Button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
