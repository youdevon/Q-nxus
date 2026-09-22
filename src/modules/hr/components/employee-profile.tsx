import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarDays,
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
import { cn } from "@/lib/utils";
import { employmentStatusBadgeVariant } from "@/src/config/ui-colors";
import { ageFromDateOfBirth } from "@/src/lib/age";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import type { EmployeeProfileRecord } from "@/src/modules/hr/data/get-employee-form-data";
import type {
  SelfServiceLeaveBalanceSummary,
  SelfServiceSupervisorSummary,
  SelfServiceVacationForfeitureWarning,
} from "@/src/modules/hr/data/get-self-service-profile-extras";
import { EmployeeEntityNav } from "./employee-entity-nav";
import { MePageHeader } from "./me-page-header";
import { PeoplePageHeader } from "./people-page-header";
import {
  EmployeeFileCompletenessBar,
  EmployeeFileCompletenessWarning,
} from "./employee-file-completeness";
import {
  employeeLeadershipAccentClass,
  employeeLeadershipBadgeClass,
  employeeHeaderBadgeLabel,
  resolveEmployeeLeadershipRole,
} from "@/src/modules/hr/lib/employee-leadership-role";
import {
  isFullEmployee,
  requiresEmployeeFile,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/lib/workforce-category";

type FileCompletenessSummary = {
  completeCount: number;
  totalCount: number;
  percentComplete: number;
  isComplete: boolean;
  missingLabels?: string[];
};

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
  fileCompleteness?: FileCompletenessSummary | null;
  /** When true, skip PageShell + header (used under `/me` layout). */
  embedded?: boolean;
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

function CurrentContractSection({
  contract,
  heading,
  contractsHref,
  showContractsButton,
  contractsButtonLabel,
}: {
  contract: NonNullable<EmployeeProfileRecord["currentContract"]> | null;
  heading: string;
  contractsHref: string;
  showContractsButton: boolean;
  contractsButtonLabel: string;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <SectionHeading>{heading}</SectionHeading>
        </div>

        {showContractsButton ? (
          <Button
            nativeButton={false}
            size="sm"
            variant="outline"
            render={<Link href={contractsHref} />}
          >
            <FileSignature />
            {contractsButtonLabel}
          </Button>
        ) : null}
      </div>

      {!contract ? (
        <p className="text-sm text-muted-foreground">
          No current employment contract is recorded.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Detail
            labelText="Start date"
            value={formatDisplayDate(contract.startDate)}
          />
          <Detail
            labelText="End date"
            value={
              contract.endDate
                ? formatDisplayDate(contract.endDate)
                : "No end date"
            }
          />
          <Detail
            labelText="Base salary"
            value={formatMoney(contract.baseSalary, {
              currency: contract.currency,
            })}
          />
          {contract.allowances.length === 0 ? (
            <Detail labelText="Allowances" value="None" />
          ) : (
            contract.allowances.map((allowance) => (
              <Detail
                key={allowance.id}
                labelText={`${allowance.categoryName} (${label(allowance.frequency)}${
                  allowance.isTaxable ? ", taxable" : ""
                })`}
                value={formatMoney(allowance.amount, {
                  currency: contract.currency,
                })}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
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
  embedded = false,
}: EmployeeProfileProps) {
  const displayName = `${employee.firstName}${
    employee.middleName ? ` ${employee.middleName}` : ""
  } ${employee.lastName}`;
  const fullEmployee = isFullEmployee(employee.workforceCategory);
  const boardMember = employee.workforceCategory === "BOARD";
  const showEmployeeFile = requiresEmployeeFile(employee.workforceCategory);
  const categoryBadge = workforceCategoryBadgeLabel(employee.workforceCategory);
  const leadershipRole = resolveEmployeeLeadershipRole({
    positionTitle: employee.position?.title ?? null,
    reportsToPositionId: employee.position?.reportsToPositionId ?? null,
    directReportCount: employee.position?.directReportCount ?? 0,
  });
  const leadershipBadge = (
    <Badge
      variant="outline"
      className={cn(employeeLeadershipBadgeClass(leadershipRole))}
    >
      {employeeHeaderBadgeLabel(
        leadershipRole,
        employee.position?.title ?? employee.currentContract?.positionTitle,
      )}
    </Badge>
  );
  const skipChrome = embedded || isSelfService;
  const contractsHref = isSelfService
    ? "/me/contracts"
    : `/people/employees/${employee.id}/contracts`;
  const documentsHref = isSelfService
    ? "/me/documents"
    : `/people/employees/${employee.id}/documents`;
  /** Entity tabs already cover these destinations — avoid duplicate body CTAs. */
  const showSectionNavButtons = !isSelfService && !showPeopleNav;

  const headerTitle = displayName;
  const headerDescription = boardMember
    ? "Board payee record"
    : isOwnProfile
      ? `Your record · ${employee.employeeNumber}`
      : `Workforce record · ${employee.employeeNumber}`;
  const headerBadge = boardMember ? (
    <Badge variant="secondary">Board member</Badge>
  ) : (
    leadershipBadge
  );
  const headerActions = canManage ? (
    <PageActionsEnd>
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
  ) : undefined;

  const body = (
    <>
      {!skipChrome && showPeopleNav ? (
        <PeoplePageHeader
          title={headerTitle}
          description={headerDescription}
          backHref="/people"
          backLabel="People"
          actions={headerActions}
          badge={headerBadge}
          titleAccentClassName={employeeLeadershipAccentClass(leadershipRole)}
        />
      ) : null}
      {!skipChrome && !showPeopleNav ? (
        <PageHeader
          title={headerTitle}
          description={headerDescription}
          backHref="/people"
          backLabel="People"
          icon={Users}
          actions={headerActions}
          badge={headerBadge}
          titleAccentClassName={employeeLeadershipAccentClass(leadershipRole)}
        />
      ) : null}

      {!isSelfService && showPeopleNav ? (
        <EmployeeEntityNav
          employeeId={employee.id}
          current="profile"
          workforceCategory={employee.workforceCategory}
          isFullEmployee={fullEmployee}
        />
      ) : null}

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
      {!isSelfService ? (
        <section className="flex flex-wrap items-center gap-2">
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
      ) : null}

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

          {canManage && fullEmployee && showSectionNavButtons ? (
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

      {!isSelfService && showEmployeeFile ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="size-4 text-muted-foreground" />
              <SectionHeading>Employee file</SectionHeading>
            </div>

            {canManage && showSectionNavButtons ? (
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href={documentsHref} />}
              >
                <FolderOpen />
                Open employee file
              </Button>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            Recommendations, discipline, instructions, commendations, and other
            HR correspondence.
          </p>
        </section>
      ) : null}

      <CurrentContractSection
        contract={employee.currentContract}
        heading={isSelfService ? "My current contract" : "Current contract"}
        contractsHref={contractsHref}
        showContractsButton={
          (isSelfService || canManage) && showSectionNavButtons
        }
        contractsButtonLabel={
          isSelfService ? "View all contracts" : "Contracts"
        }
      />

      {!isSelfService ? (
        <footer className="border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            {employee.contractCount} contract record
            {employee.contractCount === 1 ? "" : "s"}
          </p>
        </footer>
      ) : null}
    </>
  );

  if (skipChrome) {
    return body;
  }

  return (
    <PageShell size={showPeopleNav ? "lg" : "md"}>{body}</PageShell>
  );
}
