import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayrollProfileForm } from "@/src/modules/payroll/components/payroll-profile-form";
import { getEmployeePayrollSetup } from "@/src/modules/payroll/data/get-employee-payroll-setup";
import { requirePayrollSetupAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Payroll Setup",
};

export const dynamic = "force-dynamic";

type EmployeePayrollPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmployeePayrollPage({
  params,
}: EmployeePayrollPageProps) {
  await requirePayrollSetupAccess();

  const { id } = await params;
  const setup = await getEmployeePayrollSetup(id);

  if (!setup) {
    notFound();
  }

  return <PayrollProfileForm setup={setup} />;
}
