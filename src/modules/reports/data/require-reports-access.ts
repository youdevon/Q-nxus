import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/src/modules/admin/lib/feature-control";
import {
  getUserCapabilities,
  type UserCapabilities,
} from "@/src/modules/auth/data/get-user-capabilities";
import {
  canAccessReport,
  filterReportsForCapabilities,
  type ReportDefinition,
} from "@/src/modules/reports/lib/report-definitions";

export async function requireReportsHubAccess(): Promise<UserCapabilities> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (filterReportsForCapabilities(capabilities).length === 0) {
    notFound();
  }

  return capabilities;
}

export async function requireReportAccess(
  report: ReportDefinition,
): Promise<UserCapabilities> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (report.category === "payroll" && !(await isFeatureEnabled("payroll"))) {
    notFound();
  }

  if (!canAccessReport(capabilities, report.permissions)) {
    notFound();
  }

  return capabilities;
}
