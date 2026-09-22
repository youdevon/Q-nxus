import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GratuityPolicyForm } from "@/src/modules/payroll/components/gratuity-policy-form";
import { getGratuityPolicy } from "@/src/modules/payroll/data/get-gratuity-policy";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "New Gratuity Policy",
};

export const dynamic = "force-dynamic";

type NewGratuityPageProps = {
  searchParams: Promise<{ copyFrom?: string }>;
};

export default async function NewGratuityPolicyPage({
  searchParams,
}: NewGratuityPageProps) {
  await requirePayrollManageAccess();
  const { copyFrom } = await searchParams;
  const source = copyFrom ? await getGratuityPolicy(copyFrom) : null;

  if (copyFrom && !source) {
    notFound();
  }

  return (
    <GratuityPolicyForm
      policy={source}
      sourceId={copyFrom ?? null}
      canManage
    />
  );
}
