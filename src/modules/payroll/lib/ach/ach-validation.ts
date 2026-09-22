import { sumMoney, toCents } from "@/src/modules/payroll/lib/money";
import {
  detectAchReceiverNameWarnings,
  formatAchAccountNumber,
  formatAchAmountCents,
  formatAchReceiverName,
  formatAchSalaryReference,
  buildFcbLegacyAchRecord,
  AchRecordValidationError,
} from "@/src/modules/payroll/lib/ach/ach-record-builder";
import type { AchExportSettings } from "@/src/modules/payroll/lib/ach/ach-settings";
import { isLegacyTransactionOverrideActive } from "@/src/modules/payroll/lib/ach/ach-settings";
import { resolveAchCreditTransactionCode } from "@/src/modules/payroll/lib/ach/ach-transaction-code";
import { assertValidTraceNumber } from "@/src/modules/payroll/lib/ach/ach-trace-number";
import {
  validateFcbTtAchRouting,
  type AchRoutingParticipant,
} from "@/src/modules/payroll/lib/ach/ach-routing";
import { detectAchAccountLengthWarnings } from "@/src/modules/payroll/lib/ach/ach-account";
import { normalizeAchAccountDigits } from "@/src/modules/payroll/lib/ach/ach-account";
import {
  FCB_LEGACY_RECORD_LENGTH,
  FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
  formatFcbLegacyExportLabel,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import {
  FCB_TT_MAX_ENTRY_AMOUNT_CENTS,
  FCB_TT_MIN_ENTRY_AMOUNT_CENTS,
} from "@/src/modules/payroll/lib/ach/fcb-tt-config";
import type { AchParticipantBank } from "@/src/modules/payroll/lib/ach/ach-participant-types";

/** Warnings that surface in the UI but never block export by themselves. */
export const ACH_ADVISORY_WARNING_CODES = new Set(["TXN_CODE_22_UNPROVEN"]);

export type AchValidationSeverity = "error" | "warning";

export type AchValidationIssue = {
  severity: AchValidationSeverity;
  code: string;
  field: string;
  message: string;
  recommendedCorrection?: string;
};

export type AchCandidateRow = {
  sequence: number;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  bankName: string;
  routingNumber: string | null;
  accountNumber: string | null;
  accountNumberMasked: string;
  accountType: string | null;
  paymentType: string | null;
  beneficiaryName: string | null;
  amount: number;
  currencyCode: string;
  excluded?: boolean;
  exclusionReason?: string | null;
  /** Preview / frozen trace when already allocated. */
  traceNumber?: string | null;
};

export type AchValidatedRow = AchCandidateRow & {
  transactionCode: "22" | "32" | null;
  /** Positions 40–54 — `SALARY YYYYMMDD` (payment date source). */
  salaryReference: string;
  achIndividualIdentification: string;
  receiverNameFormatted: string;
  /** Positions 30–39 cents field when amount is valid. */
  amountField: string | null;
  /** Positions 80–94 — opaque ACH Trace Number (never a period). */
  achTraceNumber: string | null;
  /** Dry-run record length when a type-6 line can be assembled. */
  recordLength: number | null;
  issues: AchValidationIssue[];
  ok: boolean;
};

export type AchValidationSummary = {
  exportFormat: string;
  exportFormatLabel: string;
  paymentDate: string;
  employeeCount: number;
  includedCount: number;
  excludedCount: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  totalAmount: number;
  currencyCode: string;
  forceLegacyTransactionCode: boolean;
  rows: AchValidatedRow[];
  controlOk: boolean;
  blockingErrors: string[];
  /** Non-blocking notes (e.g. unproven txn code 22). */
  advisoryNotes: string[];
};

function pushIssue(
  issues: AchValidationIssue[],
  issue: AchValidationIssue,
): void {
  issues.push(issue);
}

export function validateAchCandidateRow(input: {
  row: AchCandidateRow;
  settings: AchExportSettings;
  paymentDate: Date | string;
  routingRegistry?:
    | ReadonlyMap<string, AchRoutingParticipant | AchParticipantBank>
    | readonly (AchRoutingParticipant | AchParticipantBank)[];
}): AchValidatedRow {
  const { row, settings, paymentDate } = input;
  const issues: AchValidationIssue[] = [];
  const salaryReference = formatAchSalaryReference(
    paymentDate,
    settings.entryDescription,
  );
  const receiverSource =
    row.beneficiaryName?.trim() || row.employeeName.trim() || "";
  const receiverNameFormatted = formatAchReceiverName(receiverSource);

  for (const warning of detectAchReceiverNameWarnings(receiverSource)) {
    pushIssue(issues, {
      severity: "warning",
      code: "NAME_WARNING",
      field: "receiverName",
      message: warning,
    });
  }

  if (!row.employeeNumber.trim()) {
    pushIssue(issues, {
      severity: "error",
      code: "EMPLOYEE_NUMBER",
      field: "employeeNumber",
      message: "Employee number is required.",
    });
  }

  if (!receiverSource) {
    pushIssue(issues, {
      severity: "error",
      code: "RECEIVER_NAME",
      field: "receiverName",
      message: "Receiver / payee name is required.",
      recommendedCorrection: "Set account holder name on the employee bank profile.",
    });
  }

  const routingResult = validateFcbTtAchRouting(
    row.routingNumber,
    input.routingRegistry,
  );
  const routing = routingResult.ok ? routingResult.routing : null;
  if (!routingResult.ok) {
    pushIssue(issues, {
      severity: "error",
      code: "ROUTING",
      field: "routingNumber",
      message: routingResult.error,
      recommendedCorrection:
        "Link a financial institution with ACH credits enabled, or add the bank under Payroll Settings → ACH banks.",
    });
  }

  if (!row.accountNumber?.trim()) {
    pushIssue(issues, {
      severity: "error",
      code: "ACCOUNT",
      field: "accountNumber",
      message: "Account number is required.",
    });
  } else {
    try {
      const digits = normalizeAchAccountDigits(row.accountNumber);
      formatAchAccountNumber(row.accountNumber);
      for (const warning of detectAchAccountLengthWarnings({
        accountDigits: digits,
        routingNumber: routing,
        participant: routingResult.ok ? routingResult.participant : null,
      })) {
        pushIssue(issues, {
          severity: "warning",
          code: warning.code,
          field: "accountNumber",
          message: warning.message,
        });
      }
    } catch (error) {
      pushIssue(issues, {
        severity: "error",
        code: "ACCOUNT",
        field: "accountNumber",
        message:
          error instanceof Error
            ? error.message
            : "Account number is invalid.",
      });
    }
  }

  const amountCents = toCents(row.amount);
  const employeeLabel =
    row.employeeName.trim() || row.employeeNumber || "employee";
  if (!(amountCents >= FCB_TT_MIN_ENTRY_AMOUNT_CENTS)) {
    pushIssue(issues, {
      severity: "error",
      code: "AMOUNT",
      field: "amount",
      message: `ACH amount for ${employeeLabel} must be greater than $0.00.`,
      recommendedCorrection: "Exclude this employee or correct payroll net.",
    });
  } else if (amountCents >= FCB_TT_MAX_ENTRY_AMOUNT_CENTS) {
    pushIssue(issues, {
      severity: "error",
      code: "AMOUNT_LIMIT",
      field: "amount",
      message: `ACH amount for ${employeeLabel} must be less than $500,000.00 (Central Bank threshold).`,
    });
  } else if (!formatAchAmountCents(row.amount, { employeeLabel })) {
    pushIssue(issues, {
      severity: "error",
      code: "AMOUNT_OVERFLOW",
      field: "amount",
      message: `ACH amount for ${employeeLabel} exceeds the 10-digit cents field.`,
    });
  }

  const transactionCode = resolveAchCreditTransactionCode({
    paymentType: row.paymentType,
    accountType: row.accountType,
    settings,
  });
  if (!transactionCode) {
    pushIssue(issues, {
      severity: "error",
      code: "TRANSACTION_CODE",
      field: "accountType",
      message:
        "Account type must be Savings or Chequing/Current, or enable the legacy transaction-code override.",
      recommendedCorrection:
        "Set Savings/Chequing on the employee account, or force legacy code 32 in ACH settings.",
    });
  } else if (transactionCode === "22") {
    // Advisory only — FCB import of code 22 is unproven; do not hard-block export.
    pushIssue(issues, {
      severity: "warning",
      code: "TXN_CODE_22_UNPROVEN",
      field: "transactionCode",
      message: `Transaction code 22 (chequing credit) for ${employeeLabel} is not yet proven through FCB Business Online import.`,
      recommendedCorrection:
        "Confirm posting with FCB, or enable Force savings code (32) under ACH settings.",
    });
  }

  if (row.traceNumber) {
    try {
      assertValidTraceNumber(row.traceNumber);
    } catch (error) {
      pushIssue(issues, {
        severity: "error",
        code: "TRACE",
        field: "traceNumber",
        message:
          error instanceof Error ? error.message : "Trace number is invalid.",
      });
    }
  }

  const amountField = formatAchAmountCents(row.amount, { employeeLabel });
  let recordLength: number | null = null;
  const prelimOk =
    !row.excluded &&
    issues.every((issue) => issue.severity !== "error");
  if (
    prelimOk &&
    transactionCode &&
    routing &&
    row.accountNumber &&
    amountField &&
    row.traceNumber
  ) {
    try {
      const dryRun = buildFcbLegacyAchRecord({
        transactionCode,
        routingNumber: routing,
        accountNumber: row.accountNumber,
        amount: row.amount,
        individualId: salaryReference,
        receiverName: receiverSource,
        discretionaryData: settings.discretionaryData,
        addendaIndicator: "0",
        traceNumber: row.traceNumber,
        employeeLabel: row.employeeName,
        routingRegistry: input.routingRegistry,
      });
      recordLength = dryRun.length;
      if (dryRun.length !== FCB_LEGACY_RECORD_LENGTH) {
        pushIssue(issues, {
          severity: "error",
          code: "RECORD_LENGTH",
          field: "record",
          message: `Expected ${FCB_LEGACY_RECORD_LENGTH} characters, generated ${dryRun.length}.`,
        });
      }
    } catch (error) {
      pushIssue(issues, {
        severity: "error",
        code: "RECORD_BUILD",
        field: "record",
        message:
          error instanceof Error
            ? error.message
            : "Failed to assemble a 94-character ACH record.",
      });
      recordLength = null;
    }
  }

  const finalOk =
    !row.excluded &&
    issues.every((issue) => issue.severity !== "error");

  return {
    ...row,
    transactionCode,
    salaryReference,
    achIndividualIdentification: salaryReference,
    receiverNameFormatted,
    amountField,
    achTraceNumber: row.traceNumber ?? null,
    recordLength,
    issues,
    ok: finalOk,
  };
}

export function assembleAchValidationSummary(input: {
  rows: AchCandidateRow[];
  settings: AchExportSettings;
  paymentDate: Date | string;
  currencyCode?: string;
  /** ACH participant registry from FinancialInstitution (production). */
  routingRegistry?: Parameters<typeof validateAchCandidateRow>[0]["routingRegistry"];
}): AchValidationSummary {
  const paymentIso =
    typeof input.paymentDate === "string"
      ? input.paymentDate.slice(0, 10)
      : input.paymentDate.toISOString().slice(0, 10);

  const validated = input.rows.map((row) =>
    validateAchCandidateRow({
      row,
      settings: input.settings,
      paymentDate: input.paymentDate,
      routingRegistry: input.routingRegistry,
    }),
  );

  const included = validated.filter((row) => !row.excluded);
  const excluded = validated.filter((row) => row.excluded);
  const withErrors = included.filter((row) => !row.ok);
  const valid = included.filter((row) => row.ok);
  const warningCount = validated.reduce(
    (sum, row) =>
      sum +
      row.issues.filter(
        (issue) =>
          issue.severity === "warning" &&
          !ACH_ADVISORY_WARNING_CODES.has(issue.code),
      ).length,
    0,
  );
  const advisoryWarnings = validated.flatMap((row) =>
    row.issues.filter(
      (issue) =>
        issue.severity === "warning" &&
        ACH_ADVISORY_WARNING_CODES.has(issue.code),
    ),
  );

  const totalAmount = sumMoney(...valid.map((row) => row.amount));
  const recalculatedCents = valid.reduce(
    (sum, row) => sum + toCents(row.amount),
    0,
  );
  const totalCents = toCents(totalAmount);
  const controlOk = recalculatedCents === totalCents;

  const blockingErrors: string[] = [];
  if (input.settings.exportFormat !== FCB_TT_LEGACY_NACHA_NO_HEADER_V1) {
    blockingErrors.push(
      `Export format ${input.settings.exportFormat} is not implemented.`,
    );
  }
  if (included.length === 0) {
    blockingErrors.push("No employees are included in this ACH export.");
  }
  if (withErrors.length > 0) {
    const topCodes = new Map<string, number>();
    for (const row of withErrors) {
      for (const issue of row.issues) {
        if (issue.severity !== "error") {
          continue;
        }
        topCodes.set(issue.code, (topCodes.get(issue.code) ?? 0) + 1);
      }
    }
    const detail = [...topCodes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => `${code}×${count}`)
      .join(", ");
    blockingErrors.push(
      `${withErrors.length} employee record(s) failed ACH validation${
        detail ? ` (${detail})` : ""
      }.`,
    );
    const routingFailures = withErrors.filter((row) =>
      row.issues.some(
        (issue) => issue.severity === "error" && issue.code === "ROUTING",
      ),
    );
    if (routingFailures.length > 0) {
      blockingErrors.push(
        "One or more routing numbers are not enabled ACH participants. Open Payroll Settings → ACH banks, set ACH credits on the bank, and save.",
      );
    }
  }
  if (!controlOk) {
    blockingErrors.push(
      "Internal ACH control total does not match the sum of included net pays.",
    );
  }
  if (!input.settings.allowExportWithWarnings && warningCount > 0) {
    blockingErrors.push(
      "Export with warnings is disabled and one or more name/banking warnings exist.",
    );
  }

  const advisoryNotes: string[] = [];
  const code22Count = advisoryWarnings.filter(
    (issue) => issue.code === "TXN_CODE_22_UNPROVEN",
  ).length;
  if (code22Count > 0) {
    advisoryNotes.push(
      `${code22Count} line(s) use transaction code 22 (chequing). FCB import of code 22 is not yet confirmed — review bank posting or force savings code 32 in ACH settings.`,
    );
  }

  // Duplicate traces among included rows
  const traces = included
    .map((row) => row.traceNumber)
    .filter((trace): trace is string => Boolean(trace));
  const seen = new Set<string>();
  for (const trace of traces) {
    if (seen.has(trace)) {
      blockingErrors.push(`Duplicate ACH trace number in batch: ${trace}.`);
      break;
    }
    seen.add(trace);
  }

  return {
    exportFormat: input.settings.exportFormat,
    exportFormatLabel: formatFcbLegacyExportLabel(input.settings.exportFormat),
    paymentDate: paymentIso,
    employeeCount: new Set(included.map((row) => row.employeeId)).size,
    includedCount: included.length,
    excludedCount: excluded.length,
    validCount: valid.length,
    errorCount: withErrors.length,
    warningCount,
    totalAmount,
    currencyCode: input.currencyCode ?? "TTD",
    forceLegacyTransactionCode: isLegacyTransactionOverrideActive(
      input.settings,
    ),
    rows: validated,
    controlOk,
    blockingErrors,
    advisoryNotes,
  };
}

export function assertAchExportReady(summary: AchValidationSummary): void {
  if (summary.blockingErrors.length > 0) {
    throw new AchRecordValidationError(summary.blockingErrors.join(" "));
  }
}
