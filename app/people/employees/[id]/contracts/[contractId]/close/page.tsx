import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CloseEmploymentContractForm } from "@/src/modules/hr/components/close-employment-contract-form";
import { getEmploymentContractProfile } from "@/src/modules/hr/data/get-employment-contracts";
import { requireContractManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Close Employment Contract",
};

export const dynamic = "force-dynamic";

export default async function CloseEmploymentContractPage({
  params,
}: {
  params: Promise<{
    id: string;
    contractId: string;
  }>;
}) {
  await requireContractManageAccess();

  const { id, contractId } = await params;

  const contract = await getEmploymentContractProfile(id, contractId);

  if (!contract) {
    notFound();
  }

  if (!contract.isCurrent) {
    redirect(`/people/employees/${id}/contracts/${contractId}`);
  }

  return <CloseEmploymentContractForm contract={contract} />;
}
