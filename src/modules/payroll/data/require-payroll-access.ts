import { notFound, redirect } from "next/navigation";

import {
  getUserCapabilities,
  type UserCapabilities,
} from "@/src/modules/auth/data/get-user-capabilities";

/** Payroll readiness directory and payroll views. */
export async function requirePayrollViewAccess(): Promise<UserCapabilities> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.canAny("payroll.view", "payroll.manage")) {
    notFound();
  }

  return capabilities;
}

/** Payroll setup mutations and statutory rate administration. */
export async function requirePayrollManageAccess(): Promise<UserCapabilities> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.can("payroll.manage")) {
    notFound();
  }

  return capabilities;
}
