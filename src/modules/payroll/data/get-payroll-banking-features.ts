import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  PAYROLL_BANKING_FEATURE_FLAGS,
  payrollBankingFeatureDefault,
  type PayrollBankingFeatureFlag,
} from "@/src/modules/payroll/lib/payroll-banking-flags";

/**
 * Load many payroll banking feature flags in one org lookup + one
 * featureControl findMany (avoids N× organization.findFirst).
 */
export const getPayrollBankingFeatureMap = cache(
  async (
    codes: readonly PayrollBankingFeatureFlag[],
  ): Promise<Map<PayrollBankingFeatureFlag, boolean>> => {
    const result = new Map<PayrollBankingFeatureFlag, boolean>();
    for (const code of codes) {
      result.set(code, payrollBankingFeatureDefault(code));
    }

    if (codes.length === 0) {
      return result;
    }

    const organization = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!organization) {
      return result;
    }

    const controls = await prisma.featureControl.findMany({
      where: {
        organizationId: organization.id,
        featureCode: { in: [...codes] },
      },
      select: {
        featureCode: true,
        isEnabled: true,
      },
    });

    for (const control of controls) {
      if (codes.includes(control.featureCode as PayrollBankingFeatureFlag)) {
        result.set(
          control.featureCode as PayrollBankingFeatureFlag,
          control.isEnabled,
        );
      }
    }

    return result;
  },
);

/** Common banking flags for employee payroll setup forms. */
export const SETUP_BANKING_FEATURE_CODES = [
  PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
  PAYROLL_BANKING_FEATURE_FLAGS.SPLIT_DEPOSIT_ENABLED,
  PAYROLL_BANKING_FEATURE_FLAGS.MULTIPLE_EMPLOYEE_BANK_ACCOUNTS_ENABLED,
  PAYROLL_BANKING_FEATURE_FLAGS.PERCENTAGE_ALLOCATION_ENABLED,
  PAYROLL_BANKING_FEATURE_FLAGS.POST_NET_SPLIT_ENABLED,
] as const;

export async function getSetupBankingFlags(): Promise<{
  bankingEnabled: boolean;
  splitDepositEnabled: boolean;
  multipleAccountsEnabled: boolean;
  percentageAllocationEnabled: boolean;
  postNetSplitEnabled: boolean;
}> {
  const map = await getPayrollBankingFeatureMap(SETUP_BANKING_FEATURE_CODES);
  return {
    bankingEnabled: map.get(PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED)!,
    splitDepositEnabled: map.get(
      PAYROLL_BANKING_FEATURE_FLAGS.SPLIT_DEPOSIT_ENABLED,
    )!,
    multipleAccountsEnabled: map.get(
      PAYROLL_BANKING_FEATURE_FLAGS.MULTIPLE_EMPLOYEE_BANK_ACCOUNTS_ENABLED,
    )!,
    percentageAllocationEnabled: map.get(
      PAYROLL_BANKING_FEATURE_FLAGS.PERCENTAGE_ALLOCATION_ENABLED,
    )!,
    postNetSplitEnabled: map.get(
      PAYROLL_BANKING_FEATURE_FLAGS.POST_NET_SPLIT_ENABLED,
    )!,
  };
}
