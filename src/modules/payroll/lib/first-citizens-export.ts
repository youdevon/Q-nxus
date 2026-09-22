/**
 * First Citizens Business Online field mappings, manual-entry worksheet,
 * and NACHA type-6 ACH credit import file (94-char fixed-width).
 */

import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

import {
  normalizeFirstCitizensPaymentTypeLabel,
  resolveFirstCitizensAbaNumber,
  resolveFirstCitizensPaymentType,
} from "@/src/modules/payroll/lib/payment-instructions";
import { toCsv } from "@/src/modules/payroll/lib/csv";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import { maskAccountNumber } from "@/src/modules/payroll/lib/payslip-preview";
import {
  applyXlsxTableColumnFonts,
  scaleXlsxColumnWidth,
  XLSX_LAYOUT,
  xlsxTableFont,
} from "@/src/lib/xlsx-typography";
import {
  buildFcbLegacyAchRecord,
  formatAchAmountCents,
  formatAchReceiverName,
  formatAchSalaryReference,
  normalizeAchRoutingNumber,
} from "@/src/modules/payroll/lib/ach/ach-record-builder";
import { buildConfiguredPrefixTrace } from "@/src/modules/payroll/lib/ach/ach-trace-number";
import {
  buildFcbAchSalaryFileName,
  digitsOnly,
  FIRST_CITIZENS_ODFI_ROUTING as ACH_ODFI_ROUTING,
  padLeftFixed,
  padRightFixed,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";

export {
  digitsOnly,
  padLeftFixed,
  padRightFixed,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";

export {
  normalizeFirstCitizensPaymentTypeLabel,
  resolveFirstCitizensAbaNumber,
  resolveFirstCitizensPaymentType,
} from "@/src/modules/payroll/lib/payment-instructions";

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
  /** ISO date or Date — ACH effective / pay date (NACHA Individual ID). */
  effectivePaymentDate?: Date | string | null;
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

/** First Citizens ODFI routing (TT ACH participant list). */
export const FIRST_CITIZENS_ODFI_ROUTING = "010100013";

export type FirstCitizensConfiguration = {
  profileName?: string;
  originatingInstitution?: string;
  /** Masked debit account shown on control sheet only when full number unavailable. */
  balanceAccountMasked?: string;
  /**
   * Company / originator id — optional. Only used if an older FCB_Payroll_{id}_*
   * filename convention is reintroduced. Production filename is
   * FCB_ACH_SALARY_YYYYMMDD.txt (no company id).
   */
  companyAchId?: string | null;
  /**
   * Originating DFI routing for NACHA trace numbers (defaults to First Citizens).
   */
  odfiRoutingNumber?: string | null;
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
  /** Kill switch reserved for future Default Transactions format — not used by legacy no-header V1. */
  importFileDisabled?: boolean;
  importDisabledReason?: string;
};

export const DEFAULT_FIRST_CITIZENS_CONFIGURATION: FirstCitizensConfiguration = {
  profileName: "First Citizens payroll",
  originatingInstitution: "First Citizens",
  odfiRoutingNumber: FIRST_CITIZENS_ODFI_ROUTING,
  achType: "PPD",
  effectiveDateRule: "PERIOD_END",
  globalAddenda: "Payroll",
  discretionaryData: "",
  entryDescription: "Salary",
  transactionType: "Credit",
  defaultPurposeCode: "COMPENSATION OF EMPLOYEES",
  exportFormat: "MANUAL_WORKSHEET",
  exportVersion: "1",
  importFileDisabled: false,
  importDisabledReason: "",
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
    odfiRoutingNumber:
      typeof record.odfiRoutingNumber === "string"
        ? record.odfiRoutingNumber
        : DEFAULT_FIRST_CITIZENS_CONFIGURATION.odfiRoutingNumber,
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
    importFileDisabled: record.importFileDisabled === true,
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
  if (!config.balanceAccountMasked?.trim()) {
    errors.push(
      "Balance Account is required (masked label as shown on Business Online, e.g. xxx5620 - TTD).",
    );
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, config };
}

/** Normalize frozen batch header strings (legacy Salaries → Salary, blanks → defaults). */
export function normalizeFirstCitizensStoredHeader(input: {
  globalAddenda?: string | null;
  entryDescription?: string | null;
  discretionaryData?: string | null;
  purposeCode?: string | null;
  transactionType?: string | null;
  period?: FirstCitizensPeriodContext | null;
}): FirstCitizensResolvedHeader {
  let entryDescription = input.entryDescription?.trim() || "";
  if (!entryDescription || /^salaries$/i.test(entryDescription)) {
    entryDescription = DEFAULT_FIRST_CITIZENS_CONFIGURATION.entryDescription!;
  }
  return resolveFirstCitizensBatchHeader(
    {
      globalAddenda: input.globalAddenda ?? "",
      entryDescription,
      discretionaryData: input.discretionaryData ?? "",
      defaultPurposeCode: input.purposeCode ?? "",
      transactionType: input.transactionType === "Debit" ? "Debit" : "Credit",
    },
    input.period,
  );
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
  const abaNumber = resolveFirstCitizensAbaNumber({
    routingNumber: extras?.abaNumber ?? detail.abaNumber,
    bankName: detail.bankName,
  });
  const paymentType =
    resolveFirstCitizensPaymentType({
      paymentType: extras?.paymentType ?? detail.paymentType,
      accountType: extras?.accountType ?? detail.accountType,
    }) ?? "";

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

/**
 * NACHA Individual Name (22): first token + two spaces + remainder, truncated.
 * Matches live FCB samples (`KIRT  BAYNES`, `NATALIE  MAXWELL-REGIS`).
 */
export function formatNachaIndividualName(name: string): string {
  return formatAchReceiverName(name);
}

/** `SALARY 20260831` — entry description + effective date, 15 chars. */
export function formatNachaIndividualId(
  entryDescription: string,
  effectiveDate: Date | string,
): string {
  return formatAchSalaryReference(effectiveDate, entryDescription);
}

/**
 * NACHA transaction code for FCB payroll credits.
 * 22 = Checking Credit, 32 = Savings Credit.
 */
export function resolveNachaCreditTransactionCode(
  paymentType: string | null | undefined,
  accountType?: string | null,
): "22" | "32" | null {
  const resolved = resolveFirstCitizensPaymentType({
    paymentType,
    accountType,
  });
  if (resolved === "Checking Credit") {
    return "22";
  }
  if (resolved === "Savings Credit") {
    return "32";
  }
  return null;
}

/** Normalize ABA to exactly 9 digits; null when incomplete. */
export function normalizeNachaAbaNumber(
  value: string | null | undefined,
): string | null {
  return normalizeAchRoutingNumber(value);
}

export function formatNachaAmountCents(amount: number): string | null {
  return formatAchAmountCents(amount);
}

/**
 * Trace = ODFI routing first 8 digits + 7-digit sequence (NACHA).
 * Thin adapter — production exports should use AchTraceNumberGenerator.
 */
export function formatNachaTraceNumber(
  odfiRoutingNumber: string,
  sequence: number,
): string {
  return buildConfiguredPrefixTrace(odfiRoutingNumber, sequence);
}

export type NachaType6EntryInput = {
  transactionCode: "22" | "32";
  abaNumber: string;
  accountNumber: string;
  amount: number;
  individualId: string;
  individualName: string;
  sequence: number;
  odfiRoutingNumber: string;
};

/** One 94-character NACHA Entry Detail (record type 6). */
export function buildNachaType6Record(input: NachaType6EntryInput): string {
  return buildFcbLegacyAchRecord({
    transactionCode: input.transactionCode,
    routingNumber: input.abaNumber,
    accountNumber: input.accountNumber,
    amount: input.amount,
    individualId: input.individualId,
    receiverName: input.individualName,
    discretionaryData: "  ",
    addendaIndicator: "0",
    traceNumber: formatNachaTraceNumber(
      input.odfiRoutingNumber,
      input.sequence,
    ),
  });
}

export type BuildFirstCitizensNachaFileInput = {
  details: readonly FcbBankExportDetailLine[];
  config: FirstCitizensConfiguration;
  effectivePaymentDate: Date | string;
  /** File-date stamp in the filename (defaults to today UTC). */
  fileDate?: Date | string;
};

export function resolveFirstCitizensNachaEffectiveDate(
  input: FcbGenerateInput,
  config: FirstCitizensConfiguration,
): string | null {
  const explicit = input.effectivePaymentDate;
  if (explicit) {
    if (typeof explicit === "string") {
      return explicit.slice(0, 10);
    }
    return explicit.toISOString().slice(0, 10);
  }
  void config;
  return null;
}

/**
 * Build CRLF-delimited NACHA type-6 payroll credit file matching FCB samples.
 */
export function buildFirstCitizensNachaType6File(
  input: BuildFirstCitizensNachaFileInput,
): {
  content: string;
  fileName: string;
  detailCount: number;
  controlTotalAmount: number;
} {
  const header = resolveFirstCitizensBatchHeader(input.config);
  const odfi =
    digitsOnly(input.config.odfiRoutingNumber ?? "") ||
    ACH_ODFI_ROUTING;
  const individualId = formatNachaIndividualId(
    header.entryDescription,
    input.effectivePaymentDate,
  );

  const lines: string[] = [];
  for (const detail of input.details) {
    const txn = resolveNachaCreditTransactionCode(
      detail.paymentType,
      detail.accountType,
    );
    if (!txn) {
      throw new Error(
        `Detail sequence ${detail.sequence} is missing Savings/Chequing payment type.`,
      );
    }
    const aba = normalizeNachaAbaNumber(
      detail.abaNumber ??
        resolveFirstCitizensAbaNumber({ bankName: detail.bankName }),
    );
    if (!aba) {
      throw new Error(
        `Detail sequence ${detail.sequence} needs a 9-digit ABA / routing number.`,
      );
    }
    const accountNumber = detail.accountNumber?.trim() ?? "";
    if (!digitsOnly(accountNumber)) {
      throw new Error(
        `Detail sequence ${detail.sequence} is missing Account Number.`,
      );
    }
    lines.push(
      buildNachaType6Record({
        transactionCode: txn,
        abaNumber: aba,
        accountNumber,
        amount: detail.amount,
        individualId,
        individualName:
          detail.beneficiaryName?.trim() || detail.employeeName,
        sequence: detail.sequence,
        odfiRoutingNumber: odfi,
      }),
    );
  }

  const content = lines.map((line) => `${line}\r\n`).join("");
  return {
    content,
    fileName: buildFcbAchSalaryFileName(input.effectivePaymentDate),
    detailCount: lines.length,
    controlTotalAmount: controlTotalFromDetails(input.details),
  };
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
  const c = input.control;

  // Sheet 1 — copy onto Business Online ACH header fields (exact form order).
  const bankHeaderSheet = workbook.addWorksheet("Bank Header", {
    properties: { defaultRowHeight: XLSX_LAYOUT.defaultRowHeight },
    views: [{ zoomScale: XLSX_LAYOUT.viewZoom }],
  });
  const bankHeaderRows: Array<[string, string | number]> = [
    [
      "Instructions",
      "Copy these values onto First Citizens Business Online ACH header fields. NOT a bank import file.",
    ],
    ["Effective Date", formatFcbEffectiveDate(c.effectiveDate)],
    ["Balance Account", c.debitAccountMasked],
    ["Global Addenda", c.globalAddenda],
    ["Discretionary Data", c.discretionaryData],
    ["Entry Description", c.entryDescription],
    ["Transaction Type", c.transactionType],
    [
      "Total",
      c.currencyCode
        ? `${c.currencyCode} ${c.batchTotal.toFixed(2)}`
        : c.batchTotal.toFixed(2),
    ],
    ["Total No of Records", c.entryCount],
  ];
  for (const [label, value] of bankHeaderRows) {
    const row = bankHeaderSheet.addRow([label, value]);
    row.height = XLSX_LAYOUT.dataRowHeight;
  }
  applyXlsxTableColumnFonts(bankHeaderSheet, 2);
  bankHeaderSheet.getColumn(1).font = xlsxTableFont({ bold: true });
  bankHeaderSheet.getColumn(1).width = scaleXlsxColumnWidth(28, {
    min: 18,
    max: 48,
  });
  bankHeaderSheet.getColumn(2).width = scaleXlsxColumnWidth(72, {
    min: 36,
    max: 96,
  });

  // Sheet 2 — row grid matching the ACH table.
  const entriesSheet = workbook.addWorksheet("Manual Entry", {
    properties: { defaultRowHeight: XLSX_LAYOUT.defaultRowHeight },
    views: [
      {
        state: "frozen",
        ySplit: 1,
        zoomScale: XLSX_LAYOUT.viewZoom,
      },
    ],
  });
  entriesSheet.addRow([...FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS]);
  for (const row of input.entries) {
    const excelRow = entriesSheet.addRow([
      row.individualName,
      row.individualId,
      row.abaNumber,
      row.accountNumber,
      row.paymentType,
      row.purposeCode,
      Number(row.amount.toFixed(2)),
      row.addenda,
    ]);
    excelRow.height = XLSX_LAYOUT.dataRowHeight;
  }
  applyXlsxTableColumnFonts(
    entriesSheet,
    FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS.length,
  );
  entriesSheet.getRow(1).height = XLSX_LAYOUT.headerRowHeight;
  entriesSheet.getRow(1).font = xlsxTableFont({ bold: true });
  entriesSheet.getColumn(7).numFmt = "#,##0.00";
  for (let col = 1; col <= FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS.length; col += 1) {
    const header = FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS[col - 1] ?? "";
    entriesSheet.getColumn(col).width = scaleXlsxColumnWidth(
      Math.max(header.length + 2, 12),
      { min: 12, max: 40 },
    );
  }

  // Sheet 3 — internal control / audit.
  const controlSheet = workbook.addWorksheet("Control Summary", {
    properties: { defaultRowHeight: XLSX_LAYOUT.defaultRowHeight },
    views: [{ zoomScale: XLSX_LAYOUT.viewZoom }],
  });
  const controlRows: Array<[string, string | number]> = [
    ["Document", c.documentLabel],
    [
      "Warning",
      "Manual-entry worksheet for First Citizens Business Online — NOT a bank import file.",
    ],
    ["Organization", c.organizationName],
    ["Payroll period", c.payrollPeriod],
    ["Effective date (ISO)", c.effectiveDate],
    ["Balance Account", c.debitAccountMasked],
    ["Global Addenda", c.globalAddenda],
    ["Discretionary Data", c.discretionaryData],
    ["Entry Description", c.entryDescription],
    ["Transaction Type", c.transactionType],
    ["Purpose Code (row default)", c.purposeCode],
    ["Employee count", c.employeeCount],
    ["Entry count / Total No of Records", c.entryCount],
    ["Batch total", Number(c.batchTotal.toFixed(2))],
    ["Exported by", c.exportedBy],
    ["Export date/time", c.exportedAt],
    ["Batch reference", c.batchReference],
  ];
  for (const [label, value] of controlRows) {
    const row = controlSheet.addRow([label, value]);
    row.height = XLSX_LAYOUT.dataRowHeight;
  }
  applyXlsxTableColumnFonts(controlSheet, 2);
  controlSheet.getColumn(1).font = xlsxTableFont({ bold: true });
  controlSheet.getColumn(1).width = scaleXlsxColumnWidth(28, {
    min: 18,
    max: 48,
  });
  controlSheet.getColumn(2).width = scaleXlsxColumnWidth(72, {
    min: 36,
    max: 96,
  });
  const batchTotalRow = controlRows.findIndex(([label]) => label === "Batch total");
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
    if (!config.balanceAccountMasked?.trim()) {
      errors.push(
        "Balance Account is required on the export profile (masked label, e.g. xxx5620 - TTD).",
      );
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
      const resolvedPaymentType = resolveFirstCitizensPaymentType({
        paymentType: detail.paymentType,
        accountType: detail.accountType,
      });
      if (!resolvedPaymentType) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing Payment Type (set Savings or Chequing on the employee account).`,
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
      if (!entry.accountNumber.trim() || entry.accountNumber === "••••") {
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
 * Adapter for First Citizens NACHA type-6 ACH credit import files
 * (FCB_TT_LEGACY_NACHA_NO_HEADER_V1 → FCB_ACH_SALARY_YYYYMMDD.txt).
 */
export class FirstCitizensImportAdapter {
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
    const errors: string[] = [];
    const config = parseFirstCitizensConfiguration(input.configurationJson);

    // importFileDisabled historically blocked unconfirmed Default Transactions.
    // FCB_TT_LEGACY_NACHA_NO_HEADER_V1 (FCB_ACH_SALARY_*.txt) is the confirmed
    // production path and is gated by payroll ACH feature settings instead.

    const header = resolveFirstCitizensBatchHeader(config);
    if (!header.entryDescription.trim()) {
      errors.push("Entry Description is required (e.g. Salary).");
    }
    if (!resolveFirstCitizensNachaEffectiveDate(input, config)) {
      errors.push(
        "Effective payment date is required to build the NACHA Individual ID.",
      );
    }
    if (input.details.length === 0) {
      errors.push("Batch has no payment allocation details.");
    }
    if (input.details.length > 3000) {
      errors.push(
        "First Citizens import batches allow at most 3000 entries; split this batch.",
      );
    }

    for (const detail of input.details) {
      if (!(detail.amount > 0)) {
        errors.push(
          `Detail sequence ${detail.sequence} has a non-positive amount.`,
        );
      }
      if (!formatNachaAmountCents(detail.amount)) {
        errors.push(
          `Detail sequence ${detail.sequence} amount exceeds the NACHA 10-digit cents limit.`,
        );
      }
      const txn = resolveNachaCreditTransactionCode(
        detail.paymentType,
        detail.accountType,
      );
      if (!txn) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing Payment Type (set Savings or Chequing on the employee account).`,
        );
      }
      const aba = normalizeNachaAbaNumber(
        detail.abaNumber ??
          resolveFirstCitizensAbaNumber({ bankName: detail.bankName }),
      );
      if (!aba) {
        errors.push(
          `Detail sequence ${detail.sequence} needs a 9-digit ABA / routing number (not a bank name label).`,
        );
      }
      const accountDigits = digitsOnly(detail.accountNumber ?? "");
      if (!accountDigits) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing Account Number.`,
        );
      } else if (accountDigits.length > 17) {
        errors.push(
          `Detail sequence ${detail.sequence} account number exceeds 17 digits.`,
        );
      }
      const name = detail.beneficiaryName?.trim() || detail.employeeName;
      if (!name.trim()) {
        errors.push(
          `Detail sequence ${detail.sequence} is missing Individual Name.`,
        );
      }
    }

    return { ok: errors.length === 0, errors };
  }

  generate(input: FcbGenerateInput): FcbGenerateResult {
    const validation = this.validate(input);
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }

    const config = parseFirstCitizensConfiguration(input.configurationJson);
    const effectiveDate = resolveFirstCitizensNachaEffectiveDate(input, config)!;
    const built = buildFirstCitizensNachaType6File({
      details: input.details,
      config,
      effectivePaymentDate: effectiveDate,
    });

    return {
      fileName: built.fileName,
      mimeType: "text/plain; charset=utf-8",
      content: built.content,
      contentHash: hashContent(built.content),
      controlTotalAmount: built.controlTotalAmount,
      detailCount: built.detailCount,
      maskedPreview: this.maskPreview(built.content, input.details),
    };
  }
}

/** @deprecated Use FirstCitizensImportAdapter — kept as an alias for older imports. */
export const FirstCitizensImportDisabledAdapter = FirstCitizensImportAdapter;

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
