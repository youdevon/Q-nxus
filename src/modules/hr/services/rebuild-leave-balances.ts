import { prisma } from "@/lib/prisma";
import { createContractLeaveBalances } from "@/src/modules/hr/services/create-contract-leave-balances";

export type RebuildLeaveBalancesResult = {
  contractsConsidered: number;
  contractsUpdated: number;
  balancesCreated: number;
  balancesUpdated: number;
  errors: string[];
};

/**
 * Recomputes leave entitlements for current contracts with an end date,
 * preserving taken / reserved / adjustments via createContractLeaveBalances.
 * Contract vacation/sick day overrides are re-applied automatically.
 */
export async function rebuildCurrentContractLeaveBalances(options: {
  organizationId: string;
  createdByUserId?: string | null;
}): Promise<RebuildLeaveBalancesResult> {
  const contracts = await prisma.employmentContract.findMany({
    where: {
      isCurrent: true,
      endDate: { not: null },
      employee: {
        organizationId: options.organizationId,
      },
    },
    select: {
      id: true,
      contractNumber: true,
    },
    orderBy: {
      startDate: "desc",
    },
  });

  let contractsUpdated = 0;
  let balancesCreated = 0;
  let balancesUpdated = 0;
  const errors: string[] = [];

  for (const contract of contracts) {
    try {
      const result = await createContractLeaveBalances(
        contract.id,
        options.createdByUserId,
      );
      contractsUpdated += 1;
      balancesCreated += result.created;
      balancesUpdated += result.updated;
    } catch (error) {
      const label = contract.contractNumber ?? contract.id;
      errors.push(
        `${label}: ${
          error instanceof Error ? error.message : "Rebuild failed."
        }`,
      );
    }
  }

  return {
    contractsConsidered: contracts.length,
    contractsUpdated,
    balancesCreated,
    balancesUpdated,
    errors,
  };
}
