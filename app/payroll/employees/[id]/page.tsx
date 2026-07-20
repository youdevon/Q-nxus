import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { EmployeePriorEmploymentForm } from "@/src/modules/payroll/components/employee-prior-employment-form";
import { EmployeeRecurringItemsManager } from "@/src/modules/payroll/components/employee-recurring-items-manager";
import { EmployeeTaxProfileForm } from "@/src/modules/payroll/components/employee-tax-profile-form";
import { PayrollProfileForm } from "@/src/modules/payroll/components/payroll-profile-form";
import { getEmployeePayrollSetup } from "@/src/modules/payroll/data/get-employee-payroll-setup";
import {
  getActivePayrollComponentDefinitions,
  getEmployeeRecurringItems,
} from "@/src/modules/payroll/data/get-payroll-recurring-components";
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
  const [{ id }, capabilities] = await Promise.all([
    params,
    requirePayrollSetupAccess(),
  ]);

  const setup = await getEmployeePayrollSetup(id);

  if (!setup) {
    notFound();
  }

  const [recurringItems, definitions] = await Promise.all([
    getEmployeeRecurringItems(id),
    getActivePayrollComponentDefinitions(setup.employee.organizationId),
  ]);

  const canManage =
    capabilities.can("payroll.setup") || capabilities.can("payroll.manage");
  const currency =
    setup.currentContract?.currency ??
    setup.payElements[0]?.currency ??
    "TTD";

  const taxYearHref = `/payroll/employees/${id}/tax-year`;

  return (
    <>
      <PayrollProfileForm setup={setup} taxYearHref={taxYearHref} />
      <EmployeeTaxProfileForm setup={setup} />
      <EmployeePriorEmploymentForm setup={setup} />
      <PageShell className="pt-0 sm:pt-0 md:pt-0 lg:pt-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Tax year overview
            </p>
            <p className="text-xs text-muted-foreground">
              Profile summary, prior-employer YTD, posted slips, and statutory
              overrides.
            </p>
          </div>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href={taxYearHref} />}
          >
            Open tax year
          </Button>
        </div>
        <EmployeeRecurringItemsManager
          employeeId={id}
          items={recurringItems}
          definitions={definitions}
          canManage={canManage}
          currency={currency}
        />
      </PageShell>
    </>
  );
}
