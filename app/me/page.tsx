import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EmployeeProfile } from "@/src/modules/hr/components/employee-profile";
import { getEmployeeProfile } from "@/src/modules/hr/data/get-employee-form-data";
import { getSelfServiceProfileExtras } from "@/src/modules/hr/data/get-self-service-profile-extras";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { notifyVacationForfeitureReminders } from "@/src/modules/hr/services/notify-vacation-forfeiture";
import { getMostRecentPostedPayslip } from "@/src/modules/payroll/data/get-pay-runs";
import {
  formatPayslipPeriodLabel,
  getPreviousPayslipPeriod,
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

  try {
    await notifyVacationForfeitureReminders({
      employeeId: capabilities.employeeId,
    });
  } catch (error) {
    console.error("Vacation forfeiture reminder pass failed:", error);
  }

  const [employee, extras, postedPayslip] = await Promise.all([
    getEmployeeProfile(capabilities.employeeId),
    getSelfServiceProfileExtras(capabilities.employeeId),
    getMostRecentPostedPayslip(capabilities.employeeId),
  ]);

  if (!employee) {
    notFound();
  }

  const previewPeriod = getPreviousPayslipPeriod();
  const mostRecentPayslipHref = postedPayslip
    ? "/me/payslip"
    : `/me/payslip?period=${previewPeriod}&preview=1`;
  const mostRecentPayslipPeriodLabel = postedPayslip
    ? `${postedPayslip.periodName} (posted)`
    : `${formatPayslipPeriodLabel(previewPeriod) ?? "previous month"} (preview)`;

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
    />
  );
}
