import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EmployeeProfile } from "@/src/modules/hr/components/employee-profile";
import { getEmployeeProfile } from "@/src/modules/hr/data/get-employee-form-data";
import { countPendingCorrespondenceAcknowledgements } from "@/src/modules/hr/data/get-employee-correspondence";
import { countExpiringEmployeeFileItems } from "@/src/modules/hr/data/get-employee-file-extras";
import { getSelfServiceProfileExtras } from "@/src/modules/hr/data/get-self-service-profile-extras";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { getMostRecentPostedPayslip } from "@/src/modules/payroll/data/get-pay-runs";
import {
  formatPayslipPeriodLabel,
  resolveDefaultLivePayslipPeriod,
} from "@/src/modules/payroll/lib/payslip-preview";

export const metadata: Metadata = {
  title: "My Profile",
};

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.can("people.profile.view_own")) {
    redirect("/");
  }

  if (!capabilities.employeeId) {
    redirect("/");
  }

  const [employee, extras, postedPayslip, pendingCorrespondenceCount, expiringFileCount] =
    await Promise.all([
      getEmployeeProfile(capabilities.employeeId),
      getSelfServiceProfileExtras(capabilities.employeeId),
      getMostRecentPostedPayslip(capabilities.employeeId),
      countPendingCorrespondenceAcknowledgements(capabilities.employeeId),
      countExpiringEmployeeFileItems(capabilities.employeeId),
    ]);

  if (!employee) {
    notFound();
  }

  const coverageStartCandidates = [
    employee.hireDate,
    employee.currentContract?.startDate,
  ].filter((value): value is string => Boolean(value));
  const coverageStartDate =
    coverageStartCandidates.sort((a, b) => b.localeCompare(a))[0] ?? null;
  const previewPeriod = resolveDefaultLivePayslipPeriod({
    coverageStartDate,
  });
  const mostRecentPayslipHref = postedPayslip
    ? "/me/payslip"
    : `/me/payslip?period=${previewPeriod}&preview=1`;
  const mostRecentPayslipPeriodLabel = postedPayslip
    ? `${postedPayslip.periodName} (posted)`
    : `${formatPayslipPeriodLabel(previewPeriod) ?? "current period"} (preview)`;

  return (
    <EmployeeProfile
      employee={employee}
      isOwnProfile
      isSelfService
      canRequestLeave={capabilities.can("leave.request")}
      mostRecentPayslipHref={mostRecentPayslipHref}
      mostRecentPayslipPeriodLabel={mostRecentPayslipPeriodLabel}
      mostRecentPayslipIsPosted={Boolean(postedPayslip)}
      payslipHistoryHref="/me/payslips"
      payslipHistoryCount={postedPayslip ? 1 : 0}
      supervisor={extras.supervisor}
      leaveBalances={extras.leaveBalances}
      vacationForfeitureWarning={extras.vacationForfeitureWarning}
      pendingCorrespondenceCount={pendingCorrespondenceCount}
      expiringFileCount={expiringFileCount}
    />
  );
}
