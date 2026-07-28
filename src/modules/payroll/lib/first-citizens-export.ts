/**
 * First Citizens Business Online field mappings + manual-entry worksheet.
 * Import-file generation stays disabled until the bank confirms Default Transactions layout.
 */

import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

import {
  firstCitizensPaymentType,
  normalizeFirstCitizensPaymentTypeLabel,
} from "@/src/modules/payroll/lib/payment-instructions";
import { toCsv } from "@/src/modules/payroll/lib/csv";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import { maskAccountNumber } from "@/src/modules/payroll/lib/payslip-preview";

export { normalizeFirstCitizensPaymentTypeLabel } from "@/src/modules/payroll/lib/payment-instructions";

/** Local shapes mirroring bank-export-adapter (avoids circular imports). */
export type FcbBankExportDetailLine = {
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
  abaNumber?: string | null;
  accountType?: string | null;
  paymentType?: string | null;
  purposeCode?: string | null;
  addenda?: string | null;
};

type FcbGenerateInput = {
  batchNumber: string;
  runNumber: string;
  currencyCode: string;
  details: FcbBankExportDetailLine[];
  configurationJson: unknown;
};

type FcbGenerateResult = {
  fileName: string;
  mimeType: string;
  content: string;
  contentHash: string;
  controlTotalAmount: number;
  detailCount: number;
  maskedPreview: string;
};

type FcbValidationResult = { ok: boolean; errors: string[] };

function controlTotalFromDetails(
  details: readonly FcbBankExportDetailLine[],
): number {
  return sumMoney(...details.map((row) => row.amount));
}

function maskExportPreview(
  content: string,
  details: readonly FcbBankExportDetailLine[],
): string {
  let preview = content;
  for (const detail of details) {
    if (detail.accountNumber && detail.accountNumber.length >= 4) {
      preview = preview
        .split(detail.accountNumber)
        .join(detail.accountNumberMasked);
    }
  }
  return preview;
}

/** Manual template column order from First Citizens ACH Template guide. */
export const FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS = [
  "Individual Name",
  "Individual ID",
  "ABA Number",
  "Account Number",
  "Payment Type",
  "Purpose Code",
  "Amount",
  "Addenda",
] as const;

export type FirstCitizensConfiguration = {
  profileName?: string;
  originatingInstitution?: string;
  /** Masked debit account shown on control sheet only when full number unavailable. */
  balanceAccountMasked?: string;
  companyAchId?: string | null;
  templateName?: string | null;
  /** PPD (payroll default) or CCD. */
  achType?: "PPD" | "CCD";
  effectiveDateRule?: "PERIOD_END" | "PAYMENT_DATE" | "EXPLICIT";
  /** Required on FCB ACH form (e.g. Payroll). */
  globalAddenda?: string;
  /** Often the payroll period label (e.g. July 2026). */
  discretionaryData?: string;
  /** Required on FCB ACH form (e.g. Salary). */
  entryDescription?: string;
  transactionType?: "Credit" | "Debit";
  defaultPurposeCode?: string;
  exportFormat?: string;
  exportVersion?: string;
  /** When true, import-file download is refused (default until bank confirms layout). */
  importFileDisabled?: boolean;
  importDisabledReason?: string;
};

export const DEFAULT_FIRST_CITIZENS_CONFIGURATION: FirstCitizensConfiguration = {
  profileName: "First Citizens payroll",
  originatingInstitution: "First Citizens",
  achType: "PPD",
  effectiveDateRule: "PERIOD_END",
  globalAddenda: "Payroll",
  discretionaryData: "",
  entryDescription: "Salary",
  transactionType: "Credit",
  defaultPurposeCode: "COMPENSATION OF EMPLOYEES",
  exportFormat: "MANUAL_WORKSHEET",
  exportVersion: "1",
  importFileDisabled: true,
  importDisabledReason:
    "First Citizens Default Transactions / NACHA import layout is not confirmed. Request the layout from businessonlinequeries@firstcitizenstt.com, then enable after a successful bank test.",
};

export type FirstCitizensPeriodContext = {
  periodName?: string | null;
  periodKey?: string | null;
  periodEnd?: Date | string | null;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Effective date as shown on First Citizens Business Online (DD/MM/YYYY). */
export function formatFcbEffectiveDate(value: Date | string): string {
  const iso =
    typeof value === "string"
      ? value.slice(0, 10)
      : value.toISOString().slice(0, 10);
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}/${month}/${year}`;
}

/**
 * Discretionary Data default from the payroll period
 * (matches live FCB batches like "July 2026").
 */
export function formatFcbDiscretionaryPeriod(
  period?: FirstCitizensPeriodContext | null,
): string {
  const named = period?.periodName?.trim();
  if (named) {
    return named;
  }

  const end = period?.periodEnd;
  if (end) {
    const iso =
      typeof end === "string" ? end.slice(0, 10) : end.toISOString().slice(0, 10);
    const [yearText, monthText] = iso.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    if (
      Number.isInteger(year) &&
      monthIndex >= 0 &&
      monthIndex < MONTH_NAMES.length
    ) {
      return `${MONTH_NAMES[monthIndex]} ${year}`;
    }
  }

  return period?.periodKey?.trim() ?? "";
}

export type FirstCitizensResolvedHeader = {
  globalAddenda: string;
  entryDescription: string;
  discretionaryData: string;
  transactionType: "Credit" | "Debit";
  purposeCode: string;
};

/**
 * Resolve batch header fields for the FCB ACH form.
 * Empty profile values fall back to bank-compliant defaults / period label.
 */
export function resolveFirstCitizensBatchHeader(
  config: FirstCitizensConfiguration,
  period?: FirstCitizensPeriodContext | null,
): FirstCitizensResolvedHeader {
  return {
    globalAddenda:
      config.globalAddenda?.trim() ||
      DEFAULT_FIRST_CITIZENS_CONFIGURATION.globalAddenda!,
    entryDescription:
      config.entryDescription?.trim() ||
      DEFAULT_FIRST_CITIZENS_CONFIGURATION.entryDescription!,
    discretionaryData:
      config.discretionaryData?.trim() || formatFcbDiscretionaryPeriod(period),
    transactionType: config.transactionType === "Debit" ? "Debit" : "Credit",
    purposeCode:
      config.defaultPurposeCode?.trim() ||
      DEFAULT_FIRST_CITIZENS_CONFIGURATION.defaultPurposeCode!,
  };
}

export type FirstCitizensEntryRow = {
  individualName: string;
  individualId: string;
  abaNumber: string;
  accountNumber: string;
  paymentType: string;
  purposeCode: string;
  amount: number;
  addenda: string;
};

export type FirstCitizensControlSummary = {
  organizationName: string;
  payrollPeriod: string;
  /** ISO YYYY-MM-DD (also formatted DD/MM/YYYY on the bank header block). */
  effectiveDate: string;
  debitAccountMasked: string;
  employeeCount: number;
  entryCount: number;
  batchTotal: number;
  exportedBy: string;
  exportedAt: string;
  batchReference: string;
  documentLabel: string;
  /** Bank ACH form header fields (copy onto Business Online). */
  globalAddenda: string;
  discretionaryData: string;
  entryDescription: string;
  transactionType: string;
  purposeCode: string;
  currencyCode?: string;
};

export function parseFirstCitizensConfiguration(
  value: unknown,
): FirstCitizensConfiguration {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return { ...DEFAULT_FIRST_CITIZENS_CONFIGURATION };
  }
  const record = value as Record<string, unknown>;
  const parsed: FirstCitizensConfiguration = {
    ...DEFAULT_FIRST_CITIZENS_CONFIGURATION,
    profileName:
      typeof record.profileName === "string"
        ? record.profileName
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.profileName,
    originatingInstitution:
      typeof record.originatingInstitution === "string"
        ? record.originatingInstitution
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.originatingInstitution,
    balanceAccountMasked:
      typeof record.balanceAccountMasked === "string"
        ? record.balanceAccountMasked
        : undefined,
    companyAchId:
      typeof record.companyAchId === "string" ? record.companyAchId : null,
    templateName:
      typeof record.templateName === "string" ? record.templateName : null,
    achType: record.achType === "CCD" ? "CCD" : "PPD",
    effectiveDateRule:
      record.effectiveDateRule === "PAYMENT_DATE" ||
      record.effectiveDateRule === "EXPLICIT"
        ? record.effectiveDateRule
        : "PERIOD_END",
    globalAddenda:
      typeof record.globalAddenda === "string"
        ? record.globalAddenda
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.globalAddenda,
    discretionaryData:
      typeof record.discretionaryData === "string"
        ? record.discretionaryData
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.discretionaryData,
    entryDescription:
      typeof record.entryDescription === "string"
        ? record.entryDescription
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.entryDescription,
    transactionType: record.transactionType === "Debit" ? "Debit" : "Credit",
    defaultPurposeCode:
      typeof record.defaultPurposeCode === "string"
        ? record.defaultPurposeCode
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.defaultPurposeCode,
    exportFormat:
      typeof record.exportFormat === "string"
        ? record.exportFormat
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.exportFormat,
    exportVersion:
      typeof record.exportVersion === "string"
        ? record.exportVersion
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.exportVersion,
    importFileDisabled: record.importFileDisabled !== false,
    importDisabledReason:
      typeof record.importDisabledReason === "string"
        ? record.importDisabledReason
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.importDisabledReason,
  };

  return normalizeFirstCitizensConfiguration(parsed);
}

/**
 * Upgrade legacy / blank First Citizens profile values to bank-form defaults.
 * - empty Global Addenda → Payroll
 * - empty / "Salaries" Entry Description → Salary
 */
export function normalizeFirstCitizensConfiguration(
  config: FirstCitizensConfiguration,
): FirstCitizensConfiguration {
  const globalAddenda =
    config.globalAddenda?.trim() ||
    DEFAULT_FIRST_CITIZENS_CONFIGURATION.globalAddenda!;
  let entryDescription = config.entryDescription?.trim() || "";
  if (!entryDescription || /^salaries$/i.test(entryDescription)) {
    entryDescription = DEFAULT_FIRST_CITIZENS_CONFIGURATION.entryDescription!;
  }
  const purposeCode =
    config.defaultPurposeCode?.trim() ||
    DEFAULT_FIRST_CITIZENS_CONFIGURATION.defaultPurposeCode!;

  return {
    ...config,
    globalAddenda,
    entryDescription,
    defaultPurposeCode: purposeCode,
    transactionType: config.transactionType === "Debit" ? "Debit" : "Credit",
    discretionaryData: config.discretionaryData?.trim() ?? "",
  };
}

/**
 * Validate + normalize configuration before persisting a First Citizens profile.
 */
export function prepareFirstCitizensConfigurationForStorage(
  value: unknown,
): { ok: true; config: FirstCitizensConfiguration } | { ok: false; errors: string[] } {
  const config = normalizeFirstCitizensConfiguration(
    parseFirstCitizensConfiguration(value),
  );
  const errors: string[] = [];
  if (!config.globalAddenda?.trim()) {
    errors.push("Global Addenda is required (e.g. Payroll).");
  }
  if (!config.entryDescription?.trim()) {
    errors.push("Entry Description is required (e.g. Salary).");
  }
  if (!config.defaultPurposeCode?.trim()) {
    errors.push("Purpose Code is required (e.g. COMPENSATION OF EMPLOYEES).");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, config };
}

export function mapDetailToFirstCitizensEntry(
  detail: FcbBankExportDetailLine,
  config: FirstCitizensConfiguration,
  extras?: {
    abaNumber?: string | null;
    accountType?: string | null;
    paymentType?: string | null;
    purposeCode?: string | null;
    addenda?: string | null;
  },
): FirstCitizensEntryRow {
  const header = resolveFirstCitizensBatchHeader(config);
  const abaNumber = (
    extras?.abaNumber ??
    detail.abaNumber ??
    detail.bankName ??
    ""
  ).trim();
  const paymentType =
    normalizeFirstCitizensPaymentTypeLabel(
      extras?.paymentType ?? detail.paymentType,
    ) ??
    firstCitizensPaymentType(
      extras?.accountType ?? detail.accountType ?? "SAVINGS",
    );

  return {
    individualName: detail.beneficiaryName?.trim() || detail.employeeName,
    individualId: detail.employeeNumber,
    abaNumber,
    accountNumber: detail.accountNumber ?? detail.accountNumberMasked,
    paymentType,
    purposeCode:
      extras?.purposeCode?.trim() ||
      detail.purposeCode?.trim() ||
      header.purposeCode,
    amount: detail.amount,
    addenda:
      extras?.addenda?.trim() ||
      detail.addenda?.trim() ||
      header.globalAddenda,
  };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function buildFirstCitizensManualCsv(
  entries: readonly FirstCitizensEntryRow[],
): string {
  const body = entries.map((row) => [
    row.individualName,
    row.individualId,
    row.abaNumber,
    row.accountNumber,
    row.paymentType,
    row.purposeCode,
    row.amount.toFixed(2),
    row.addenda,
  ]);
  return toCsv([[...FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS], ...body]);
}

export async function buildFirstCitizensManualWorkbook(input: {
  entries: readonly FirstCitizensEntryRow[];
  control: FirstCitizensControlSummary;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Q-NXUS";
  workbook.created = new Date();

  const entriesSheet = workbook.addWorksheet("Manual Entry");
  entriesSheet.addRow([...FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS]);
  for (const row of input.entries) {
    entriesSheet.addRow([
      row.individualName,
      row.individualId,
      row.abaNumber,
      row.accountNumber,
      row.paymentType,
      row.purposeCode,
      Number(row.amount.toFixed(2)),
      row.addenda,
    ]);
  }
  entriesSheet.getRow(1).font = { bold: true };
  entriesSheet.getColumn(7).numFmt = "#,##0.00";

  const controlSheet = workbook.addWorksheet("Control Summary");
  const c = input.control;
  const headerRows: Array<[string, string | number]> = [
    ["Document", c.documentLabel],
    [
      "Warning",
      "Manual-entry worksheet for First Citizens Business Online — NOT a bank import file.",
    ],
    ["", ""],
    ["Bank ACH header (enter on Business Online)", ""],
    ["Effective Date", formatFcbEffectiveDate(c.effectiveDate)],
    ["Balance Account", c.debitAccountMasked],
    ["Global Addenda", c.globalAddenda],
    ["Discretionary Data", c.discretionaryData],
    ["Entry Description", c.entryDescription],
    ["Transaction Type", c.transactionType],
    ["Purpose Code", c.purposeCode],
    [
      "Total",
      c.currencyCode
        ? `${c.currencyCode} ${c.batchTotal.toFixed(2)}`
        : c.batchTotal.toFixed(2),
    ],
    ["Total No of Records", c.entryCount],
    ["", ""],
    ["Organization", c.organizationName],
    ["Payroll period", c.payrollPeriod],
    ["Effective date (ISO)", c.effectiveDate],
    ["Debit account (masked)", c.debitAccountMasked],
    ["Employee count", c.employeeCount],
    ["Entry count", c.entryCount],
    ["Batch total", Number(c.batchTotal.toFixed(2))],
    ["Exported by", c.exportedBy],
    ["Export date/time", c.exportedAt],
    ["Batch reference", c.batchReference],
  ];

  for (const [label, value] of headerRows) {
    controlSheet.addRow([label, value]);
  }
  controlSheet.getColumn(1).font = { bold: true };
  controlSheet.getColumn(2).width = 72;
  // Batch total numeric row
  const batchTotalRow = headerRows.findIndex(
    ([label]) => label === "Batch total",
  );
  if (batchTotalRow >= 0) {
    controlSheet.getRow(batchTotalRow + 1).getCell(2).numFmt = "#,##0.00";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Adapter for First Citizens manual-entry worksheet (CSV body; XLSX built separately).
 */
export class FirstCitizensManualWorksheetAdapter {
  readonly kind = "FIRST_CITIZENS_MANUAL_WORKSHEET" as const;

  controlTotal(details: readonly FcbBankExportDetailLine[]): number {
    return controlTotalFromDetails(details);
  }

  maskPreview(
    content: string,
    details: readonly FcbBankExportDetailLine[],
  ): string {
    return maskExportPreview(content, details);
  }

  validate(input: FcbGenerateInput): FcbValidationResult {
    const errors: string[] = [];
    const config = parseFirstCitizensConfiguration(input.configurationJson);
    const header = resolveFirstCitizensBatchHeader(config);

    if (!header.globalAddenda.trim()) {
      errors.push(
        "Global Addenda is required on the First Citizens ACH form (e.g. Payroll).",
      );
    }
    if (!header.entryDescription.trim()) {
      errors.push(
        "Entry Description is required on the First Citizens ACH form (e.g. Salary).",
      );
    }
    if (!header.purposeCode.trim()) {
      errors.push("Purpose Code is required (e.g. COMPENSATION OF EMPLOYEES).");
    }

    if (input.details.length === 0) {
      errors.push("Batch has no payment allocation details.");
    }
    if (input.details.length > 3000) {
      errors.push(
        "First Citizens import batches allow at most 3000 entries; split this batch.",
      );
    }
    const purposeCodes = new Set<string>();
    for (const detail of input.details) {
      if (!(detail.amount > 0)) {
        errors.push(
          `Detail sequence ${detail.sequence} has a non-positive amount.`,
        );
      }
      const entry = mapDetailToFirstCitizensEntry(detail, config, {
        abaNumber: detail.abaNumber,
        accountType: detail.accountType,
        paymentType: detail.paymentType,
        purposeCode: detail.purposeCode,
        addenda: detail.addenda,
      });
      purposeCodes.add(entry.purposeCode);
      if (!entry.individualName.trim()) {
        errors.push(`Detail sequence ${detail.sequence} is missing Individual Name.`);
      }
      if (!entry.individualId.trim()) {
        errors.push(`Detail sequence ${detail.sequence} is missing Individual ID.`);
      }
      if (!entry.abaNumber.trim()) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing ABA / institution identifier.`,
        );
      }
      if (!entry.accountNumber.trim()) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing Account Number.`,
        );
      }
      if (!entry.paymentType.trim()) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing Payment Type.`,
        );
      }
      if (!entry.addenda.trim()) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing Addenda (uses Global Addenda).`,
        );
      }
    }
    if (purposeCodes.size > 1) {
      errors.push(
        "Purpose codes differ across entries. Use one consistent purpose code for the batch.",
      );
    }
    return { ok: errors.length === 0, errors };
  }

  generate(input: FcbGenerateInput): FcbGenerateResult {
    const config = parseFirstCitizensConfiguration(input.configurationJson);
    const entries = input.details.map((detail) =>
      mapDetailToFirstCitizensEntry(detail, config, {
        abaNumber: detail.abaNumber,
        accountType: detail.accountType,
        paymentType: detail.paymentType,
        purposeCode: detail.purposeCode,
        addenda: detail.addenda,
      }),
    );
    const content = buildFirstCitizensManualCsv(entries);
    return {
      fileName: `fcb-manual-entry-${input.batchNumber}.csv`,
      mimeType: "text/csv; charset=utf-8",
      content,
      contentHash: hashContent(content),
      controlTotalAmount: this.controlTotal(input.details),
      detailCount: input.details.length,
      maskedPreview: this.maskPreview(content, input.details),
    };
  }
}

/**
 * Placeholder adapter — never emits a file labeled as First Citizens compatible.
 */
export class FirstCitizensImportDisabledAdapter {
  readonly kind = "FIRST_CITIZENS_IMPORT" as const;

  controlTotal(details: readonly FcbBankExportDetailLine[]): number {
    return controlTotalFromDetails(details);
  }

  maskPreview(
    content: string,
    details: readonly FcbBankExportDetailLine[],
  ): string {
    return maskExportPreview(content, details);
  }

  validate(input: FcbGenerateInput): FcbValidationResult {
    const config = parseFirstCitizensConfiguration(input.configurationJson);
    return {
      ok: false,
      errors: [
        config.importDisabledReason ??
          DEFAULT_FIRST_CITIZENS_CONFIGURATION.importDisabledReason!,
      ],
    };
  }

  generate(_input: FcbGenerateInput): FcbGenerateResult {
    void _input;
    throw new Error(
      "First Citizens import file generation is disabled until the bank confirms the file layout.",
    );
  }
}

export function maskDebitAccountForControl(
  accountNumber: string | null | undefined,
  fallbackMasked?: string | null,
): string {
  if (fallbackMasked?.trim()) {
    return fallbackMasked;
  }
  if (accountNumber?.trim()) {
    return maskAccountNumber(accountNumber);
  }
  return "••••";
}
