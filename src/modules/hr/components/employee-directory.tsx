import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Undo2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListSearchFilters,
  type ActiveFilterChip,
} from "@/src/components/list-search-filters";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { employmentStatusBadgeVariant } from "@/src/config/ui-colors";
import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import type {
  EmployeeDirectoryData,
  EmployeeDirectoryFilters,
} from "@/src/modules/hr/data/get-employees";
import { EmployeeDirectoryRow } from "./employee-directory-row";
import { PeopleNav } from "./people-nav";

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

export function EmployeeDirectory({ data, filters }: EmployeeDirectoryProps) {
  const filterValues = {
    query: filters.query,
    status: filters.status,
    employmentType: filters.employmentType,
    departmentId: filters.departmentId,
    show: filters.show === "all" ? "all" : undefined,
  };

  const showAllHref = buildListFilterUrl("/people", {
    status: filters.status,
    employmentType: filters.employmentType,
    departmentId: filters.departmentId,
    show: "all",
  });

  return (
    <PageShell size="lg">
      <PeopleNav />

      <PageHeader
        title="Employees"
        description="Search for an employee, or show the full directory."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/people/employees/new" />}
          >
            <Plus />
            New employee
          </Button>
        }
      />

      <div className="space-y-3">
        <ListSearchFilters
          basePath="/people"
          clearHref="/people"
          searchPlaceholder="Name, employee number or email"
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
            {data.summary.active} active employee
            {data.summary.active === 1 ? "" : "s"}
          </p>

          {filters.show === "all" ? (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/people" />}
            >
              <Undo2 />
              Back to search
            </Button>
          ) : null}
        </div>
      </div>

      {!data.listing ? (
        <section className="py-14 text-center">
          <Search className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Find an employee</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Search by name, employee number or email. Use Show all when you need
            the full directory.
          </p>
          <div className="mt-5">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={showAllHref} />}
            >
              <Users />
              Show all
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <SectionHeading>Employee directory</SectionHeading>
              </div>

              <span className="text-xs text-muted-foreground">
                {data.total} matching record
                {data.total === 1 ? "" : "s"}
              </span>
            </div>

            {data.employees.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No employees found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adjust the search or filters, or show the full directory.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm md:min-w-[900px]">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-medium">Employee</th>
                      <th className="hidden px-3 py-3 font-medium sm:table-cell">
                        Number
                      </th>
                      <th className="px-3 py-3 font-medium">Department</th>
                      <th className="hidden px-3 py-3 font-medium md:table-cell">
                        Position
                      </th>
                      <th className="hidden px-3 py-3 font-medium lg:table-cell">
                        Type
                      </th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="hidden px-3 py-3 font-medium lg:table-cell">
                        Hire date
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {data.employees.map((employee) => {
                      const displayName = [
                        employee.preferredName ?? employee.firstName,
                        employee.lastName,
                      ].join(" ");
                      const href = `/people/employees/${employee.id}`;

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
                            <p className="mt-1 text-xs text-muted-foreground">
                              {employee.workEmail ?? "No work email"}
                            </p>
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
                            {employee.hireDate.slice(0, 10)}
                          </td>
                        </EmployeeDirectoryRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="flex items-center justify-between border-t border-border pt-5">
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
