import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GratuityPolicyForm } from "@/src/modules/payroll/components/gratuity-policy-form";
import { getGratuityPolicy } from "@/src/modules/payroll/data/get-gratuity-policy";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Edit Gratuity Policy",
};

export const dynamic = "force-dynamic";

type EditGratuityPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditGratuityPolicyPage({
  params,
}: EditGratuityPageProps) {
  await requirePayrollManageAccess();
  const { id } = await params;
  const policy = await getGratuityPolicy(id);

  if (!policy) {
    notFound();
  }

  return <GratuityPolicyForm policy={policy} canManage />;
}
