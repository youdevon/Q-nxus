import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ListSearchFilters } from "@/src/components/list-search-filters";
import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import { formatDisplayDate } from "@/src/lib/format";
import type {
  AssetRegisterData,
  AssetRegisterRow,
} from "@/src/modules/assets/data/get-assets";
import {
  ASSET_STATUSES,
  ASSET_TYPES,
  labelAssetEnum,
} from "@/src/modules/assets/lib/asset-enums";
import { employeeDisplayName } from "@/src/modules/assets/lib/employee-label";

function warrantyBadge(warrantyEndsOn: string | null): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} | null {
  if (!warrantyEndsOn) return null;
  const end = new Date(`${warrantyEndsOn}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) {
    return { label: "Warranty expired", variant: "destructive" };
  }
  if (days <= 90) {
    return {
      label: days === 0 ? "Ends today" : `${days}d left`,
      variant: "secondary",
    };
  }
  return null;
}

function LocationAssignee({
  name,
  code,
}: {
  name?: string | null;
  code?: string | null;
}) {
  if (!name) {
    return <span className="text-muted-foreground">Office assignment</span>;
  }

  return (
    <span>
      {name}
      {code ? (
        <span className="mt-0.5 block text-xs text-muted-foreground">{code}</span>
      ) : null}
    </span>
  );
}

function AssigneeCell({ row }: { row: AssetRegisterRow }): ReactNode {
  const open = row.openAssignment;
  const employee = open?.employee ?? (open ? null : row.assignedEmployee);
  const location =
    open?.location ??
    (!employee && (Boolean(open) || row.status === "ASSIGNED")
      ? row.location
      : null);

  if (employee) {
    return (
      <Link
        href={`/people/employees/${employee.id}/assets`}
        className="underline-offset-2 hover:underline"
      >
        {employeeDisplayName(employee)}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          #{employee.employeeNumber}
        </span>
      </Link>
    );
  }

  if (open && !employee) {
    return (
      <LocationAssignee name={location?.name} code={location?.code} />
    );
  }

  if (row.status === "ASSIGNED" && location) {
    return <LocationAssignee name={location.name} code={location.code} />;
  }

  return <span className="text-muted-foreground">Unassigned</span>;
}

export function AssetRegisterDirectory({
  data,
  filters,
  basePath = "/assets",
  exportHref,
  showFilters = true,
}: {
  data: AssetRegisterData;
  filters: {
    query?: string;
    status?: string;
    assetType?: string;
    warranty?: string;
    page?: string;
  };
  basePath?: string;
  exportHref?: string;
  showFilters?: boolean;
}) {
  const filterValues = {
    query: filters.query ?? "",
    status: filters.status ?? "",
    assetType: filters.assetType ?? "",
    warranty: filters.warranty ?? "",
  };

  const chips = [
    filters.status
      ? {
          key: "status",
          value: filters.status,
          label: `Status: ${labelAssetEnum(filters.status)}`,
        }
      : null,
    filters.assetType
      ? {
          key: "assetType",
          value: filters.assetType,
          label: `Type: ${labelAssetEnum(filters.assetType)}`,
        }
      : null,
    filters.warranty
      ? {
          key: "warranty",
          value: filters.warranty,
          label:
            filters.warranty === "expired"
              ? "Warranty: expired"
              : `Warranty: within ${filters.warranty} days`,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; value?: string; label: string }>;

  const prevHref =
    data.page > 1
      ? buildListFilterUrl(basePath, filterValues, { page: data.page - 1 })
      : null;
  const nextHref =
    data.page < data.totalPages
      ? buildListFilterUrl(basePath, filterValues, { page: data.page + 1 })
      : null;

  return (
    <div className="flex flex-col gap-6">
      {showFilters ? (
        <ListSearchFilters
          basePath={basePath}
          clearHref={basePath}
          searchPlaceholder="Asset #, serial, device name, brand, assignee…"
          searchValue={filters.query ?? ""}
          values={filterValues}
          chips={chips}
          fields={[
            {
              type: "checkbox",
              name: "status",
              label: "Status",
              multi: false,
              options: ASSET_STATUSES.map((value) => ({
                value,
                label: labelAssetEnum(value),
              })),
            },
            {
              type: "checkbox",
              name: "assetType",
              label: "Type",
              multi: false,
              options: ASSET_TYPES.map((value) => ({
                value,
                label: labelAssetEnum(value),
              })),
            },
            {
              type: "checkbox",
              name: "warranty",
              label: "Warranty",
              multi: false,
              options: [
                { value: "30", label: "Ends within 30 days" },
                { value: "60", label: "Ends within 60 days" },
                { value: "90", label: "Ends within 90 days" },
                { value: "expired", label: "Already expired" },
              ],
            },
          ]}
        />
      ) : null}

      {exportHref ? (
        <div className="flex justify-end">
          <ButtonLink href={exportHref}>Export Excel</ButtonLink>
        </div>
      ) : null}

      {data.rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No assets match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-2 py-2 font-medium">Device</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Serial / service tag</th>
                <th className="px-2 py-2 font-medium">Assignee</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Warranty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.rows.map((row) => {
                const warranty = warrantyBadge(row.warrantyEndsOn);
                const modelLabel =
                  [row.manufacturer, row.modelName].filter(Boolean).join(" ") ||
                  "—";
                return (
                  <tr key={row.id} className="hover:bg-muted/20">
                    <td className="px-2 py-3">
                      {row.computerName ? (
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {row.computerName}
                        </p>
                      ) : null}
                      <Link
                        href={`/assets/${row.id}`}
                        className="mt-0.5 block font-semibold underline-offset-2 hover:underline"
                      >
                        {modelLabel}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.assetNumber}
                        {row.childCount > 0
                          ? ` · +${row.childCount} paired`
                          : ""}
                        {row.parentAsset
                          ? ` · under ${row.parentAsset.assetNumber}`
                          : ""}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      {labelAssetEnum(row.assetType)}
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">
                      {row.serialNumber ?? "—"}
                    </td>
                    <td className="px-2 py-3">
                      <AssigneeCell row={row} />
                    </td>
                    <td className="px-2 py-3">
                      <Badge variant="outline">
                        {labelAssetEnum(row.status)}
                      </Badge>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-col gap-1">
                        <span>
                          {row.warrantyEndsOn
                            ? formatDisplayDate(row.warrantyEndsOn)
                            : "—"}
                        </span>
                        {warranty ? (
                          <Badge variant={warranty.variant}>
                            {warranty.label}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              {data.totalCount} asset{data.totalCount === 1 ? "" : "s"}
              {data.totalPages > 1
                ? ` · Page ${data.page} of ${data.totalPages}`
                : ""}
            </p>
            {data.totalPages > 1 ? (
              <div className="flex gap-2">
                {prevHref ? (
                  <ButtonLink href={prevHref}>Previous</ButtonLink>
                ) : null}
                {nextHref ? (
                  <ButtonLink href={nextHref}>Next</ButtonLink>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ButtonLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted/40"
    >
      {children}
    </Link>
  );
}
