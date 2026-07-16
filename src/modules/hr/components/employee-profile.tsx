import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  History,
  FileSignature,
  FileText,
  Mail,
  Pencil,
  UserPlus,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  PageActionsEnd,
  PageActionsStart,
} from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { employmentStatusBadgeVariant } from "@/src/config/ui-colors";
import { formatMoney } from "@/src/lib/format";
import type { EmployeeProfileRecord } from "@/src/modules/hr/data/get-employee-form-data";
import type {
  SelfServiceLeaveBalanceSummary,
  SelfServiceSupervisorSummary,
  SelfServiceVacationForfeitureWarning,
} from "@/src/modules/hr/data/get-self-service-profile-extras";
import { PeopleNav } from "./people-nav";

type EmployeeProfileProps = {
  employee: EmployeeProfileRecord;
  /** HR manage actions (edit, assignments, contracts admin). */
  canManage?: boolean;
  /** Employees module sub-nav (directory, structure, leave config). */
  showPeopleNav?: boolean;
  /** Viewing the signed-in user's record. */
  isOwnProfile?: boolean;
  /** Read-only self-service view at `/me` (not the HR employee record). */
  isSelfService?: boolean;
  /** Show leave CTAs when the user can request leave. */
  canRequestLeave?: boolean;
  supervisor?: SelfServiceSupervisorSummary | null;
  leaveBalances?: SelfServiceLeaveBalanceSummary[];
  vacationForfeitureWarning?: SelfServiceVacationForfeitureWarning | null;
};

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() || "Not provided";
}

function Detail({ labelText, value }: { labelText: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{labelText}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium">{value}</p>
    </div>
  );
}

function formatSupervisorValue(
  supervisor: SelfServiceSupervisorSummary | null | undefined,
): string {
  if (!supervisor) {
    return "Not available";
  }

  if (supervisor.employeeName) {
    const acting = supervisor.isActing ? " (acting)" : "";
    const position = supervisor.positionTitle
      ? ` · ${supervisor.positionTitle}`
      : "";
    return `${supervisor.employeeName}${acting}${position}`;
  }

  if (supervisor.positionTitle) {
    return `${supervisor.positionTitle} (vacant)`;
  }

  return "Not assigned";
}

export function EmployeeProfile({
  employee,
  canManage = false,
  showPeopleNav = false,
  isOwnProfile = false,
  isSelfService = false,
  canRequestLeave = false,
  supervisor = null,
  leaveBalances = [],
  vacationForfeitureWarning = null,
}: EmployeeProfileProps) {
  const displayName = `${employee.firstName}${
    employee.middleName ? ` ${employee.middleName}` : ""
  } ${employee.lastName}`;
  const contractsHref = isSelfService
    ? "/me/contracts"
    : `/people/employees/${employee.id}/contracts`;

  return (
    <PageShell>
      {showPeopleNav ? <PeopleNav /> : null}

      <PageHeader
        title={isSelfService ? "My Profile" : displayName}
        description={
          isSelfService
            ? `Your personal and employment details · ${employee.employeeNumber}`
            : isOwnProfile
              ? `Your employee record · ${employee.employeeNumber}`
              : `Employee record · ${employee.employeeNumber}`
        }
        backHref={showPeopleNav ? "/people" : undefined}
        backLabel="Employees"
        actions={
          canManage ? (
            <>
              <PageActionsStart>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link
                      href={`/people/employees/${employee.id}/job-description`}
                    />
                  }
                >
                  <FileText />
                  Job description
                </Button>

                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link href={`/people/employees/${employee.id}/contracts`} />
                  }
                >
                  <CalendarDays />
                  Contracts
                </Button>

                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link
                      href={`/people/employees/${employee.id}/appraisals`}
                    />
                  }
                >
                  <ClipboardCheck />
                  Appraisals
                </Button>

                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link
                      href={`/people/employees/${employee.id}/assignments/new`}
                    />
                  }
                >
                  <UserPlus />
                  Assign to position
                </Button>

                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link
                      href={`/people/employees/${employee.id}/assignments`}
                    />
                  }
                >
                  <History />
                  Assignment history
                </Button>
              </PageActionsStart>

              <PageActionsEnd>
                <Button
                  nativeButton={false}
                  render={
                    <Link href={`/people/employees/${employee.id}/edit`} />
                  }
                >
                  <Pencil />
                  Edit employee
                </Button>
              </PageActionsEnd>
            </>
          ) : isSelfService ? (
            <>
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={contractsHref} />}
              >
                <FileSignature />
                My contracts
              </Button>

              {canRequestLeave ? (
                <>
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={<Link href="/leave" />}
                  >
                    <History />
                    View leave requests
                  </Button>

                  <Button
                    nativeButton={false}
                    render={<Link href="/leave/new" />}
                  >
                    <CalendarDays />
                    Request leave
                  </Button>
                </>
              ) : null}
            </>
          ) : undefined
        }
      />

      <section className="flex flex-wrap items-center gap-2">
        {isSelfService ? (
          <p className="mr-auto text-sm font-medium tracking-tight">
            {employee.preferredName
              ? `${employee.preferredName} ${employee.lastName}`
              : displayName}
          </p>
        ) : null}
        <Badge
          variant={employmentStatusBadgeVariant(employee.employmentStatus)}
        >
          {label(employee.employmentStatus)}
        </Badge>
        <Badge variant="outline">{label(employee.employmentType)}</Badge>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <SectionHeading>Personal information</SectionHeading>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail labelText="Full name" value={displayName} />

          <Detail
            labelText="Preferred name"
            value={displayValue(employee.preferredName)}
          />

          <Detail
            labelText="Personal email"
            value={displayValue(employee.personalEmail)}
          />

          <Detail labelText="Phone" value={displayValue(employee.phone)} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            <SectionHeading>Employment information</SectionHeading>
          </div>

          {canManage ? (
            <Button
              nativeButton={false}
              size="sm"
              render={
                <Link
                  href={`/people/employees/${employee.id}/assignments/new`}
                />
              }
            >
              <UserPlus />
              {employee.position ? "Change position" : "Assign to position"}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail
            labelText="Department"
            value={
              employee.department
                ? `${employee.department.name}${employee.department.code ? ` (${employee.department.code})` : ""}`
                : "Unassigned"
            }
          />

          <Detail
            labelText="Position"
            value={
              employee.position
                ? `${employee.position.title}${employee.position.code ? ` (${employee.position.code})` : ""}`
                : "Unassigned"
            }
          />

          <Detail
            labelText="Reports to"
            value={formatSupervisorValue(supervisor)}
          />

          <Detail
            labelText="Employment type"
            value={label(employee.employmentType)}
          />

          <Detail
            labelText="Employment status"
            value={label(employee.employmentStatus)}
          />

          <Detail labelText="Hire date" value={employee.hireDate} />

          <Detail
            labelText="Termination date"
            value={employee.terminationDate ?? "Not applicable"}
          />
        </div>

        {isSelfService &&
        supervisor?.issueMessage &&
        !supervisor.employeeName ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {supervisor.issueMessage}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <SectionHeading>Contact information</SectionHeading>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail
            labelText="Work email"
            value={displayValue(employee.workEmail)}
          />

          <Detail
            labelText="Personal email"
            value={displayValue(employee.personalEmail)}
          />

          <Detail labelText="Telephone" value={displayValue(employee.phone)} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <SectionHeading>
              {isSelfService ? "My current contract" : "Current contract"}
            </SectionHeading>
          </div>

          {isSelfService || canManage ? (
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href={contractsHref} />}
            >
              <FileSignature />
              {isSelfService ? "View all contracts" : "Contracts"}
            </Button>
          ) : null}
        </div>

        {employee.currentContract ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Detail
              labelText="Contract job title"
              value={employee.currentContract.jobTitle}
            />

            <Detail
              labelText="Salary"
              value={formatMoney(employee.currentContract.baseSalary, {
                currency: employee.currentContract.currency,
              })}
            />

            <Detail
              labelText="Start date"
              value={employee.currentContract.startDate}
            />

            <Detail
              labelText="End date"
              value={employee.currentContract.endDate ?? "No end date"}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No current employment contract is recorded.
          </p>
        )}
      </section>

      {isSelfService ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <SectionHeading>Leave balances</SectionHeading>
            </div>

            {canRequestLeave ? (
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href="/leave" />}
              >
                <History />
                Leave requests
              </Button>
            ) : null}
          </div>

          {vacationForfeitureWarning ? (
            <PageAlert
              className="mb-4"
              severity={
                vacationForfeitureWarning.isUrgent ? "critical" : "warning"
              }
              title="Mandatory vacation cannot roll over"
            >
              <p>{vacationForfeitureWarning.message}</p>
              {canRequestLeave ? (
                <p className="mt-2">
                  <Link
                    href="/leave/new"
                    className="font-medium underline underline-offset-2 hover:text-foreground"
                  >
                    Request vacation leave
                  </Link>{" "}
                  so it finishes on or before {vacationForfeitureWarning.contractEndDateIso}.
                </p>
              ) : null}
            </PageAlert>
          ) : null}

          {leaveBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leave balances are available for your current contract.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {leaveBalances.map((balance) => (
                <div
                  key={`${balance.leaveTypeCode}-${balance.cycleEnd}`}
                  className="min-w-0"
                >
                  <p className="text-sm font-medium">{balance.leaveTypeName}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {balance.leaveTypeCode} · cycle ends {balance.cycleEnd}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="mt-1 text-sm font-medium tabular-nums">
                        {balance.availableBalance}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Reserved</p>
                      <p className="mt-1 text-sm font-medium tabular-nums">
                        {balance.reserved}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Approved</p>
                      <p className="mt-1 text-sm font-medium tabular-nums">
                        {balance.approved}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Taken</p>
                      <p className="mt-1 text-sm font-medium tabular-nums">
                        {balance.taken}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!isSelfService ? (
        <footer className="border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            {employee.contractCount} contract record
            {employee.contractCount === 1 ? "" : "s"}
          </p>
        </footer>
      ) : (
        <footer className="border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            {employee.contractCount} contract record
            {employee.contractCount === 1 ? "" : "s"}
            {canRequestLeave ? (
              <>
                {" "}· Need time off? Submit and track requests on the{" "}
                <Link
                  href="/leave"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Leave
                </Link>
                {" "}
                page.
              </>
            ) : null}
          </p>
        </footer>
      )}
    </PageShell>
  );
}
