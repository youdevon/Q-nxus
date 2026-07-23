/**
 * Bank export adapter engine (Phase 3).
 * Configurable profiles only — no invented official bank layouts.
 */

import { createHash } from "node:crypto";

import { toCsv } from "@/src/modules/payroll/lib/payroll-exports";
import { maskAccountNumber } from "@/src/modules/payroll/lib/payslip-preview";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import {
  FirstCitizensImportDisabledAdapter,
  FirstCitizensManualWorksheetAdapter,
} from "@/src/modules/payroll/lib/first-citizens-export";

export type BankExportDetailLine = {
  sequence: number;
  employeeNumber: string;
  employeeName: string;
  bankName: string;
  accountNumber: string | null;
  accountNumberMasked: string;
  amount: number;
  currencyCode: string;
  allocationKind: string;
  beneficiaryName?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
};

export type BankExportGenerateInput = {
  batchNumber: string;
  runNumber: string;
  currencyCode: string;
  details: BankExportDetailLine[];
  configurationJson: unknown;
};

export type BankExportGenerateResult = {
  fileName: string;
  mimeType: string;
  content: string;
  contentHash: string;
  controlTotalAmount: number;
  detailCount: number;
  maskedPreview: string;
};

export type BankExportValidationResult = {
  ok: boolean;
  errors: string[];
};

export type BankExportAdapterKindCode =
  | "MANUAL_REGISTER"
  | "GENERIC_CSV"
  | "FIRST_CITIZENS_MANUAL_WORKSHEET"
  | "FIRST_CITIZENS_IMPORT";

export interface PayrollBankExportAdapter {
  readonly kind: BankExportAdapterKindCode;
  validate(input: BankExportGenerateInput): BankExportValidationResult;
  generate(input: BankExportGenerateInput): BankExportGenerateResult;
  controlTotal(details: readonly BankExportDetailLine[]): number;
  maskPreview(content: string, details: readonly BankExportDetailLine[]): string;
}

export type GenericCsvColumnKey =
  | "batchNumber"
  | "runNumber"
  | "sequence"
  | "employeeNumber"
  | "employeeName"
  | "bankName"
  | "accountNumber"
  | "accountNumberMasked"
  | "amount"
  | "currency"
  | "splitType"
  | "beneficiaryName"
  | "branchCode"
  | "branchName";

export type GenericCsvConfiguration = {
  fileNamePrefix?: string;
  includeHeader?: boolean;
  maskAccountNumbers?: boolean;
  columns?: GenericCsvColumnKey[];
};

export const ALL_GENERIC_CSV_COLUMNS: GenericCsvColumnKey[] = [
  "batchNumber",
  "runNumber",
  "sequence",
  "employeeNumber",
  "employeeName",
  "bankName",
  "accountNumber",
  "accountNumberMasked",
  "amount",
  "currency",
  "splitType",
  "beneficiaryName",
  "branchCode",
  "branchName",
];

export const DEFAULT_GENERIC_CSV_COLUMNS: GenericCsvColumnKey[] = [
  "batchNumber",
  "runNumber",
  "sequence",
  "employeeNumber",
  "employeeName",
  "bankName",
  "accountNumber",
  "amount",
  "currency",
  "splitType",
];

export const DEFAULT_MANUAL_REGISTER_CONFIGURATION: GenericCsvConfiguration = {
  fileNamePrefix: "manual-payment-register",
  includeHeader: true,
  maskAccountNumbers: false,
  columns: DEFAULT_GENERIC_CSV_COLUMNS,
};


function parseConfiguration(value: unknown): GenericCsvConfiguration {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return { ...DEFAULT_MANUAL_REGISTER_CONFIGURATION };
  }
  const record = value as Record<string, unknown>;
  const columns = Array.isArray(record.columns)
    ? (record.columns.filter(
        (col): col is GenericCsvColumnKey =>
          typeof col === "string" &&
          ALL_GENERIC_CSV_COLUMNS.includes(col as GenericCsvColumnKey),
      ) as GenericCsvColumnKey[])
    : DEFAULT_GENERIC_CSV_COLUMNS;

  return {
    fileNamePrefix:
      typeof record.fileNamePrefix === "string"
        ? record.fileNamePrefix
        : "bank-export",
    includeHeader: record.includeHeader !== false,
    maskAccountNumbers: record.maskAccountNumbers === true,
    columns: columns.length > 0 ? columns : DEFAULT_GENERIC_CSV_COLUMNS,
  };
}

function cellForColumn(
  column: GenericCsvColumnKey,
  input: BankExportGenerateInput,
  detail: BankExportDetailLine,
  maskAccounts: boolean,
): string | number {
  switch (column) {
    case "batchNumber":
      return input.batchNumber;
    case "runNumber":
      return input.runNumber;
    case "sequence":
      return detail.sequence;
    case "employeeNumber":
      return detail.employeeNumber;
    case "employeeName":
      return detail.employeeName;
    case "bankName":
      return detail.bankName;
    case "accountNumber":
      if (maskAccounts) {
        return detail.accountNumberMasked;
      }
      return detail.accountNumber ?? detail.accountNumberMasked;
    case "accountNumberMasked":
      return detail.accountNumberMasked;
    case "amount":
      return detail.amount.toFixed(2);
    case "currency":
      return detail.currencyCode;
    case "splitType":
      return detail.allocationKind;
    case "beneficiaryName":
      return detail.beneficiaryName ?? "";
    case "branchCode":
      return detail.branchCode ?? "";
    case "branchName":
      return detail.branchName ?? "";
    default:
      return "";
  }
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function controlTotalFromDetails(
  details: readonly BankExportDetailLine[],
): number {
  return sumMoney(...details.map((row) => row.amount));
}

export function maskExportPreview(
  content: string,
  details: readonly BankExportDetailLine[],
): string {
  let preview = content;
  for (const detail of details) {
    if (detail.accountNumber && detail.accountNumber.length >= 4) {
      preview = preview.split(detail.accountNumber).join(detail.accountNumberMasked);
    }
  }
  return preview;
}

/**
 * Generic configurable CSV adapter — used for MANUAL_REGISTER and GENERIC_CSV.
 * Official bank-specific ACH layouts are intentionally not shipped.
 */
export class GenericCsvBankExportAdapter implements PayrollBankExportAdapter {
  readonly kind: "MANUAL_REGISTER" | "GENERIC_CSV";

  constructor(kind: "MANUAL_REGISTER" | "GENERIC_CSV" = "GENERIC_CSV") {
    this.kind = kind;
  }

  controlTotal(details: readonly BankExportDetailLine[]): number {
    return controlTotalFromDetails(details);
  }

  maskPreview(
    content: string,
    details: readonly BankExportDetailLine[],
  ): string {
    return maskExportPreview(content, details);
  }

  validate(input: BankExportGenerateInput): BankExportValidationResult {
    const errors: string[] = [];
    if (input.details.length === 0) {
      errors.push("Batch has no payment allocation details.");
    }
    for (const detail of input.details) {
      if (!(detail.amount > 0)) {
        errors.push(
          `Detail sequence ${detail.sequence} has a non-positive amount.`,
        );
      }
      if (!detail.accountNumberMasked) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing a masked account number.`,
        );
      }
    }
    return { ok: errors.length === 0, errors };
  }

  generate(input: BankExportGenerateInput): BankExportGenerateResult {
    const config = parseConfiguration(input.configurationJson);
    const columns = config.columns ?? DEFAULT_GENERIC_CSV_COLUMNS;
    const maskAccounts = config.maskAccountNumbers === true;
    const headerLabels = columns;
    const body = input.details.map((detail) =>
      columns.map((column) =>
        cellForColumn(column, input, detail, maskAccounts),
      ),
    );
    const rows = config.includeHeader === false ? body : [headerLabels, ...body];
    const content = toCsv(rows);
    const controlTotalAmount = this.controlTotal(input.details);
    const prefix = config.fileNamePrefix ?? "bank-export";
    const fileName = `${prefix}-${input.batchNumber}.csv`;

    return {
      fileName,
      mimeType: "text/csv; charset=utf-8",
      content,
      contentHash: hashContent(content),
      controlTotalAmount,
      detailCount: input.details.length,
      maskedPreview: this.maskPreview(content, input.details),
    };
  }
}

export function resolveBankExportAdapter(
  kind: BankExportAdapterKindCode | string,
): PayrollBankExportAdapter {
  if (kind === "FIRST_CITIZENS_MANUAL_WORKSHEET") {
    return new FirstCitizensManualWorksheetAdapter();
  }
  if (kind === "FIRST_CITIZENS_IMPORT") {
    return new FirstCitizensImportDisabledAdapter();
  }
  if (kind === "MANUAL_REGISTER" || kind === "GENERIC_CSV") {
    return new GenericCsvBankExportAdapter(kind);
  }
  return new GenericCsvBankExportAdapter("GENERIC_CSV");
}

export function ensureMaskedAccount(
  accountNumber: string | null | undefined,
  masked: string | null | undefined,
): string {
  if (masked && masked.trim()) {
    return masked;
  }
  if (accountNumber) {
    return maskAccountNumber(accountNumber);
  }
  return "••••";
}
