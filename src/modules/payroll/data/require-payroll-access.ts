import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/src/modules/admin/lib/feature-control";
import {
  getUserCapabilities,
  type UserCapabilities,
} from "@/src/modules/auth/data/get-user-capabilities";
import {
  PAYROLL_SETUP_CAPABILITIES,
  PAYROLL_VIEW_CAPABILITIES,
} from "@/src/modules/auth/lib/capability-check";

async function assertPayrollFeatureEnabled() {
  if (!(await isFeatureEnabled("payroll"))) {
    notFound();
  }
}

/** Payroll readiness directory and payroll views. */
export async function requirePayrollViewAccess(): Promise<UserCapabilities> {
  await assertPayrollFeatureEnabled();
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.canAny(...PAYROLL_VIEW_CAPABILITIES)) {
    notFound();
  }

  return capabilities;
}

/**
 * Employee payroll profile / readiness setup mutations.
 * Clerks (`payroll.setup`) and officers (`payroll.manage`) may edit.
 */
export async function requirePayrollSetupAccess(): Promise<UserCapabilities> {
  await assertPayrollFeatureEnabled();
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.canAny(...PAYROLL_SETUP_CAPABILITIES)) {
    notFound();
  }

  return capabilities;
}

/** Pay runs, posting, and statutory rate administration. */
export async function requirePayrollManageAccess(): Promise<UserCapabilities> {
  await assertPayrollFeatureEnabled();
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.can("payroll.manage")) {
    notFound();
  }

  return capabilities;
}
