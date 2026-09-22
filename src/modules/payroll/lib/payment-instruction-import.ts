/**
 * Payment-instruction CSV/XLSX import: template, preview, validation, commit modes.
 */

import { roundToCents } from "@/src/modules/payroll/lib/money";
import {
  mapMethodToAllocationType,
  type PaymentAllocationMethod,
} from "@/src/modules/payroll/lib/payment-instructions";

export const PAYMENT_INSTRUCTION_IMPORT_COLUMNS = [
  "Employee Number",
  "Account Holder Name",
  "Financial Institution",
  "ABA/Routing Number",
  "Branch/Transit",
  "Account Number",
  "Account Type",
  "Allocation Method",
  "Allocation Value",
  "Priority",
  "Effective Start Date",
  "Effective End Date",
  "Verification Status",
] as const;

export type PaymentInstructionImportMode = "CREATE_ONLY" | "UPDATE_EXPLICIT";

export type PaymentInstructionImportRow = {
  rowNumber: number;
  employeeNumber: string;
  accountHolderName: string;
  financialInstitution: string;
  routingNumber: string;
  branchTransit: string;
  accountNumber: string;
  accountType: string;
  allocationMethod: string;
  allocationValue: string;
  priority: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  verificationStatus: string;
};

export type PaymentInstructionImportIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type ParsedPaymentInstructionImport = {
  employeeNumber: string;
  accountHolderName: string;
  financialInstitution: string;
  routingNumber: string | null;
  branchTransit: string | null;
  accountNumber: string;
  accountType: "SAVINGS" | "CHEQUING";
  allocationMethod: PaymentAllocationMethod;
  allocationValue: number | null;
  priority: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  verificationStatus: "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "FAILED";
  allocationType: "FIXED_AMOUNT" | "PERCENTAGE" | "REMAINDER";
};

export type PaymentInstructionImportPreview = {
  ok: boolean;
  mode: PaymentInstructionImportMode;
  rows: PaymentInstructionImportRow[];
  parsed: Array<ParsedPaymentInstructionImport | null>;
  issues: PaymentInstructionImportIssue[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
    duplicateRows: number;
  };
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const HEADER_ALIASES: Record<string, (typeof PAYMENT_INSTRUCTION_IMPORT_COLUMNS)[number]> =
  Object.fromEntries(
    PAYMENT_INSTRUCTION_IMPORT_COLUMNS.map((col) => [normalizeHeader(col), col]),
  );

export function paymentInstructionImportTemplateCsv(): string {
  return `${PAYMENT_INSTRUCTION_IMPORT_COLUMNS.join(",")}\n`;
}

export function mapImportHeaders(
  headers: readonly string[],
): { ok: true; indexByColumn: Map<string, number> } | { ok: false; missing: string[] } {
  const indexByColumn = new Map<string, number>();
  headers.forEach((header, index) => {
    const mapped = HEADER_ALIASES[normalizeHeader(header)];
    if (mapped) {
      indexByColumn.set(mapped, index);
    }
  });
  const missing = PAYMENT_INSTRUCTION_IMPORT_COLUMNS.filter(
    (col) => !indexByColumn.has(col),
  );
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true, indexByColumn };
}

function cell(
  cells: readonly string[],
  indexByColumn: Map<string, number>,
  column: (typeof PAYMENT_INSTRUCTION_IMPORT_COLUMNS)[number],
): string {
  const index = indexByColumn.get(column);
  if (index == null) {
    return "";
  }
  return (cells[index] ?? "").trim();
}

export function rowsFromDelimitedMatrix(
  matrix: readonly (readonly string[])[],
): { headersOk: true; rows: PaymentInstructionImportRow[] } | { headersOk: false; missing: string[] } {
  if (matrix.length === 0) {
    return { headersOk: false, missing: [...PAYMENT_INSTRUCTION_IMPORT_COLUMNS] };
  }
  const headerMap = mapImportHeaders(matrix[0] ?? []);
  if (!headerMap.ok) {
    return { headersOk: false, missing: headerMap.missing };
  }
  const rows: PaymentInstructionImportRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    if (cells.every((value) => !value.trim())) {
      continue;
    }
    rows.push({
      rowNumber: i + 1,
      employeeNumber: cell(cells, headerMap.indexByColumn, "Employee Number"),
      accountHolderName: cell(cells, headerMap.indexByColumn, "Account Holder Name"),
      financialInstitution: cell(
        cells,
        headerMap.indexByColumn,
        "Financial Institution",
      ),
      routingNumber: cell(cells, headerMap.indexByColumn, "ABA/Routing Number"),
      branchTransit: cell(cells, headerMap.indexByColumn, "Branch/Transit"),
      accountNumber: cell(cells, headerMap.indexByColumn, "Account Number"),
      accountType: cell(cells, headerMap.indexByColumn, "Account Type"),
      allocationMethod: cell(cells, headerMap.indexByColumn, "Allocation Method"),
      allocationValue: cell(cells, headerMap.indexByColumn, "Allocation Value"),
      priority: cell(cells, headerMap.indexByColumn, "Priority"),
      effectiveStartDate: cell(
        cells,
        headerMap.indexByColumn,
        "Effective Start Date",
      ),
      effectiveEndDate: cell(cells, headerMap.indexByColumn, "Effective End Date"),
      verificationStatus: cell(
        cells,
        headerMap.indexByColumn,
        "Verification Status",
      ),
    });
  }
  return { headersOk: true, rows };
}

function parseDate(value: string): Date | null {
  if (!value.trim()) {
    return null;
  }
  const iso = value.includes("/")
    ? (() => {
        const [d, m, y] = value.split(/[/-]/);
        if (d && m && y && y.length === 4) {
          return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        return value;
      })()
    : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAccountType(
  value: string,
): "SAVINGS" | "CHEQUING" | null {
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

function parseAllocationMethod(value: string): PaymentAllocationMethod | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (
    normalized === "FIXED" ||
    normalized === "FIXED_AMOUNT" ||
    normalized === "AMOUNT"
  ) {
    return "FIXED";
  }
  if (normalized === "PERCENTAGE" || normalized === "PERCENT" || normalized === "%") {
    return "PERCENTAGE";
  }
  if (
    normalized === "REMAINING" ||
    normalized === "REMAINDER" ||
    normalized === "REMAINING_BALANCE" ||
    normalized === "BALANCE"
  ) {
    return "REMAINING";
  }
  return null;
}

function parseVerificationStatus(
  value: string,
): "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "FAILED" {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (
    normalized === "VERIFIED" ||
    normalized === "PENDING" ||
    normalized === "FAILED" ||
    normalized === "NOT_REQUIRED"
  ) {
    return normalized;
  }
  if (!normalized) {
    return "PENDING";
  }
  return "PENDING";
}

export function previewPaymentInstructionImport(input: {
  rows: readonly PaymentInstructionImportRow[];
  mode: PaymentInstructionImportMode;
  knownEmployeeNumbers: ReadonlySet<string>;
  existingActiveKeys: ReadonlySet<string>;
}): PaymentInstructionImportPreview {
  const issues: PaymentInstructionImportIssue[] = [];
  const parsed: Array<ParsedPaymentInstructionImport | null> = [];
  const seenKeys = new Set<string>();
  let duplicateRows = 0;
  let errorRows = 0;
  let warningRows = 0;

  for (const row of input.rows) {
    const rowIssues: PaymentInstructionImportIssue[] = [];
    const push = (
      severity: "error" | "warning",
      code: string,
      message: string,
    ) => {
      rowIssues.push({ rowNumber: row.rowNumber, severity, code, message });
    };

    if (!row.employeeNumber) {
      push("error", "MISSING_EMPLOYEE_NUMBER", "Employee Number is required.");
    } else if (!input.knownEmployeeNumbers.has(row.employeeNumber)) {
      push(
        "error",
        "UNKNOWN_EMPLOYEE",
        `Employee Number ${row.employeeNumber} was not found.`,
      );
    }

    if (!row.accountHolderName) {
      push("error", "MISSING_HOLDER", "Account Holder Name is required.");
    }
    if (!row.financialInstitution) {
      push("error", "MISSING_FI", "Financial Institution is required.");
    }
    if (!row.accountNumber || row.accountNumber.replace(/\D/g, "").length < 4) {
      push("error", "INVALID_ACCOUNT", "Account Number must include at least 4 digits.");
    }

    const accountType = parseAccountType(row.accountType);
    if (!accountType) {
      push(
        "error",
        "INVALID_ACCOUNT_TYPE",
        "Account Type must be Savings or Chequing (ACH Payment Type).",
      );
    }

    const method = parseAllocationMethod(row.allocationMethod);
    if (!method) {
      push(
        "error",
        "INVALID_METHOD",
        "Allocation Method must be Fixed, Percentage, or Remaining.",
      );
    }

    let allocationValue: number | null = null;
    if (method === "FIXED" || method === "PERCENTAGE") {
      const parsedValue = Number(row.allocationValue);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        push(
          "error",
          "INVALID_VALUE",
          "Allocation Value must be a positive number for Fixed/Percentage.",
        );
      } else {
        allocationValue =
          method === "PERCENTAGE"
            ? parsedValue
            : roundToCents(parsedValue);
        if (method === "PERCENTAGE" && allocationValue > 100) {
          push("error", "PERCENT_OVER_100", "Percentage cannot exceed 100.");
        }
      }
    }

    const priority = Number(row.priority || "0");
    if (!Number.isFinite(priority)) {
      push("error", "INVALID_PRIORITY", "Priority must be a number.");
    }

    const effectiveFrom = parseDate(row.effectiveStartDate) ?? new Date();
    if (row.effectiveStartDate && !parseDate(row.effectiveStartDate)) {
      push("error", "INVALID_START", "Effective Start Date is invalid.");
    }
    const effectiveTo = row.effectiveEndDate
      ? parseDate(row.effectiveEndDate)
      : null;
    if (row.effectiveEndDate && !effectiveTo) {
      push("error", "INVALID_END", "Effective End Date is invalid.");
    }

    const dupKey = `${row.employeeNumber}|${row.accountNumber.replace(/\D/g, "")}|${row.routingNumber}`;
    if (seenKeys.has(dupKey)) {
      duplicateRows += 1;
      push("error", "DUPLICATE_IN_FILE", "Duplicate destination in this import file.");
    }
    seenKeys.add(dupKey);

    const existingKey = `${row.employeeNumber}|${row.accountNumber.replace(/\D/g, "")}`;
    if (input.existingActiveKeys.has(existingKey)) {
      if (input.mode === "CREATE_ONLY") {
        push(
          "error",
          "ACTIVE_EXISTS",
          "An active payment instruction already exists. Use UPDATE_EXPLICIT mode to replace (history preserved).",
        );
      } else {
        push(
          "warning",
          "WILL_SUPERSEDE",
          "Active instruction will be deactivated and superseded (history preserved).",
        );
      }
    }

    const verificationStatus = parseVerificationStatus(row.verificationStatus);
    if (
      row.verificationStatus &&
      !["VERIFIED", "PENDING", "FAILED", "NOT_REQUIRED", ""].includes(
        row.verificationStatus.trim().toUpperCase().replace(/\s+/g, "_"),
      )
    ) {
      push(
        "warning",
        "UNKNOWN_VERIFICATION",
        "Unrecognized verification status; defaulting to PENDING.",
      );
    }

    issues.push(...rowIssues);
    if (rowIssues.some((issue) => issue.severity === "error")) {
      errorRows += 1;
      parsed.push(null);
      continue;
    }
    if (rowIssues.some((issue) => issue.severity === "warning")) {
      warningRows += 1;
    }

    parsed.push({
      employeeNumber: row.employeeNumber,
      accountHolderName: row.accountHolderName,
      financialInstitution: row.financialInstitution,
      routingNumber: row.routingNumber || null,
      branchTransit: row.branchTransit || null,
      accountNumber: row.accountNumber,
      accountType: accountType!,
      allocationMethod: method!,
      allocationValue,
      priority: Number.isFinite(priority) ? priority : 0,
      effectiveFrom,
      effectiveTo,
      verificationStatus,
      allocationType: mapMethodToAllocationType(method!),
    });
  }

  const validRows = parsed.filter(Boolean).length;
  return {
    ok: errorRows === 0,
    mode: input.mode,
    rows: [...input.rows],
    parsed,
    issues,
    summary: {
      totalRows: input.rows.length,
      validRows,
      errorRows,
      warningRows,
      duplicateRows,
    },
  };
}
