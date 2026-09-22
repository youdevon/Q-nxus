import type { Metadata } from "next";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { PaymentInstructionImportForm } from "@/src/modules/payroll/components/payment-instruction-import-form";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Import payment instructions",
};

export const dynamic = "force-dynamic";

export default async function PaymentInstructionImportPage() {
  const capabilities = await requirePayrollViewAccess();
  const canImport =
    capabilities.can("payroll.payment_instructions.import") ||
    capabilities.can("payroll.manage");

  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title="Import payment instructions"
        description="Bulk CSV import for employee banking destinations. HR employees remain the source of truth."
        backHref="/payroll/settings"
        backLabel="Payroll settings"
      />
      {canImport ? (
        <PaymentInstructionImportForm />
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have permission to import payment instructions.
        </p>
      )}
    </PageShell>
  );
}
