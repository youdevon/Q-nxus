import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { correspondenceStatusBadgeVariant } from "@/src/config/ui-colors";
import type { CorrespondenceListItem } from "@/src/modules/hr/data/get-employee-correspondence";
import { formatDisplayDate } from "@/src/lib/format";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  return formatDisplayDate(value);
}

type CorrespondenceListProps = {
  items: CorrespondenceListItem[];
  itemHref: (id: string) => string;
  emptyMessage: string;
  showConfidentialBadge?: boolean;
};

export function CorrespondenceList({
  items,
  itemHref,
  emptyMessage,
  showConfidentialBadge = false,
}: CorrespondenceListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <FolderOpen className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/70">
      {items.map((item) => (
        <Link
          key={item.id}
          href={itemHref(item.id)}
          className="grid gap-4 py-5 hover:bg-muted/20 md:grid-cols-[1fr_10rem_10rem_8rem]"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.title}</p>
              <Badge variant={correspondenceStatusBadgeVariant(item.status)}>
                {label(item.status)}
              </Badge>
              {item.canAcknowledge ? (
                <Badge variant="warning">Needs acknowledgement</Badge>
              ) : null}
              {item.isAckOverdue ? (
                <Badge variant="destructive">Overdue</Badge>
              ) : null}
              {showConfidentialBadge && !item.employeeVisible ? (
                <Badge variant="outline">HR confidential</Badge>
              ) : null}
              {showConfidentialBadge && item.managerVisible ? (
                <Badge variant="outline">Manager visible</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {label(item.category)}
              {item.subType ? ` · ${item.subType}` : ""}
              {item.attachmentCount > 0
                ? ` · ${item.attachmentCount} attachment${item.attachmentCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Effective</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(item.effectiveDate)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Issued</p>
            <p className="mt-1 text-sm font-medium">
              {item.issueDate ? formatDate(item.issueDate) : "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">By</p>
            <p className="mt-1 text-sm font-medium">
              {item.issuedByName ?? "—"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
