import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import {
  RemindAllMissingFileButton,
  RemindMissingFileButton,
} from "@/src/modules/hr/components/missing-file-remind-buttons";
import { getOrgEmployeeFileCompleteness } from "@/src/modules/hr/data/get-org-employee-file-completeness";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import {
  EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES,
  checklistItemLabel,
  type EmployeeFileChecklistItemType,
} from "@/src/modules/hr/lib/employee-file-checklist";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Missing documents",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  itemType?: string;
  departmentId?: string;
}>;

function isChecklistItemType(
  value: string,
): value is EmployeeFileChecklistItemType {
  return (EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES as readonly string[]).includes(
    value,
  );
}

export default async function MissingDocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await requirePeopleManageAccess();
  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: capabilities.userId },
    select: { organizationId: true },
  });

  if (!user) {
    return null;
  }

  const itemType =
    params.itemType && isChecklistItemType(params.itemType)
      ? params.itemType
      : null;
  const departmentId = params.departmentId?.trim() || null;

  const [rows, departments] = await Promise.all([
    getOrgEmployeeFileCompleteness({
      organizationId: user.organizationId,
      departmentId,
      itemType,
      incompleteOnly: true,
    }),
    prisma.department.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Missing documents"
        description="Employees with incomplete employee-file checklist items"
        backHref="/people/documents"
        backLabel="Documents"
        actions={
          <PageActionsEnd>
            <RemindAllMissingFileButton
              departmentId={departmentId ?? undefined}
              itemType={itemType ?? undefined}
              disabled={rows.length === 0}
            />
          </PageActionsEnd>
        }
      />

      <form className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="itemType">
            Checklist item
          </label>
          <select
            id="itemType"
            name="itemType"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            defaultValue={itemType ?? ""}
          >
            <option value="">Any missing item</option>
            {EMPLOYEE_FILE_CHECKLIST_ITEM_TYPES.map((value) => (
              <option key={value} value={value}>
                {checklistItemLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="departmentId">
            Department
          </label>
          <select
            id="departmentId"
            name="departmentId"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            defaultValue={departmentId ?? ""}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit">Filter</Button>
        </div>
      </form>

      <section>
        <p className="mb-4 text-sm text-muted-foreground">
          {rows.length} employee{rows.length === 1 ? "" : "s"} with missing file
          items
        </p>

        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No incomplete employee files match these filters.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {rows.map((row) => (
              <article
                key={row.employeeId}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/people/employees/${row.employeeId}/documents`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.displayName}
                    </Link>
                    <Badge variant="outline">{row.employeeNumber}</Badge>
                    <Badge variant="warning">
                      {row.completeness.completeCount}/
                      {row.completeness.totalCount}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.departmentName ?? "No department"}
                  </p>
                  <p className="text-sm">
                    Missing: {row.completeness.missingLabels.join(", ")}
                  </p>
                </div>
                <RemindMissingFileButton
                  employeeId={row.employeeId}
                  departmentId={departmentId ?? undefined}
                  itemType={itemType ?? undefined}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
