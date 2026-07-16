import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmploymentContractForm } from "@/src/modules/hr/components/employment-contract-form";
import { getContractLeaveEntitlementDefaults } from "@/src/modules/hr/data/get-contract-leave-entitlement-defaults";
import {
  getAllowanceCategories,
  getEmployeeContractHistory,
} from "@/src/modules/hr/data/get-employment-contracts";
import { requireContractManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Employment Contract",
};

export const dynamic = "force-dynamic";

export default async function NewEmploymentContractPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requireContractManageAccess();

  const { id } = await params;
  const [history, allowanceCategories, leaveEntitlementDefaults] =
    await Promise.all([
      getEmployeeContractHistory(id),
      getAllowanceCategories(),
      getContractLeaveEntitlementDefaults(id),
    ]);

  if (!history) {
    notFound();
  }

  return (
    <EmploymentContractForm
      history={history}
      allowanceCategories={allowanceCategories}
      leaveEntitlementDefaults={leaveEntitlementDefaults}
      mode="create"
    />
  );
}
