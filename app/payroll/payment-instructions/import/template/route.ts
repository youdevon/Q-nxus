import { paymentInstructionImportTemplateCsv } from "@/src/modules/payroll/lib/payment-instruction-import";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";

export const dynamic = "force-dynamic";

export async function GET() {
  const capabilities = await getUserCapabilities();
  const allowed =
    capabilities?.can("payroll.payment_instructions.import") ||
    capabilities?.can("payroll.bank_accounts.create") ||
    capabilities?.can("payroll.manage");
  if (!capabilities || !allowed) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(paymentInstructionImportTemplateCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        'attachment; filename="payment-instructions-import-template.csv"',
    },
  });
}
