/**
 * Organization-scoped payroll banking FeatureControl codes.
 *
 * Prefer `isPayrollBankingFeatureEnabled` so missing rows use seed defaults
 * (dangerous flags stay OFF) instead of the global missing=enabled behavior.
 *
 * This module stays free of Prisma imports so unit tests can load defaults
 * without a DATABASE_URL.
 */

export const PAYROLL_BANKING_FEATURE_FLAGS = {
  PAYROLL_BANKING_ENABLED: "PAYROLL_BANKING_ENABLED",
  ACH_EXPORT_ENABLED: "ACH_EXPORT_ENABLED",
  MULTIPLE_EMPLOYEE_BANK_ACCOUNTS_ENABLED:
    "MULTIPLE_EMPLOYEE_BANK_ACCOUNTS_ENABLED",
  SPLIT_DEPOSIT_ENABLED: "SPLIT_DEPOSIT_ENABLED",
  FIXED_AMOUNT_ALLOCATION_ENABLED: "FIXED_AMOUNT_ALLOCATION_ENABLED",
  PERCENTAGE_ALLOCATION_ENABLED: "PERCENTAGE_ALLOCATION_ENABLED",
  /** When true with percentage allocations: netPay = full take-home; FIXED then % then REMAINDER. Default OFF. */
  POST_NET_SPLIT_ENABLED: "POST_NET_SPLIT_ENABLED",
  REMAINDER_ALLOCATION_ENABLED: "REMAINDER_ALLOCATION_ENABLED",
  MANUAL_PAYMENT_ENABLED: "MANUAL_PAYMENT_ENABLED",
  CHEQUE_PAYMENT_ENABLED: "CHEQUE_PAYMENT_ENABLED",
  CASH_PAYMENT_ENABLED: "CASH_PAYMENT_ENABLED",
  BANK_ACCOUNT_VERIFICATION_REQUIRED: "BANK_ACCOUNT_VERIFICATION_REQUIRED",
  PAYMENT_BATCH_APPROVAL_REQUIRED: "PAYMENT_BATCH_APPROVAL_REQUIRED",
  ACH_FILE_APPROVAL_REQUIRED: "ACH_FILE_APPROVAL_REQUIRED",
  ALLOW_UNVERIFIED_BANK_ACCOUNTS: "ALLOW_UNVERIFIED_BANK_ACCOUNTS",
  /** When true, preparer may approve their own payment batch (org policy). */
  ALLOW_BATCH_SELF_APPROVAL: "ALLOW_BATCH_SELF_APPROVAL",
  ALLOW_CROSS_BANK_PAYMENTS: "ALLOW_CROSS_BANK_PAYMENTS",
  ALLOW_ZERO_NET_PAY_EXPORT: "ALLOW_ZERO_NET_PAY_EXPORT",
  ALLOW_NEGATIVE_NET_PAY_EXPORT: "ALLOW_NEGATIVE_NET_PAY_EXPORT",
  EMAIL_PAYMENT_CONFIRMATIONS_ENABLED: "EMAIL_PAYMENT_CONFIRMATIONS_ENABLED",
} as const;

export type PayrollBankingFeatureFlag =
  (typeof PAYROLL_BANKING_FEATURE_FLAGS)[keyof typeof PAYROLL_BANKING_FEATURE_FLAGS];

/** Safe defaults for seed (true = continuity with current payroll banking UX). */
export const PAYROLL_BANKING_FEATURE_DEFAULTS: ReadonlyArray<{
  featureCode: PayrollBankingFeatureFlag;
  isEnabled: boolean;
  reason: string;
}> = [
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — banking on for continuity with existing bank accounts.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED,
    isEnabled: false,
    reason: "Phase 1 — ACH file export deferred.",
  },
  {
    featureCode:
      PAYROLL_BANKING_FEATURE_FLAGS.MULTIPLE_EMPLOYEE_BANK_ACCOUNTS_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — app already supports multiple accounts.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.SPLIT_DEPOSIT_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — fixed + remainder already exists.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.FIXED_AMOUNT_ALLOCATION_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — secondary fixed amounts.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.PERCENTAGE_ALLOCATION_ENABLED,
    isEnabled: false,
    reason: "Deferred — enable with POST_NET_SPLIT_ENABLED for true post-net % splits.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.POST_NET_SPLIT_ENABLED,
    isEnabled: false,
    reason:
      "Default OFF — keep FIXED-as-deduction Phase 1 net math. When ON, allocations split full take-home.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.REMAINDER_ALLOCATION_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — primary remainder account.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.MANUAL_PAYMENT_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — bank CSV / manual register remains available.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.CHEQUE_PAYMENT_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — cheque payment method.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.CASH_PAYMENT_ENABLED,
    isEnabled: true,
    reason: "Phase 1 — cash payment method.",
  },
  {
    featureCode:
      PAYROLL_BANKING_FEATURE_FLAGS.BANK_ACCOUNT_VERIFICATION_REQUIRED,
    isEnabled: false,
    reason: "Deferred — verification workflow not in Phase 1.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.PAYMENT_BATCH_APPROVAL_REQUIRED,
    isEnabled: false,
    reason: "Deferred — payment batches not in Phase 1.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.ACH_FILE_APPROVAL_REQUIRED,
    isEnabled: false,
    reason: "Deferred — ACH batches not in Phase 1.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_UNVERIFIED_BANK_ACCOUNTS,
    isEnabled: true,
    reason: "Phase 1 — accept accounts without verification.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_BATCH_SELF_APPROVAL,
    isEnabled: false,
    reason:
      "Maker-checker default — preparer cannot approve unless org policy enables this.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_CROSS_BANK_PAYMENTS,
    isEnabled: true,
    reason: "Phase 1 — multi-institution deposits allowed.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_ZERO_NET_PAY_EXPORT,
    isEnabled: false,
    reason: "Deferred — export policy.",
  },
  {
    featureCode: PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_NEGATIVE_NET_PAY_EXPORT,
    isEnabled: false,
    reason: "Deferred — export policy.",
  },
  {
    featureCode:
      PAYROLL_BANKING_FEATURE_FLAGS.EMAIL_PAYMENT_CONFIRMATIONS_ENABLED,
    isEnabled: false,
    reason: "Deferred — payment confirmation emails.",
  },
];

const DEFAULTS_BY_CODE = new Map(
  PAYROLL_BANKING_FEATURE_DEFAULTS.map((row) => [
    row.featureCode,
    row.isEnabled,
  ]),
);

/**
 * Missing-row default for a payroll banking flag.
 * Unknown / unlisted codes default to **false** (fail closed).
 */
export function payrollBankingFeatureDefault(
  featureCode: PayrollBankingFeatureFlag | string,
): boolean {
  return DEFAULTS_BY_CODE.get(featureCode as PayrollBankingFeatureFlag) ?? false;
}

/**
 * Organization feature gate using seed defaults when the FeatureControl row
 * is missing — so ACH / post-net / negative export stay OFF without a seed.
 */
export async function isPayrollBankingFeatureEnabled(
  featureCode: PayrollBankingFeatureFlag,
): Promise<boolean> {
  const { isFeatureEnabled } = await import(
    "@/src/modules/admin/lib/feature-control"
  );
  return isFeatureEnabled(
    featureCode,
    payrollBankingFeatureDefault(featureCode),
  );
}

/**
 * When true, prepare/export must reject unverified employee bank accounts.
 * True if verification is required OR unverified accounts are not allowed.
 */
export async function requiresVerifiedBankAccounts(): Promise<boolean> {
  const [verificationRequired, allowUnverified] = await Promise.all([
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.BANK_ACCOUNT_VERIFICATION_REQUIRED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_UNVERIFIED_BANK_ACCOUNTS,
    ),
  ]);
  return verificationRequired || !allowUnverified;
}
