import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmploymentContractForm } from "@/src/modules/hr/components/employment-contract-form";
import { getContractLeaveEntitlementDefaults } from "@/src/modules/hr/data/get-contract-leave-entitlement-defaults";
import { getEmployeeFormOptions } from "@/src/modules/hr/data/get-employee-form-data";
import {
  getAllowanceCategories,
  getEmployeeContractHistory,
  getEmploymentContractProfile,
} from "@/src/modules/hr/data/get-employment-contracts";
import { requireContractManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Renew Employment Contract",
};

export const dynamic = "force-dynamic";

export default async function RenewEmploymentContractPage({
  params,
}: {
  params: Promise<{
    id: string;
    contractId: string;
  }>;
}) {
  await requireContractManageAccess();

  const { id, contractId } = await params;

  const [
    history,
    sourceContract,
    allowanceCategories,
    leaveEntitlementDefaults,
    departments,
  ] = await Promise.all([
    getEmployeeContractHistory(id),
    getEmploymentContractProfile(id, contractId),
    getAllowanceCategories(),
    getContractLeaveEntitlementDefaults(id),
    getEmployeeFormOptions(),
  ]);

  if (!history || !sourceContract) {
    notFound();
  }

  return (
    <EmploymentContractForm
      history={history}
      sourceContract={sourceContract}
      allowanceCategories={allowanceCategories}
      leaveEntitlementDefaults={leaveEntitlementDefaults}
      departments={departments}
      mode="renew"
    />
  );
}
