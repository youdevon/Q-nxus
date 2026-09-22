/**
 * Sync Employee NIS / BIR numbers from a spreadsheet export.
 *
 * Reads an XLSX file, matches rows to employees (employee # preferred, else name),
 * and updates only Employee.nisNumber and Employee.birNumber.
 *
 * Supports:
 * - Plain tabular sheets (header row 1)
 * - Styled report exports with metadata rows before the table
 *   (e.g. leave balance roster, NIS detail, employee directory exports)
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/sync-employee-statutory-from-xlsx.ts \
 *     --xlsx="/path/to/file.xlsx"
 *   npx tsx --env-file=.env scripts/sync-employee-statutory-from-xlsx.ts \
 *     --xlsx="/path/to/file.xlsx" --apply
 *
 * Default is dry-run (report only). Pass --apply to write Employee rows.
 */
import "dotenv/config";
import { resolve } from "node:path";

import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";

const DEFAULT_XLSX =
  "/Users/devon/Downloads/leave-balance-roster-2026-08-19.xlsx";

type ParsedRow = {
  rowNumber: number;
  employeeNumber: string | null;
  employeeName: string | null;
  nisNumber: string | null;
  birNumber: string | null;
};

type ColumnMap = {
  employeeNumber: number;
  employeeName: number;
  firstName: number;
  lastName: number;
  nisNumber: number | null;
  birNumber: number | null;
};

type MatchStatus = "matched" | "unmatched" | "ambiguous";

type MatchResult = {
  source: ParsedRow;
  status: MatchStatus;
  employee?: {
    id: string;
    organizationId: string;
    employeeNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    nisNumber: string | null;
    birNumber: string | null;
  };
  reasons: string[];
  nisChange: string | null;
  birChange: string | null;
  wouldUpdate: boolean;
};

function parseArgs(argv: string[]) {
  let xlsxPath = DEFAULT_XLSX;
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg.startsWith("--xlsx=")) {
      xlsxPath = arg.slice("--xlsx=".length);
      continue;
    }
    if (arg === "--xlsx") {
      xlsxPath = argv[++i] ?? xlsxPath;
      continue;
    }
  }
  return { xlsxPath: resolve(xlsxPath), apply };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("").trim();
    }
    if ("result" in value) {
      return cellText(value.result as ExcelJS.CellValue);
    }
  }
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumn(
  headers: Map<number, string>,
  aliases: string[],
  options?: { exclude?: RegExp },
): number | null {
  for (const [col, header] of headers) {
    const normalized = normalizeHeader(header);
    if (options?.exclude?.test(normalized)) continue;
    for (const alias of aliases) {
      if (normalized === alias || normalized.includes(alias)) {
        return col;
      }
    }
  }
  return null;
}

const EMPLOYEE_NUMBER_ALIASES = [
  "employee #",
  "employee number",
  "employee no",
  "emp #",
  "emp no",
  "staff #",
  "staff number",
  "individual id",
  "no",
];

/** National ID columns (e.g. "ID#") must not be treated as HR employee numbers. */
const EMPLOYEE_NUMBER_EXCLUDE = /\bid #?\b|\bnational id\b|\bpassport\b/;

const FIRST_NAME_ALIASES = ["firstname", "first name", "given name", "forename"];

const LAST_NAME_ALIASES = [
  "surname",
  "lastname",
  "last name",
  "family name",
];

const EMPLOYEE_NAME_ALIASES = [
  "employee",
  "employee name",
  "full name",
  "individual name",
];

const EMPLOYEE_NAME_EXCLUDE = /\bsurname\b|\blast name\b|\bfamily name\b/;

const NIS_ALIASES = [
  "nis #",
  "nis number",
  "nis no",
  "nis",
  "social security",
  "ssn",
];

const BIR_ALIASES = [
  "bir #",
  "bir number",
  "bir no",
  "bir",
  "tax id",
  "tin",
];

/** "DATE OF BIRTH" must not match BIR statutory columns. */
const BIR_EXCLUDE = /\bdate of birth\b|\bdob\b|\bbirth date\b/;

function detectHeaderRow(
  worksheet: ExcelJS.Worksheet,
): { headerRow: number; columns: ColumnMap; headers: Map<number, string> } | null {
  const maxScan = Math.min(worksheet.rowCount, 30);

  for (let rowNum = 1; rowNum <= maxScan; rowNum += 1) {
    const headers = new Map<number, string>();
    worksheet.getRow(rowNum).eachCell({ includeEmpty: false }, (cell, col) => {
      const text = cellText(cell.value);
      if (text) headers.set(col, text);
    });
    if (headers.size < 2) continue;

    const employeeNumber = findColumn(headers, EMPLOYEE_NUMBER_ALIASES, {
      exclude: EMPLOYEE_NUMBER_EXCLUDE,
    });
    const employeeName = findColumn(headers, EMPLOYEE_NAME_ALIASES, {
      exclude: EMPLOYEE_NAME_EXCLUDE,
    });
    const firstName = findColumn(headers, FIRST_NAME_ALIASES);
    const lastName = findColumn(headers, LAST_NAME_ALIASES);
    const nisNumber = findColumn(headers, NIS_ALIASES);
    const birNumber = findColumn(headers, BIR_ALIASES, {
      exclude: BIR_EXCLUDE,
    });

    const hasIdentity =
      employeeNumber != null ||
      employeeName != null ||
      firstName != null ||
      lastName != null;
    const hasStatutory = nisNumber != null || birNumber != null;

    if (hasIdentity && hasStatutory) {
      return {
        headerRow: rowNum,
        columns: {
          employeeNumber: employeeNumber ?? -1,
          employeeName: employeeName ?? -1,
          firstName: firstName ?? -1,
          lastName: lastName ?? -1,
          nisNumber,
          birNumber,
        },
        headers,
      };
    }
  }

  return null;
}

function nullableStatutory(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateStatutoryNumber(
  field: "NIS" | "BIR",
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 64) {
    return `${field} exceeds 64 characters`;
  }
  if (/[\x00-\x1f]/.test(trimmed)) {
    return `${field} contains invalid control characters`;
  }
  return null;
}

function parseWorksheet(
  worksheet: ExcelJS.Worksheet,
): {
  headerRow: number;
  columns: ColumnMap;
  headers: Map<number, string>;
  rows: ParsedRow[];
} {
  const detected = detectHeaderRow(worksheet);
  if (!detected) {
    // Fall back: report first table-like header row for diagnostics.
    for (let rowNum = 1; rowNum <= Math.min(worksheet.rowCount, 30); rowNum += 1) {
      const headers = new Map<number, string>();
      worksheet.getRow(rowNum).eachCell({ includeEmpty: false }, (cell, col) => {
        const text = cellText(cell.value);
        if (text) headers.set(col, text);
      });
      if (headers.size >= 3) {
        throw new Error(
          `Could not find NIS/BIR columns in sheet "${worksheet.name}". ` +
            `Nearest header row ${rowNum}: ${[...headers.values()].join(" | ")}`,
        );
      }
    }
    throw new Error(
      `Could not find a data table with NIS/BIR columns in sheet "${worksheet.name}".`,
    );
  }

  const { headerRow, columns, headers } = detected;
  const rows: ParsedRow[] = [];

  for (let rowNum = headerRow + 1; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const employeeNumber =
      columns.employeeNumber > 0
        ? cellText(row.getCell(columns.employeeNumber).value) || null
        : null;
    const firstName =
      columns.firstName > 0
        ? cellText(row.getCell(columns.firstName).value) || null
        : null;
    const lastName =
      columns.lastName > 0
        ? cellText(row.getCell(columns.lastName).value) || null
        : null;
    let employeeName =
      columns.employeeName > 0
        ? cellText(row.getCell(columns.employeeName).value) || null
        : null;
    if (columns.firstName > 0 && columns.lastName > 0) {
      const combined = [firstName, lastName].filter(Boolean).join(" ") || null;
      if (combined) employeeName = combined;
    } else if (!employeeName && (firstName || lastName)) {
      employeeName = [firstName, lastName].filter(Boolean).join(" ") || null;
    }
    const nisNumber =
      columns.nisNumber != null
        ? nullableStatutory(cellText(row.getCell(columns.nisNumber).value))
        : null;
    const birNumber =
      columns.birNumber != null
        ? nullableStatutory(cellText(row.getCell(columns.birNumber).value))
        : null;

    if (!employeeNumber && !employeeName && !nisNumber && !birNumber) {
      continue;
    }

    rows.push({
      rowNumber: rowNum,
      employeeNumber,
      employeeName,
      nisNumber,
      birNumber,
    });
  }

  return { headerRow, columns, headers, rows };
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLooselyMatch(sourceName: string, employeeName: string): boolean {
  const a = normalizeName(sourceName);
  const b = normalizeName(employeeName);
  if (!a || !b) return false;
  if (a === b) return true;

  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = new Set(b.split(" ").filter(Boolean));
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      shared += 1;
      continue;
    }
    for (const other of tokensB) {
      if (token.startsWith(other) || other.startsWith(token)) {
        shared += 1;
        break;
      }
    }
  }
  return shared >= Math.min(2, tokensA.length, tokensB.size);
}

function maskStatutory(value: string | null | undefined): string {
  if (!value?.trim()) return "(empty)";
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

function formatChange(
  label: string,
  before: string | null,
  after: string | null,
): string {
  return `${label} ${maskStatutory(before)} → ${maskStatutory(after)}`;
}

function dedupeRows(rows: ParsedRow[]): ParsedRow[] {
  const byKey = new Map<string, ParsedRow>();

  for (const row of rows) {
    const key =
      row.employeeNumber?.trim() ||
      (row.employeeName ? normalizeName(row.employeeName) : `row:${row.rowNumber}`);

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    byKey.set(key, {
      ...existing,
      nisNumber: row.nisNumber ?? existing.nisNumber,
      birNumber: row.birNumber ?? existing.birNumber,
      employeeName: row.employeeName ?? existing.employeeName,
      employeeNumber: row.employeeNumber ?? existing.employeeNumber,
    });
  }

  return [...byKey.values()];
}

function resolveChanges(
  employee: NonNullable<MatchResult["employee"]>,
  source: ParsedRow,
): {
  reasons: string[];
  nisChange: string | null;
  birChange: string | null;
  patch: { nisNumber?: string; birNumber?: string };
  wouldUpdate: boolean;
} {
  const reasons: string[] = [];
  const patch: { nisNumber?: string; birNumber?: string } = {};
  let nisChange: string | null = null;
  let birChange: string | null = null;

  const currentNis = employee.nisNumber?.trim() || null;
  const currentBir = employee.birNumber?.trim() || null;

  if (source.nisNumber != null) {
    const validationError = validateStatutoryNumber("NIS", source.nisNumber);
    if (validationError) {
      reasons.push(validationError);
    } else if (!source.nisNumber && currentNis) {
      reasons.push("Skip NIS: spreadsheet blank but employee already has a value");
    } else if (source.nisNumber !== currentNis) {
      nisChange = formatChange("NIS", currentNis, source.nisNumber);
      patch.nisNumber = source.nisNumber;
    }
  }

  if (source.birNumber != null) {
    const validationError = validateStatutoryNumber("BIR", source.birNumber);
    if (validationError) {
      reasons.push(validationError);
    } else if (!source.birNumber && currentBir) {
      reasons.push("Skip BIR: spreadsheet blank but employee already has a value");
    } else if (source.birNumber !== currentBir) {
      birChange = formatChange("BIR", currentBir, source.birNumber);
      patch.birNumber = source.birNumber;
    }
  }

  if (
    source.nisNumber == null &&
    source.birNumber == null &&
    reasons.length === 0
  ) {
    reasons.push("No NIS/BIR values in spreadsheet row");
  }

  const wouldUpdate = Object.keys(patch).length > 0;

  if (!wouldUpdate && reasons.length === 0) {
    reasons.push("NIS/BIR already match spreadsheet");
  }

  return { reasons, nisChange, birChange, patch, wouldUpdate };
}

async function main() {
  const { xlsxPath, apply } = parseArgs(process.argv.slice(2));
  console.log(`XLSX: ${xlsxPath}`);
  console.log(`Mode: ${apply ? "APPLY (will write)" : "DRY-RUN (report only)"}\n`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Workbook has no worksheets.");
  }

  console.log(`Sheet: "${worksheet.name}" (${worksheet.rowCount} rows)\n`);

  const parsed = parseWorksheet(worksheet);
  const headerLabels = [...parsed.headers.entries()]
    .sort(([a], [b]) => a - b)
    .map(([col, label]) => ({ col, label }));

  console.log("=== Columns found ===");
  console.log(`Header row: ${parsed.headerRow}`);
  for (const { col, label } of headerLabels) {
    const role =
      col === parsed.columns.employeeNumber
        ? " [employee #]"
        : col === parsed.columns.employeeName
          ? " [employee name]"
          : col === parsed.columns.nisNumber
            ? " [NIS]"
            : col === parsed.columns.birNumber
              ? " [BIR]"
              : col === parsed.columns.firstName
                ? " [first name]"
                : col === parsed.columns.lastName
                  ? " [last name]"
                  : "";
    console.log(`  C${col}: ${label}${role}`);
  }
  console.log("");

  const uniqueRows = dedupeRows(parsed.rows);
  console.log(
    `Parsed ${parsed.rows.length} data row(s); ${uniqueRows.length} unique employee row(s) after dedupe.\n`,
  );

  const employees = await prisma.employee.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      nisNumber: true,
      birNumber: true,
    },
  });

  const byNumber = new Map(employees.map((e) => [e.employeeNumber, e]));
  const byNormalizedName = new Map<string, typeof employees>();
  for (const employee of employees) {
    const displayName = [employee.firstName, employee.middleName, employee.lastName]
      .filter(Boolean)
      .join(" ");
    const key = normalizeName(displayName);
    const bucket = byNormalizedName.get(key) ?? [];
    bucket.push(employee);
    byNormalizedName.set(key, bucket);
  }

  const results: MatchResult[] = [];

  for (const source of uniqueRows) {
    let employee: (typeof employees)[number] | undefined;
    let status: MatchStatus = "unmatched";
    const reasons: string[] = [];
    let employeeNumberMatched = false;

    if (source.employeeNumber) {
      employee = byNumber.get(source.employeeNumber);
      if (employee) {
        employeeNumberMatched = true;
        status = "matched";
        if (source.employeeName) {
          const hrName = [employee.firstName, employee.middleName, employee.lastName]
            .filter(Boolean)
            .join(" ");
          if (!namesLooselyMatch(source.employeeName, hrName)) {
            status = "ambiguous";
            reasons.push(
              `Name mismatch: sheet "${source.employeeName}" vs HR "${hrName}" (#${employee.employeeNumber})`,
            );
          }
        }
      }
    }

    if (!employee && source.employeeName) {
      const candidates = byNormalizedName.get(normalizeName(source.employeeName)) ?? [];
      const looseMatches = employees.filter((e) => {
        const hrName = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ");
        return namesLooselyMatch(source.employeeName!, hrName);
      });

      const uniqueCandidates = [
        ...new Map(
          [...candidates, ...looseMatches].map((e) => [e.id, e]),
        ).values(),
      ];

      if (uniqueCandidates.length === 1) {
        employee = uniqueCandidates[0];
        status = "matched";
        if (
          employeeNumberMatched &&
          source.employeeNumber &&
          employee.employeeNumber !== source.employeeNumber
        ) {
          status = "ambiguous";
          reasons.push(
            `Employee # mismatch: sheet ${source.employeeNumber} vs HR ${employee.employeeNumber}`,
          );
        }
      } else if (uniqueCandidates.length > 1) {
        status = "ambiguous";
        reasons.push(
          `Multiple name matches: ${uniqueCandidates
            .map((e) => `#${e.employeeNumber} ${e.firstName} ${e.lastName}`)
            .join("; ")}`,
        );
      } else if (!source.employeeNumber) {
        reasons.push(`No employee match for name "${source.employeeName}"`);
      } else {
        reasons.push(
          `No employee match for #${source.employeeNumber} or name "${source.employeeName}"`,
        );
      }
    }

    if (!employee && !source.employeeNumber && !source.employeeName) {
      reasons.push("Row missing employee # and name");
    }

    if (!employee) {
      results.push({
        source,
        status,
        reasons,
        nisChange: null,
        birChange: null,
        wouldUpdate: false,
      });
      continue;
    }

    if (status === "ambiguous") {
      results.push({
        source,
        status,
        employee,
        reasons,
        nisChange: null,
        birChange: null,
        wouldUpdate: false,
      });
      continue;
    }

    const resolved = resolveChanges(employee, source);
    results.push({
      source,
      status,
      employee,
      reasons: resolved.reasons,
      nisChange: resolved.nisChange,
      birChange: resolved.birChange,
      wouldUpdate: resolved.wouldUpdate,
    });
  }

  console.log("=== Match report ===\n");
  let matched = 0;
  let unmatched = 0;
  let ambiguous = 0;
  let wouldUpdate = 0;
  let alreadyCurrent = 0;

  for (const result of results) {
    if (result.status === "unmatched") unmatched += 1;
    else if (result.status === "ambiguous") ambiguous += 1;
    else matched += 1;

    if (result.wouldUpdate) wouldUpdate += 1;
    else if (result.status === "matched") alreadyCurrent += 1;

    const sheetLabel = [
      result.source.employeeNumber ? `#${result.source.employeeNumber}` : null,
      result.source.employeeName ? `"${result.source.employeeName}"` : null,
      `row ${result.source.rowNumber}`,
    ]
      .filter(Boolean)
      .join(" ");

    const empLabel = result.employee
      ? `#${result.employee.employeeNumber} ${[result.employee.firstName, result.employee.lastName].join(" ")}`
      : "(no HR match)";

    console.log(`[${result.status.toUpperCase()}] ${sheetLabel} → ${empLabel}`);
    if (result.nisChange) console.log(`  · ${result.nisChange}`);
    if (result.birChange) console.log(`  · ${result.birChange}`);
    for (const reason of result.reasons) {
      console.log(`  · ${reason}`);
    }
    console.log("");
  }

  console.log("=== Summary ===");
  console.log(`Sheet rows (unique employees): ${uniqueRows.length}`);
  console.log(`Matched:                   ${matched}`);
  console.log(`Unmatched:                 ${unmatched}`);
  console.log(`Ambiguous (manual review): ${ambiguous}`);
  console.log(`Already current:           ${alreadyCurrent}`);
  console.log(`Would update:                ${wouldUpdate}`);

  if (!apply) {
    console.log(
      "\nDry-run complete. Re-run with --apply to update Employee.nisNumber / birNumber only.",
    );
    return;
  }

  if (wouldUpdate === 0) {
    console.log("\nNothing to apply.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of results) {
    if (!result.wouldUpdate || !result.employee || result.status !== "matched") {
      skipped += 1;
      continue;
    }

    const resolved = resolveChanges(result.employee, result.source);
    if (!resolved.wouldUpdate) {
      skipped += 1;
      continue;
    }

    const data: { nisNumber?: string; birNumber?: string } = {};
    if (resolved.patch.nisNumber !== undefined) {
      data.nisNumber = resolved.patch.nisNumber;
    }
    if (resolved.patch.birNumber !== undefined) {
      data.birNumber = resolved.patch.birNumber;
    }

    try {
      await prisma.employee.update({
        where: { id: result.employee.id },
        data,
      });
      updated += 1;
      console.log(
        `Updated #${result.employee.employeeNumber}: ` +
          [
            resolved.nisChange ? "NIS" : null,
            resolved.birChange ? "BIR" : null,
          ]
            .filter(Boolean)
            .join(" + "),
      );
    } catch (error) {
      failed += 1;
      console.error(
        `FAILED #${result.employee.employeeNumber}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`\nApply complete: updated=${updated} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
