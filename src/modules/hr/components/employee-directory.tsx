import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Undo2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListSearchFilters,
  type ActiveFilterChip,
} from "@/src/components/list-search-filters";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { employmentStatusBadgeVariant } from "@/src/config/ui-colors";
import { cn } from "@/lib/utils";
import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import { formatDisplayDate } from "@/src/lib/format";
import type {
  EmployeeDirectoryData,
  EmployeeDirectoryFilters,
} from "@/src/modules/hr/data/get-employees";
import {
  nextEmployeeDirectorySort,
  type EmployeeDirectorySortField,
} from "@/src/modules/hr/lib/employee-directory-sort";
import {
  WORKFORCE_CATEGORY_OPTIONS,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/lib/workforce-category";
import { EmployeeDirectoryLiveSearch } from "./employee-directory-live-search";
import { EmployeeDirectoryRow } from "./employee-directory-row";
import { PeoplePageHeader } from "./people-page-header";

type EmployeeDirectoryProps = {
  data: EmployeeDirectoryData;
  filters: EmployeeDirectoryFilters;
};

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "RETIRED", label: "Retired" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "PART_TIME", label: "Part time" },
  { value: "INTERN", label: "Intern" },
  { value: "CONSULTANT", label: "Consultant" },
] as const;

function buildFilterChips(
  filters: EmployeeDirectoryFilters,
  departments: EmployeeDirectoryData["departments"],
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filters.status) {
    chips.push({
      key: "status",
      value: filters.status,
      label: `Status: ${label(filters.status)}`,
    });
  }

  if (filters.employmentType) {
    chips.push({
      key: "employmentType",
      value: filters.employmentType,
      label: `Type: ${label(filters.employmentType)}`,
    });
  }

  if (filters.workforceCategory) {
    chips.push({
      key: "workforceCategory",
      value: filters.workforceCategory,
      label: `Category: ${label(filters.workforceCategory)}`,
    });
  }

  if (filters.departmentId) {
    const department = departments.find(
      (item) => item.id === filters.departmentId,
    );

    chips.push({
      key: "departmentId",
      value: filters.departmentId,
      label: `Department: ${department?.name ?? filters.departmentId}`,
    });
  }

  return chips;
}

function SortableColumnHeader({
  label: columnLabel,
  field,
  currentSort,
  currentOrder,
  filterValues,
  className,
}: {
  label: string;
  field: EmployeeDirectorySortField;
  currentSort: EmployeeDirectorySortField;
  currentOrder: "asc" | "desc";
  filterValues: Record<string, string | undefined>;
  className?: string;
}) {
  const isActive = currentSort === field;
  const next = nextEmployeeDirectorySort(
    { sort: currentSort, order: currentOrder },
    field,
  );
  const href = buildListFilterUrl("/people", {
    ...filterValues,
    sort: next.sort,
    order: next.order,
  });
  const ariaSort = isActive
    ? currentOrder === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th className={cn("px-3 py-3 font-medium", className)} aria-sort={ariaSort}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{columnLabel}</span>
        {isActive ? (
          currentOrder === "asc" ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
        )}
        <span className="sr-only">
          {isActive
            ? `Sorted ${currentOrder === "asc" ? "ascending" : "descending"}. Activate to sort ${currentOrder === "asc" ? "descending" : "ascending"}.`
            : `Sort by ${columnLabel}`}
        </span>
      </Link>
    </th>
  );
}

export function EmployeeDirectory({ data, filters }: EmployeeDirectoryProps) {
  const hasExplicitSort = Boolean(filters.sort || filters.order);
  const hasBrowseFilters = Boolean(
    filters.status ||
      filters.employmentType ||
      filters.workforceCategory ||
      filters.departmentId ||
      filters.show === "all",
  );
  const filterValues = {
    query: filters.query,
    status: filters.status,
    employmentType: filters.employmentType,
    workforceCategory: filters.workforceCategory,
    departmentId: filters.departmentId,
    show: filters.show === "all" ? "all" : undefined,
    sort: hasExplicitSort ? data.sort : undefined,
    order: hasExplicitSort ? data.order : undefined,
  };

  const showAllHref = buildListFilterUrl("/people", {
    status: filters.status,
    employmentType: filters.employmentType,
    workforceCategory: filters.workforceCategory,
    departmentId: filters.departmentId,
    show: "all",
    sort: filterValues.sort,
    order: filterValues.order,
  });

  // Name search uses a client typeahead (partial match as you type).
  // Structured filters / Show all keep the server-rendered directory table.
  const useLiveNameSearch = !hasBrowseFilters;

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="People"
        description="Search the workforce directory, including employees and non-employee payees."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/people/employees/new" />}
          >
            <Plus />
            New person
          </Button>
        }
      />

      {useLiveNameSearch ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {data.summary.active} active
              {data.summary.active === 1 ? " person" : " people"}
            </p>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={showAllHref} />}
            >
              <Users />
              Show all / filters
            </Button>
          </div>

          <EmployeeDirectoryLiveSearch
            initialQuery={filters.query ?? ""}
            showAllHref={showAllHref}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <ListSearchFilters
              basePath="/people"
              clearHref="/people"
              searchPlaceholder="Name, number or email"
              searchValue={filters.query ?? ""}
              values={filterValues}
              chips={buildFilterChips(filters, data.departments)}
              fields={[
                {
                  type: "checkbox",
                  name: "status",
                  label: "Status",
                  options: [...STATUS_OPTIONS],
                  multi: false,
                },
                {
                  type: "checkbox",
                  name: "workforceCategory",
                  label: "Category",
                  options: WORKFORCE_CATEGORY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                  multi: false,
                },
                {
                  type: "checkbox",
                  name: "employmentType",
                  label: "Employment type",
                  options: [...EMPLOYMENT_TYPE_OPTIONS],
                  multi: false,
                },
                {
                  type: "checkbox",
                  name: "departmentId",
                  label: "Department",
                  options: data.departments.map((department) => ({
                    value: department.id,
                    label: department.name,
                  })),
                  multi: false,
                },
              ]}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {data.summary.active} active
                {data.summary.active === 1 ? " person" : " people"}
              </p>

              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                render={<Link href="/people" />}
              >
                <Undo2 />
                Back to live search
              </Button>
            </div>
          </div>

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <SectionHeading>Directory</SectionHeading>
              </div>

              <span className="text-xs text-muted-foreground">
                {data.total} matching record
                {data.total === 1 ? "" : "s"}
              </span>
            </div>

            {data.employees.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No people found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adjust the search or filters, or go back to live search.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm md:min-w-[900px]">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <SortableColumnHeader
                        label="Name"
                        field="name"
                        currentSort={data.sort}
                        currentOrder={data.order}
                        filterValues={filterValues}
                      />
                      <SortableColumnHeader
                        label="Number"
                        field="number"
                        currentSort={data.sort}
                        currentOrder={data.order}
                        filterValues={filterValues}
                        className="hidden sm:table-cell"
                      />
                      <SortableColumnHeader
                        label="Department"
                        field="department"
                        currentSort={data.sort}
                        currentOrder={data.order}
                        filterValues={filterValues}
                      />
                      <SortableColumnHeader
                        label="Position"
                        field="position"
                        currentSort={data.sort}
                        currentOrder={data.order}
                        filterValues={filterValues}
                        className="hidden md:table-cell"
                      />
                      <SortableColumnHeader
                        label="Type"
                        field="type"
                        currentSort={data.sort}
                        currentOrder={data.order}
                        filterValues={filterValues}
                        className="hidden lg:table-cell"
                      />
                      <SortableColumnHeader
                        label="Status"
                        field="status"
                        currentSort={data.sort}
                        currentOrder={data.order}
                        filterValues={filterValues}
                      />
                      <SortableColumnHeader
                        label="Hire date"
                        field="hireDate"
                        currentSort={data.sort}
                        currentOrder={data.order}
                        filterValues={filterValues}
                        className="hidden lg:table-cell"
                      />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {data.employees.map((employee) => {
                      const displayName = [
                        employee.preferredName ?? employee.firstName,
                        employee.lastName,
                      ].join(" ");
                      const href = `/people/employees/${employee.id}`;
                      const categoryBadge = workforceCategoryBadgeLabel(
                        employee.workforceCategory,
                      );

                      return (
                        <EmployeeDirectoryRow
                          key={employee.id}
                          href={href}
                          label={`View ${displayName}`}
                        >
                          <td className="px-3 py-4">
                            <span className="font-medium group-hover:underline">
                              {displayName}
                            </span>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {categoryBadge ? (
                                <Badge variant="secondary">
                                  {categoryBadge}
                                </Badge>
                              ) : null}
                              <p className="text-xs text-muted-foreground">
                                {employee.workEmail ?? "No work email"}
                              </p>
                            </div>
                          </td>

                          <td className="hidden px-3 py-4 font-mono text-xs sm:table-cell">
                            {employee.employeeNumber}
                          </td>

                          <td className="px-3 py-4">
                            {employee.department?.name ?? "Unassigned"}
                          </td>

                          <td className="hidden px-3 py-4 md:table-cell">
                            {employee.position?.title ?? "Unassigned"}
                          </td>

                          <td className="hidden px-3 py-4 lg:table-cell">
                            {label(employee.employmentType)}
                          </td>

                          <td className="px-3 py-4">
                            <Badge
                              variant={employmentStatusBadgeVariant(
                                employee.employmentStatus,
                              )}
                            >
                              {label(employee.employmentStatus)}
                            </Badge>
                          </td>

                          <td className="hidden px-3 py-4 lg:table-cell">
                            {formatDisplayDate(employee.hireDate)}
                          </td>
                        </EmployeeDirectoryRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="mt-5 flex items-center justify-between border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">
              Page {data.page} of {data.totalPages}
            </p>

            <div className="flex gap-2">
              <Button
                nativeButton={false}
                variant="outline"
                disabled={data.page <= 1}
                render={
                  data.page > 1 ? (
                    <Link
                      href={buildListFilterUrl("/people", filterValues, {
                        page: data.page - 1,
                      })}
                    />
                  ) : (
                    <span />
                  )
                }
              >
                <ChevronLeft />
                Previous
              </Button>

              <Button
                nativeButton={false}
                variant="outline"
                disabled={data.page >= data.totalPages}
                render={
                  data.page < data.totalPages ? (
                    <Link
                      href={buildListFilterUrl("/people", filterValues, {
                        page: data.page + 1,
                      })}
                    />
                  ) : (
                    <span />
                  )
                }
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </footer>
        </>
      )}
    </PageShell>
  );
}
