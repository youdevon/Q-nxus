/**
 * Align employee payment-instruction capture with First Citizens ACH template fields.
 *
 * First Citizens manual entry (per payment):
 *   Individual Name | Individual ID | ABA Number | Account Number |
 *   Payment Type | Purpose Code | Amount | Addenda
 *
 * Mapping into Q-NXUS:
 *   Individual Name  → account holder name (required on employee instruction)
 *   Individual ID    → HR employee number (not captured on bank form)
 *   ABA Number       → financial institution (display name / routing when known)
 *   Account Number   → encrypted account number (required)
 *   Payment Type     → Savings Credit | Chequing Credit from account type
 *   Purpose Code     → organization / bank-export profile (not per employee)
 *   Amount           → payroll allocation / payslip (not typed on setup)
 *   Addenda          → batch global addenda (optional; not per employee)
 *
 * Not required for FCB ACH entry (kept optional / omitted from primary UI):
 *   Branch / transit, nickname, discretionary per-employee addenda
 */

export const ACH_EMPLOYEE_ACCOUNT_TYPES = ["SAVINGS", "CHEQUING"] as const;

export type AchEmployeeAccountType = (typeof ACH_EMPLOYEE_ACCOUNT_TYPES)[number];

export function isAchEmployeeAccountType(
  value: string | null | undefined,
): value is AchEmployeeAccountType {
  return value === "SAVINGS" || value === "CHEQUING";
}

/** Normalize UI / import values into ACH account types. */
export function normalizeAchAccountType(
  value: string | null | undefined,
): AchEmployeeAccountType | null {
  if (!value?.trim()) {
    return null;
  }
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "SAVINGS" || normalized === "SAVING") {
    return "SAVINGS";
  }
  if (
    normalized === "CHEQUING" ||
    normalized === "CHECKING" ||
    normalized === "CURRENT"
  ) {
    return "CHEQUING";
  }
  return null;
}

export type AchEmployeeInstructionValidationInput = {
  bankName: string;
  accountNumber: string;
  accountHolderName: string | null | undefined;
  accountType: string | null | undefined;
  financialInstitutionId?: string | null;
};

export type AchEmployeeInstructionValidationResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Fields the employee payment-instruction UI must collect for ACH readiness.
 */
export function validateAchEmployeeInstructionFields(
  input: AchEmployeeInstructionValidationInput,
): AchEmployeeInstructionValidationResult {
  const errors: string[] = [];
  if (!input.bankName.trim() && !input.financialInstitutionId) {
    errors.push("Bank / institution (ACH ABA) is required.");
  }
  if (!input.accountNumber.trim()) {
    errors.push("Account number is required.");
  } else if (input.accountNumber.replace(/\D/g, "").length < 4) {
    errors.push("Account number must include at least 4 digits.");
  }
  if (!input.accountHolderName?.trim()) {
    errors.push(
      "Account holder name (ACH Individual Name) is required.",
    );
  }
  if (!normalizeAchAccountType(input.accountType)) {
    errors.push(
      "Account type must be Savings or Chequing (ACH Payment Type).",
    );
  }
  return { ok: errors.length === 0, errors };
}

export const ACH_FIELD_HELP = {
  section:
    "Payment instructions for bank transfer / ACH. Fields match First Citizens Business Online entry requirements.",
  institution: "Bank / institution (ACH ABA Number)",
  accountHolder: "Account holder name (ACH Individual Name)",
  accountNumber: "Account number",
  accountType: "Account type → ACH Payment Type (Savings or Chequing Credit)",
  allocation:
    "How this account shares net pay. Amounts are calculated at payroll time — Purpose Code and Addenda are set on the bank export profile / batch, not here.",
} as const;
