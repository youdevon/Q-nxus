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
import {
  defaultTtGratuityPolicyInput,
  getCurrentGratuityPolicy,
  toGratuityPolicyInput,
} from "@/src/modules/payroll/data/get-gratuity-policy";

export const metadata: Metadata = {
  title: "Amend Employment Contract",
};

export const dynamic = "force-dynamic";

export default async function AmendEmploymentContractPage({
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
    gratuityPolicyRecord,
  ] = await Promise.all([
    getEmployeeContractHistory(id),
    getEmploymentContractProfile(id, contractId),
    getAllowanceCategories(),
    getContractLeaveEntitlementDefaults(id),
    getEmployeeFormOptions(),
    getCurrentGratuityPolicy(),
  ]);

  if (!history || !sourceContract) {
    notFound();
  }

  const gratuityPolicy = gratuityPolicyRecord
    ? toGratuityPolicyInput(gratuityPolicyRecord)
    : defaultTtGratuityPolicyInput();

  return (
    <EmploymentContractForm
      history={history}
      sourceContract={sourceContract}
      allowanceCategories={allowanceCategories}
      leaveEntitlementDefaults={leaveEntitlementDefaults}
      departments={departments}
      mode="amend"
      gratuityPolicy={gratuityPolicy}
    />
  );
}
