import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  History,
  FileSignature,
  FileText,
  KeyRound,
  Mail,
  Pencil,
  ScrollText,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { employmentStatusBadgeVariant } from "@/src/config/ui-colors";
import { ageFromDateOfBirth } from "@/src/lib/age";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import type { EmployeeProfileRecord } from "@/src/modules/hr/data/get-employee-form-data";
import type {
  SelfServiceLeaveBalanceSummary,
  SelfServiceSupervisorSummary,
  SelfServiceVacationForfeitureWarning,
} from "@/src/modules/hr/data/get-self-service-profile-extras";
import { MePageHeader } from "./me-page-header";
import { PeoplePageHeader } from "./people-page-header";
import {
  EmployeeFileCompletenessBar,
  EmployeeFileCompletenessWarning,
} from "./employee-file-completeness";
import {
  isFullEmployee,
  requiresEmployeeFile,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/lib/workforce-category";

type EmployeeProfileProps = {
  employee: EmployeeProfileRecord;
  /** HR manage actions (edit, assignments, contracts admin). */
  canManage?: boolean;
  /** Link to Administration → Access for the linked user account. */
  canManageAccess?: boolean;
  /** Employees module sub-nav (directory, structure, leave config). */
  showPeopleNav?: boolean;
  /** Viewing the signed-in user's record. */
  isOwnProfile?: boolean;
  /** Read-only self-service view at `/me` (not the HR employee record). */
  isSelfService?: boolean;
  /** Show leave CTAs when the user can request leave. */
  canRequestLeave?: boolean;
  mostRecentPayslipHref?: string;
  mostRecentPayslipPeriodLabel?: string;
  mostRecentPayslipIsPosted?: boolean;
  payslipHistoryHref?: string;
  payslipHistoryCount?: number;
  supervisor?: SelfServiceSupervisorSummary | null;
  leaveBalances?: SelfServiceLeaveBalanceSummary[];
  vacationForfeitureWarning?: SelfServiceVacationForfeitureWarning | null;
  pendingCorrespondenceCount?: number;
  expiringFileCount?: number;
  /** HR: employee file checklist completeness summary. */
  fileCompleteness?: {
    completeCount: number;
    totalCount: number;
    percentComplete: number;
    isComplete: boolean;
    missingLabels: string[];
  } | null;
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

function displayDateOfBirth(value: string | null | undefined): string {
  const displayedValue = formatDisplayDate(value, {
    fallback: displayValue(value),
  });
  const age = ageFromDateOfBirth(value);

  return age === null ? displayedValue : `${displayedValue} (${age})`;
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
  canManageAccess = false,
  showPeopleNav = false,
  isOwnProfile = false,
  isSelfService = false,
  canRequestLeave = false,
  mostRecentPayslipHref,
  mostRecentPayslipPeriodLabel,
  mostRecentPayslipIsPosted = false,
  payslipHistoryHref,
  payslipHistoryCount = 0,
  supervisor = null,
  leaveBalances = [],
  vacationForfeitureWarning = null,
  pendingCorrespondenceCount = 0,
  expiringFileCount = 0,
  fileCompleteness = null,
}: EmployeeProfileProps) {
  const displayName = `${employee.firstName}${
    employee.middleName ? ` ${employee.middleName}` : ""
  } ${employee.lastName}`;
  const fullEmployee = isFullEmployee(employee.workforceCategory);
  const showEmployeeFile = requiresEmployeeFile(employee.workforceCategory);
  const categoryBadge = workforceCategoryBadgeLabel(employee.workforceCategory);
  const contractsHref = isSelfService
    ? "/me/contracts"
    : `/people/employees/${employee.id}/contracts`;
  const documentsHref = isSelfService
    ? "/me/documents"
    : `/people/employees/${employee.id}/documents`;

  const headerTitle = isSelfService ? "My Profile" : displayName;
  const headerDescription = isSelfService
    ? `Your personal and employment details · ${employee.employeeNumber}`
    : isOwnProfile
      ? `Your record · ${employee.employeeNumber}`
      : `Workforce record · ${employee.employeeNumber}`;
  const headerActions = canManage ? (
            <PageActionsEnd>
                {fullEmployee ? (
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
                ) : null}

                {canManageAccess && employee.userId ? (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={
                      <Link
                        href={`/administration/access/users/${employee.userId}#assign-role`}
                      />
                    }
                  >
                    <KeyRound />
                    Manage access
                  </Button>
                ) : null}
              <Button
                nativeButton={false}
                render={<Link href={`/people/employees/${employee.id}/edit`} />}
              >
                <Pencil />
                Edit
              </Button>
            </PageActionsEnd>
          ) : isSelfService ? (
            canRequestLeave && fullEmployee ? (
              <Button
                nativeButton={false}
                render={<Link href="/me/leave/new" />}
              >
                <CalendarDays />
                Request leave
              </Button>
            ) : undefined
          ) : undefined;

  return (
    <PageShell size={showPeopleNav ? "lg" : "md"}>
      {showPeopleNav ? (
        <PeoplePageHeader
          title={headerTitle}
          description={headerDescription}
          backHref={isSelfService ? undefined : "/people"}
          backLabel="People"
          actions={headerActions}
        />
      ) : isSelfService ? (
        <MePageHeader
          title={headerTitle}
          description={headerDescription}
          actions={headerActions}
        />
      ) : (
        <PageHeader
          title={headerTitle}
          description={headerDescription}
          backHref="/people"
          backLabel="People"
          icon={Users}
          actions={headerActions}
        />
      )}

      {isSelfService && showEmployeeFile && pendingCorrespondenceCount > 0 ? (
        <PageAlert severity="warning" title="Letters need acknowledgement">
          You have {pendingCorrespondenceCount} letter
          {pendingCorrespondenceCount === 1 ? "" : "s"} on your file waiting for
          acknowledgement.{" "}
          <Link
            href="/me/documents"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            Review documents
          </Link>
        </PageAlert>
      ) : null}
      {isSelfService && showEmployeeFile && expiringFileCount > 0 ? (
        <PageAlert severity="warning" title="Credentials or training expiring">
          You have {expiringFileCount} credential or training item
          {expiringFileCount === 1 ? "" : "s"} expiring within 30 days.{" "}
          <Link
            href="/me/documents"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            Review documents
          </Link>
        </PageAlert>
      ) : null}
      {canManage &&
      showEmployeeFile &&
      fileCompleteness &&
      !fileCompleteness.isComplete ? (
        <EmployeeFileCompletenessWarning
          completeCount={fileCompleteness.completeCount}
          totalCount={fileCompleteness.totalCount}
          missingLabels={fileCompleteness.missingLabels}
          documentsHref={documentsHref}
        />
      ) : null}
      {canManage && showEmployeeFile && fileCompleteness ? (
        <EmployeeFileCompletenessBar
          completeCount={fileCompleteness.completeCount}
          totalCount={fileCompleteness.totalCount}
          percentComplete={fileCompleteness.percentComplete}
          className="max-w-md"
        />
      ) : null}
      <section className="flex flex-wrap items-center gap-2">
        {isSelfService ? (
          <p className="mr-auto text-sm font-medium tracking-tight">
            {employee.preferredName
              ? `${employee.preferredName} ${employee.lastName}`
              : displayName}
          </p>
        ) : null}
        {categoryBadge ? (
          <Badge variant="secondary">{categoryBadge}</Badge>
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
            labelText="Date of birth"
            value={displayDateOfBirth(employee.dateOfBirth)}
          />

          <Detail
            labelText="Personal email"
            value={displayValue(employee.personalEmail)}
          />

          <Detail labelText="Phone" value={displayValue(employee.phone)} />

          <Detail
            labelText="Address"
            value={displayValue(employee.address)}
          />

          <Detail
            labelText="Emergency contact"
            value={displayValue(employee.emergencyContactName)}
          />

          <Detail
            labelText="Emergency contact phone"
            value={displayValue(employee.emergencyContactPhone)}
          />

          <Detail
            labelText="Emergency contact relationship"
            value={displayValue(employee.emergencyContactRelationship)}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <SectionHeading>Identity &amp; statutory</SectionHeading>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail
            labelText="NIS number"
            value={displayValue(employee.nisNumber)}
          />
          <Detail
            labelText="BIR number"
            value={displayValue(employee.birNumber)}
          />
          <Detail
            labelText="ID type"
            value={
              employee.idType === "NATIONAL_ID"
                ? "National ID"
                : employee.idType === "DRIVERS_PERMIT"
                  ? "Driver's Permit"
                  : employee.idType === "NON_NATIONAL"
                    ? "Non-national ID (passport / foreign ID)"
                    : "—"
            }
          />
          <Detail
            labelText="ID number"
            value={displayValue(employee.idNumber)}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            <SectionHeading>
              {fullEmployee ? "Employment information" : "Engagement"}
            </SectionHeading>
          </div>

          {canManage && fullEmployee ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                size="sm"
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
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {fullEmployee ? (
            <>
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
            </>
          ) : null}

          {categoryBadge ? (
            <Detail labelText="Workforce category" value={categoryBadge} />
          ) : null}

          <Detail
            labelText="Employment type"
            value={label(employee.employmentType)}
          />

          <Detail
            labelText="Status"
            value={label(employee.employmentStatus)}
          />

          <Detail
            labelText={fullEmployee ? "Hire date" : "Engagement start"}
            value={formatDisplayDate(employee.hireDate, {
              fallback: "Not provided",
            })}
          />

          <Detail
            labelText="Termination date"
            value={employee.terminationDate ?? "Not applicable"}
          />
        </div>

        {isSelfService &&
        fullEmployee &&
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

      {showEmployeeFile ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="size-4 text-muted-foreground" />
              <SectionHeading>
                {isSelfService ? "My documents" : "Employee file"}
              </SectionHeading>
            </div>

            {isSelfService || canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                {isSelfService ? (
                  <Button
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    render={<Link href="/me/qualifications" />}
                  >
                    <ScrollText />
                    Qualifications
                  </Button>
                ) : null}
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={<Link href={documentsHref} />}
                >
                  <FolderOpen />
                  {isSelfService
                    ? pendingCorrespondenceCount > 0
                      ? `View documents (${pendingCorrespondenceCount})`
                      : "View documents"
                    : "Open employee file"}
                </Button>
              </div>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            {isSelfService
              ? "Issued letters, notices, qualifications, and other items on your employee file."
              : "Recommendations, discipline, instructions, commendations, and other HR correspondence."}
          </p>
        </section>
      ) : null}

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
              labelText="Salary"
              value={formatMoney(employee.currentContract.baseSalary, {
                currency: employee.currentContract.currency,
              })}
            />

            <Detail
              labelText="Start date"
              value={formatDisplayDate(employee.currentContract.startDate)}
            />

            <Detail
              labelText="End date"
              value={
                employee.currentContract.endDate
                  ? formatDisplayDate(employee.currentContract.endDate)
                  : "No end date"
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No current employment contract is recorded.
          </p>
        )}
      </section>

      {isSelfService && mostRecentPayslipHref ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" />
              <SectionHeading>Payroll</SectionHeading>
            </div>

            <div className="flex flex-wrap gap-2">
              {payslipHistoryHref && payslipHistoryCount > 0 ? (
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={<Link href={payslipHistoryHref} />}
                >
                  <History />
                  Payslip history
                </Button>
              ) : null}
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href={mostRecentPayslipHref} />}
              >
                <FileText />
                View most recent payslip
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium">
              Most recent payslip
              {mostRecentPayslipPeriodLabel
                ? ` · ${mostRecentPayslipPeriodLabel}`
                : ""}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {mostRecentPayslipIsPosted
                ? "Opens your last posted payslip from payroll. Use print to save a copy."
                : "No posted payslip yet — opens a live preview for the previous month. Official history appears after payroll posts a run."}
            </p>
          </div>
        </section>
      ) : null}

      {isSelfService && fullEmployee ? (
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
                render={<Link href="/me/leave" />}
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
                    href="/me/leave/new"
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
            {canRequestLeave && fullEmployee ? (
              <>
                {" "}· Need time off? Submit and track requests on{" "}
                <Link
                  href="/me/leave"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  My leave requests
                </Link>
                .
              </>
            ) : null}
          </p>
        </footer>
      )}
    </PageShell>
  );
}
