import type { PayRunPaysheetWorkbookData } from "@/src/modules/payroll/data/get-pay-run-paysheet";
import { sanitizeReportFileName } from "@/src/modules/reports/lib/export-xlsx";

/** Max contribution weeks shown as columns (Monday weeks in a month). */
export const PAYSHEET_XLSX_MAX_WEEKS = 5;

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default ?? mod;
}

const COLORS = {
  headerText: "FFFFFFFF",
  titleText: "FF0F172A",
  border: "FFE2E8F0",
  zebra: "FFF8FAFC",
  totals: "FFE2E8F0",
  employerCell: "FFE0F2FE",
  employerCellText: "FF082F49",
  previewBanner: "FFEA580C",
} as const;

/** Column header row — one accent per worksheet tab (soft modern palette). */
const SHEET_THEMES = {
  paysheet: {
    tab: "FF6B9FD4",
    header: "FF6B9FD4",
  },
  nis: {
    tab: "FFD47171",
    header: "FFD47171",
    /** Lighter coral for employer NIS columns — still white header text. */
    employerHeader: "FFE08E8E",
    employerTotalHeader: "FFC85A5A",
  },
  bank: {
    tab: "FF62B487",
    header: "FF62B487",
  },
  excluded: {
    tab: "FFE5A84B",
    header: "FFE5A84B",
  },
} as const;

/** Visual scale for table cells — doubled for on-screen readability. */
const CELL_SCALE = 2;

const FONT = {
  family: "Calibri",
  /** Column headers, data rows, and totals. */
  tableSize: 20,
  /** Organization / title block above each sheet table. */
  headerSectionSize: 24,
} as const;

const LAYOUT = {
  dataRowHeight: 28 * CELL_SCALE,
  headerRowHeight: 34 * CELL_SCALE,
  totalsRowHeight: 30 * CELL_SCALE,
  metadataRowHeight: 28 * CELL_SCALE,
  previewBannerHeight: 32 * CELL_SCALE,
  defaultRowHeight: 26 * CELL_SCALE,
  viewZoom: 80,
} as const;

type CellRange = {
  fromRow: number;
  toRow: number;
  fromCol: number;
  toCol: number;
};

function sheetFont(options?: {
  bold?: boolean;
  color?: string;
  size?: number;
}) {
  return {
    name: FONT.family,
    size: options?.size ?? FONT.tableSize,
    bold: options?.bold ?? false,
    color: { argb: options?.color ?? COLORS.titleText },
  };
}

function headerSectionFont(options?: { color?: string }) {
  return sheetFont({
    size: FONT.headerSectionSize,
    bold: true,
    color: options?.color,
  });
}

function applyTableFonts(sheet: Worksheet, columnCount: number) {
  const font = sheetFont();
  for (let column = 1; column <= columnCount; column += 1) {
    sheet.getColumn(column).font = font;
  }
}

const thinBorder = {
  top: { style: "thin" as const, color: { argb: COLORS.border } },
  left: { style: "thin" as const, color: { argb: COLORS.border } },
  bottom: { style: "thin" as const, color: { argb: COLORS.border } },
  right: { style: "thin" as const, color: { argb: COLORS.border } },
};

type Worksheet = import("exceljs").Worksheet;
type Cell = import("exceljs").Cell;

function columnLetter(index: number): string {
  let value = index;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function currencyNumFmt(currency: string): string {
  return currency === "TTD" ? '"TTD "#,##0.00' : `"${currency}" #,##0.00`;
}

function currencyDisplaySample(
  value: string | number | null | undefined,
  currency: string,
): string {
  if (value == null || value === "") {
    return `${currency} 0.00`;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  return `${currency} ${amount.toLocaleString("en-TT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type ColumnWidthSpec = {
  header: string;
  values: Array<string | number | null | undefined>;
  kind?: "text" | "currency" | "integer";
  currency?: string;
  min?: number;
  max?: number;
};

function estimateColumnWidth(spec: ColumnWidthSpec): number {
  const kind = spec.kind ?? "text";
  const currency = spec.currency ?? "TTD";

  const valueLengths = spec.values.map((value) => {
    if (kind === "currency") {
      return currencyDisplaySample(value, currency).length;
    }
    if (kind === "integer") {
      if (value == null || value === "") {
        return 0;
      }
      return String(value).length;
    }
    return value == null ? 0 : String(value).length;
  });

  const maxValueLen = valueLengths.reduce(
    (max, length) => Math.max(max, length),
    0,
  );
  const computed = Math.max(spec.header.length, maxValueLen) + 2;
  const kindFloor =
    kind === "currency" ? 16 : kind === "integer" ? 10 : 12;
  const min = (spec.min ?? kindFloor) * CELL_SCALE;
  const max = (spec.max ?? (kind === "text" ? 48 : 24)) * CELL_SCALE;
  return Math.min(Math.max(computed * CELL_SCALE, min), max);
}

function applyColumnWidths(
  sheet: Worksheet,
  specs: ColumnWidthSpec[],
) {
  specs.forEach((spec, index) => {
    sheet.getColumn(index + 1).width = estimateColumnWidth(spec);
  });
}

function configureSheetPresentation(
  sheet: Worksheet,
  input: {
    dataStartRow: number;
    printTitlesEndRow: number;
    isPreview?: boolean;
  },
) {
  sheet.properties.defaultRowHeight = LAYOUT.defaultRowHeight;

  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `1:${input.printTitlesEndRow}`,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.45,
      bottom: 0.45,
      header: 0.2,
      footer: 0.2,
    },
  };

  if (input.isPreview) {
    const previewLabel = "DRAFT / PREVIEW — NOT POSTED";
    sheet.headerFooter = {
      differentFirst: false,
      differentOddEven: false,
      oddHeader: `&C&"Calibri,Bold"${previewLabel}`,
      oddFooter: `&C&"Calibri"${previewLabel}`,
      evenHeader: `&C&"Calibri,Bold"${previewLabel}`,
      evenFooter: `&C&"Calibri"${previewLabel}`,
      firstHeader: null,
      firstFooter: null,
    };
  }

  // Normal scroll — entire sheet moves together (no frozen panes).
  sheet.views = [
    {
      activeCell: `A${input.dataStartRow}`,
      zoomScale: LAYOUT.viewZoom,
    },
  ];
}

function writePreviewBanner(sheet: Worksheet, rowIndex: number, columnSpan: number) {
  const row = sheet.getRow(rowIndex);
  row.height = LAYOUT.previewBannerHeight;
  sheet.mergeCells(rowIndex, 1, rowIndex, columnSpan);
  const cell = row.getCell(1);
  cell.value = "DRAFT / PREVIEW — NOT POSTED";
  cell.font = sheetFont({
    bold: true,
    size: FONT.headerSectionSize,
    color: COLORS.headerText,
  });
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.previewBanner },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
}

function unlockCellRange(sheet: Worksheet, range: CellRange) {
  for (let row = range.fromRow; row <= range.toRow; row += 1) {
    for (let col = range.fromCol; col <= range.toCol; col += 1) {
      sheet.getRow(row).getCell(col).protection = { locked: false };
    }
  }
}

async function protectFormulaSheet(sheet: Worksheet) {
  await sheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
  });
}

function setFormula(cell: Cell, formula: string) {
  cell.value = { formula };
}

function styleHeaderCell(cell: Cell, label: string, fill: string) {
  cell.value = label;
  cell.font = sheetFont({ bold: true, color: COLORS.headerText });
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fill },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = thinBorder;
}

function styleTableHeaderRow(
  sheet: Worksheet,
  rowIndex: number,
  headers: string[],
  fill: string,
  fillForLabel?: (label: string) => string | undefined,
) {
  const headerRow = sheet.getRow(rowIndex);
  headerRow.height = LAYOUT.headerRowHeight;
  headers.forEach((label, index) => {
    styleHeaderCell(
      headerRow.getCell(index + 1),
      label,
      fillForLabel?.(label) ?? fill,
    );
  });
}

function reinforceMetadataBlock(
  sheet: Worksheet,
  firstRow: number,
  lastRow: number,
) {
  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    const cell = sheet.getRow(rowIndex).getCell(1);
    cell.font = headerSectionFont();
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }
}

function applySheetTabColor(sheet: Worksheet, argb: string) {
  sheet.properties.tabColor = { argb };
}

/** Column-level formats — avoids per-cell numFmt/alignment (much faster in ExcelJS). */
function formatCurrencyColumns(
  sheet: Worksheet,
  columns: number[],
  currency: string,
) {
  const fmt = currencyNumFmt(currency);
  for (const index of columns) {
    const column = sheet.getColumn(index);
    column.numFmt = fmt;
    column.alignment = { vertical: "middle", horizontal: "right" };
  }
}

function formatIntegerColumn(sheet: Worksheet, columnIndex: number) {
  const column = sheet.getColumn(columnIndex);
  column.numFmt = "#,##0";
  column.alignment = { vertical: "middle", horizontal: "center" };
}

function formatTextColumns(sheet: Worksheet, columns: number[]) {
  for (const index of columns) {
    sheet.getColumn(index).alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  }
}

function styleTotalsCell(
  cell: Cell,
  input: { currency?: string; fill?: string; bold?: boolean },
) {
  if (input.currency) {
    cell.numFmt = currencyNumFmt(input.currency);
  }
  cell.font = sheetFont({ bold: input.bold ?? true });
  if (input.fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: input.fill },
    };
  }
  cell.alignment = { vertical: "middle", horizontal: "right" };
}

type MetadataBlock = {
  organizationName?: string | null;
  title: string;
  generatedAt: Date;
  metadata: Array<{ label: string; value: string }>;
  /** Merge title rows across this many columns for readability. */
  columnSpan?: number;
  isPreview?: boolean;
};

function writeMetadataBlock(
  sheet: Worksheet,
  startRow: number,
  block: MetadataBlock,
): number {
  let rowIndex = startRow;
  const span = Math.max(block.columnSpan ?? 1, 1);

  if (block.isPreview) {
    writePreviewBanner(sheet, rowIndex++, span);
  }

  if (block.organizationName) {
    const row = sheet.getRow(rowIndex++);
    row.height = LAYOUT.metadataRowHeight;
    sheet.mergeCells(row.number, 1, row.number, span);
    const cell = row.getCell(1);
    cell.value = block.organizationName;
    cell.font = headerSectionFont();
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }

  {
    const row = sheet.getRow(rowIndex++);
    row.height = LAYOUT.metadataRowHeight;
    sheet.mergeCells(row.number, 1, row.number, span);
    const cell = row.getCell(1);
    cell.value = block.title;
    cell.font = headerSectionFont();
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }

  {
    const row = sheet.getRow(rowIndex++);
    row.height = LAYOUT.metadataRowHeight;
    sheet.mergeCells(row.number, 1, row.number, span);
    const cell = row.getCell(1);
    cell.value = `Generated ${block.generatedAt.toLocaleString("en-TT", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
    cell.font = headerSectionFont();
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }

  for (const line of block.metadata) {
    const row = sheet.getRow(rowIndex++);
    row.height = LAYOUT.metadataRowHeight;
    sheet.mergeCells(row.number, 1, row.number, span);
    const cell = row.getCell(1);
    cell.value = `${line.label}: ${line.value}`;
    cell.font = headerSectionFont();
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }

  return rowIndex + 1;
}

function workbookMetadata(data: PayRunPaysheetWorkbookData): MetadataBlock {
  const employeeSummary = `${data.includedCount} included${
    data.excludedCount > 0 ? ` · ${data.excludedCount} excluded` : ""
  }`;
  return {
    organizationName: data.organizationName,
    title: `Payroll register — ${data.runNumber}`,
    generatedAt: new Date(),
    isPreview: data.isPreview,
    metadata: [
      {
        label: "Period",
        value: `${data.periodName} (${data.periodKey}) · ${data.statusLabel} · ${data.runKind}`,
      },
      {
        label: "Summary",
        value: `${employeeSummary} · ${data.currency}${
          data.isPreview ? " · Preview — not posted" : ""
        }`,
      },
    ],
  };
}

function buildRegisterSheet(
  workbook: import("exceljs").Workbook,
  data: PayRunPaysheetWorkbookData,
) {
  const sheet = workbook.addWorksheet("Paysheet");
  applySheetTabColor(sheet, SHEET_THEMES.paysheet.tab);

  const headers = [
    "Emp #",
    "Employee",
    "Department",
    "Job title",
    "Basic",
    "Allowances",
    "Gross",
    "PAYE",
    "NIS (ee)",
    "Health",
    "Other ded.",
    "Total ded.",
    "Net",
  ];

  const headerRowIndex = writeMetadataBlock(sheet, 1, {
    ...workbookMetadata(data),
    columnSpan: headers.length,
  });

  styleTableHeaderRow(sheet, headerRowIndex, headers, SHEET_THEMES.paysheet.header);

  const dataStartRow = headerRowIndex + 1;
  let rowIndex = dataStartRow;

  data.rows.forEach((row) => {
    const excelRow = sheet.getRow(rowIndex++);
    excelRow.height = LAYOUT.dataRowHeight;
    excelRow.getCell(1).value = row.employeeNumber;
    excelRow.getCell(2).value = row.employeeName;
    excelRow.getCell(3).value = row.departmentName ?? "";
    excelRow.getCell(4).value = row.jobTitle ?? "";
    excelRow.getCell(5).value = row.baseSalary;
    excelRow.getCell(6).value = row.allowancesTotal;
    excelRow.getCell(7).value = row.grossPay;
    excelRow.getCell(8).value = row.paye;
    excelRow.getCell(9).value = row.nisEmployee;
    excelRow.getCell(10).value = row.healthSurcharge;
    excelRow.getCell(11).value = row.otherDeductions;
    excelRow.getCell(12).value = row.totalDeductions;
    excelRow.getCell(13).value = row.netPay;
  });

  const dataEndRow = rowIndex - 1;
  const totalsRowIndex = rowIndex;
  const totalsRow = sheet.getRow(totalsRowIndex);
  totalsRow.height = LAYOUT.totalsRowHeight;

  for (let column = 1; column <= headers.length; column += 1) {
    const cell = totalsRow.getCell(column);
    if (column === 1) {
      cell.value = "";
    } else if (column === 2) {
      cell.value = "TOTAL";
    } else if (column >= 5) {
      const letter = columnLetter(column);
      setFormula(cell, `SUM(${letter}${dataStartRow}:${letter}${dataEndRow})`);
      styleTotalsCell(cell, {
        currency: data.currency,
        fill: COLORS.totals,
      });
    } else {
      cell.value = "";
      cell.font = sheetFont({ bold: true });
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.totals },
      };
    }
  }

  formatTextColumns(sheet, [1, 2, 3, 4]);
  formatCurrencyColumns(sheet, [5, 6, 7, 8, 9, 10, 11, 12, 13], data.currency);
  applyTableFonts(sheet, headers.length);

  applyColumnWidths(sheet, [
    {
      header: headers[0]!,
      values: data.rows.map((row) => row.employeeNumber),
      kind: "text",
      min: 10,
    },
    {
      header: headers[1]!,
      values: data.rows.map((row) => row.employeeName),
      kind: "text",
      min: 28,
      max: 40,
    },
    {
      header: headers[2]!,
      values: data.rows.map((row) => row.departmentName ?? ""),
      kind: "text",
      min: 20,
      max: 36,
    },
    {
      header: headers[3]!,
      values: data.rows.map((row) => row.jobTitle ?? ""),
      kind: "text",
      min: 20,
      max: 36,
    },
    ...headers.slice(4).map((header, offset) => ({
      header,
      values: data.rows.map((row) => {
        const keys = [
          "baseSalary",
          "allowancesTotal",
          "grossPay",
          "paye",
          "nisEmployee",
          "healthSurcharge",
          "otherDeductions",
          "totalDeductions",
          "netPay",
        ] as const;
        return row[keys[offset]!];
      }),
      kind: "currency" as const,
      currency: data.currency,
      min: 16,
    })),
  ]);

  if (dataEndRow >= dataStartRow) {
    unlockCellRange(sheet, {
      fromRow: dataStartRow,
      toRow: dataEndRow,
      fromCol: 1,
      toCol: headers.length,
    });
  }

  configureSheetPresentation(sheet, {
    dataStartRow,
    printTitlesEndRow: headerRowIndex,
    isPreview: data.isPreview,
  });

  reinforceMetadataBlock(sheet, 1, headerRowIndex - 1);
}

function buildNisSheet(
  workbook: import("exceljs").Workbook,
  data: PayRunPaysheetWorkbookData,
): void {
  const sheet = workbook.addWorksheet("NIS contributions");
  applySheetTabColor(sheet, SHEET_THEMES.nis.tab);

  const weekHeaders = Array.from(
    { length: PAYSHEET_XLSX_MAX_WEEKS },
    (_, index) => `Wk ${index + 1} (ee)`,
  );
  const weekErHeaders = Array.from(
    { length: PAYSHEET_XLSX_MAX_WEEKS },
    (_, index) => `Wk ${index + 1} (er)`,
  );

  const headers = [
    "Emp #",
    "Employee",
    "Class",
    "Weeks",
    "EE weekly",
    "ER weekly",
    ...weekHeaders,
    ...weekErHeaders,
    "EE period",
    "ER period",
    "NIS payment",
  ];

  const headerRowIndex = writeMetadataBlock(sheet, 1, {
    ...workbookMetadata(data),
    title: `NIS contributions — ${data.runNumber}`,
    columnSpan: headers.length,
  });

  const eeWeekStartCol = 7;
  const erWeekStartCol = eeWeekStartCol + PAYSHEET_XLSX_MAX_WEEKS;
  const eeTotalCol = erWeekStartCol + PAYSHEET_XLSX_MAX_WEEKS;
  const erTotalCol = eeTotalCol + 1;
  const nisPaymentCol = erTotalCol + 1;

  styleTableHeaderRow(
    sheet,
    headerRowIndex,
    headers,
    SHEET_THEMES.nis.header,
    (label) => {
      const isEmployerSection =
        label.includes("(er)") || label === "ER weekly" || label === "ER period";
      const isTotal = label === "NIS payment";
      if (isTotal) {
        return SHEET_THEMES.nis.employerTotalHeader;
      }
      if (isEmployerSection) {
        return SHEET_THEMES.nis.employerHeader;
      }
      return undefined;
    },
  );

  const dataStartRow = headerRowIndex + 1;
  let rowIndex = dataStartRow;

  data.nisRows.forEach((row) => {
    const excelRow = sheet.getRow(rowIndex);
    excelRow.height = LAYOUT.dataRowHeight;

    excelRow.getCell(1).value = row.employeeNumber;
    excelRow.getCell(2).value = row.employeeName;
    excelRow.getCell(3).value = row.classLabel;
    excelRow.getCell(4).value = row.weeksInPeriod;
    excelRow.getCell(5).value = row.employeeWeekly;
    excelRow.getCell(6).value = row.employerWeekly;

    for (let week = 1; week <= PAYSHEET_XLSX_MAX_WEEKS; week += 1) {
      const eeCol = eeWeekStartCol + week - 1;
      const erCol = erWeekStartCol + week - 1;
      setFormula(
        excelRow.getCell(eeCol),
        `IF($D${rowIndex}>=${week},$E${rowIndex},0)`,
      );
      setFormula(
        excelRow.getCell(erCol),
        `IF($D${rowIndex}>=${week},$F${rowIndex},0)`,
      );
    }

    const eeStart = columnLetter(eeWeekStartCol);
    const eeEnd = columnLetter(eeWeekStartCol + PAYSHEET_XLSX_MAX_WEEKS - 1);
    const erStart = columnLetter(erWeekStartCol);
    const erEnd = columnLetter(erWeekStartCol + PAYSHEET_XLSX_MAX_WEEKS - 1);
    setFormula(
      excelRow.getCell(eeTotalCol),
      `SUM(${eeStart}${rowIndex}:${eeEnd}${rowIndex})`,
    );
    setFormula(
      excelRow.getCell(erTotalCol),
      `SUM(${erStart}${rowIndex}:${erEnd}${rowIndex})`,
    );
    setFormula(
      excelRow.getCell(nisPaymentCol),
      `${columnLetter(eeTotalCol)}${rowIndex}+${columnLetter(erTotalCol)}${rowIndex}`,
    );

    rowIndex += 1;
  });

  const dataEndRow = rowIndex - 1;
  const totalsRow = sheet.getRow(rowIndex);
  totalsRow.height = LAYOUT.totalsRowHeight;
  totalsRow.getCell(2).value = "TOTAL";

  for (const col of [eeTotalCol, erTotalCol, nisPaymentCol]) {
    const cell = totalsRow.getCell(col);
    const letter = columnLetter(col);
    setFormula(cell, `SUM(${letter}${dataStartRow}:${letter}${dataEndRow})`);
    const isEmployerCol = col !== eeTotalCol;
    styleTotalsCell(cell, {
      currency: data.currency,
      fill: isEmployerCol
        ? col === nisPaymentCol
          ? SHEET_THEMES.nis.employerTotalHeader
          : SHEET_THEMES.nis.employerHeader
        : COLORS.totals,
    });
    if (isEmployerCol) {
      cell.font = sheetFont({ bold: true, color: COLORS.headerText });
    }
  }

  totalsRow.getCell(2).font = sheetFont({ bold: true });
  totalsRow.getCell(2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.totals },
  };

  formatTextColumns(sheet, [1, 2, 3]);
  formatIntegerColumn(sheet, 4);
  const currencyColumns = [
    5,
    6,
    ...Array.from({ length: PAYSHEET_XLSX_MAX_WEEKS }, (_, i) => eeWeekStartCol + i),
    ...Array.from({ length: PAYSHEET_XLSX_MAX_WEEKS }, (_, i) => erWeekStartCol + i),
    eeTotalCol,
    erTotalCol,
    nisPaymentCol,
  ];
  formatCurrencyColumns(sheet, currencyColumns, data.currency);
  applyTableFonts(sheet, headers.length);

  applyEmployerColumnFill(sheet, {
    dataStartRow,
    dataEndRow,
    employerColumns: [
      6,
      ...Array.from({ length: PAYSHEET_XLSX_MAX_WEEKS }, (_, i) => erWeekStartCol + i),
      erTotalCol,
      nisPaymentCol,
    ],
  });

  const weekCurrencyValues = data.nisRows.flatMap((row) => [
    row.employeeWeekly,
    row.employerWeekly,
  ]);

  applyColumnWidths(sheet, [
    {
      header: headers[0]!,
      values: data.nisRows.map((row) => row.employeeNumber),
      kind: "text",
      min: 10,
    },
    {
      header: headers[1]!,
      values: data.nisRows.map((row) => row.employeeName),
      kind: "text",
      min: 28,
      max: 40,
    },
    {
      header: headers[2]!,
      values: data.nisRows.map((row) => row.classLabel),
      kind: "text",
      min: 8,
    },
    {
      header: headers[3]!,
      values: data.nisRows.map((row) => row.weeksInPeriod),
      kind: "integer",
      min: 8,
    },
    {
      header: headers[4]!,
      values: data.nisRows.map((row) => row.employeeWeekly),
      kind: "currency",
      currency: data.currency,
      min: 14,
    },
    {
      header: headers[5]!,
      values: data.nisRows.map((row) => row.employerWeekly),
      kind: "currency",
      currency: data.currency,
      min: 14,
    },
    ...weekHeaders.map((header) => ({
      header,
      values: weekCurrencyValues,
      kind: "currency" as const,
      currency: data.currency,
      min: 14,
    })),
    ...weekErHeaders.map((header) => ({
      header,
      values: weekCurrencyValues,
      kind: "currency" as const,
      currency: data.currency,
      min: 14,
    })),
    {
      header: "EE period",
      values: data.nisRows.map((row) => row.employeeWeekly * row.weeksInPeriod),
      kind: "currency",
      currency: data.currency,
      min: 16,
    },
    {
      header: "ER period",
      values: data.nisRows.map((row) => row.employerWeekly * row.weeksInPeriod),
      kind: "currency",
      currency: data.currency,
      min: 16,
    },
    {
      header: "NIS payment",
      values: data.nisRows.map(
        (row) =>
          row.employeeWeekly * row.weeksInPeriod +
          row.employerWeekly * row.weeksInPeriod,
      ),
      kind: "currency",
      currency: data.currency,
      min: 16,
    },
  ]);

  if (dataEndRow >= dataStartRow) {
    unlockCellRange(sheet, {
      fromRow: dataStartRow,
      toRow: dataEndRow,
      fromCol: 1,
      toCol: 6,
    });
  }

  configureSheetPresentation(sheet, {
    dataStartRow,
    printTitlesEndRow: headerRowIndex,
    isPreview: data.isPreview,
  });

  reinforceMetadataBlock(sheet, 1, headerRowIndex - 1);
}

function applyEmployerColumnFill(
  sheet: Worksheet,
  input: {
    dataStartRow: number;
    dataEndRow: number;
    employerColumns: number[];
  },
) {
  if (input.dataEndRow < input.dataStartRow) {
    return;
  }

  for (let row = input.dataStartRow; row <= input.dataEndRow; row += 1) {
    for (const column of input.employerColumns) {
      const cell = sheet.getRow(row).getCell(column);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.employerCell },
      };
      cell.font = sheetFont({ color: COLORS.employerCellText });
    }
  }
}

function buildBankSheet(
  workbook: import("exceljs").Workbook,
  data: PayRunPaysheetWorkbookData,
) {
  const sheet = workbook.addWorksheet("Bank disbursement");
  applySheetTabColor(sheet, SHEET_THEMES.bank.tab);

  const headers = [
    "Emp #",
    "Employee",
    "Bank",
    "Account",
    "Account type",
    "Split",
    "Amount",
  ];

  const headerRowIndex = writeMetadataBlock(sheet, 1, {
    ...workbookMetadata(data),
    title: `Bank disbursement — ${data.runNumber}`,
    columnSpan: headers.length,
  });

  styleTableHeaderRow(sheet, headerRowIndex, headers, SHEET_THEMES.bank.header);

  const dataStartRow = headerRowIndex + 1;
  let rowIndex = dataStartRow;

  data.bankRows.forEach((row) => {
    const excelRow = sheet.getRow(rowIndex++);
    excelRow.height = LAYOUT.dataRowHeight;
    excelRow.getCell(1).value = row.employeeNumber;
    excelRow.getCell(2).value = row.employeeName;
    excelRow.getCell(3).value = row.bankName;
    excelRow.getCell(4).value = row.accountNumber;
    excelRow.getCell(5).value = row.accountType ?? "";
    excelRow.getCell(6).value = row.splitType;
    excelRow.getCell(7).value = row.amount;
  });

  const dataEndRow = rowIndex - 1;
  const totalsRow = sheet.getRow(rowIndex);
  totalsRow.height = LAYOUT.totalsRowHeight;
  totalsRow.getCell(2).value = "TOTAL";
  const amountCell = totalsRow.getCell(7);
  if (data.bankRows.length > 0) {
    setFormula(amountCell, `SUM(G${dataStartRow}:G${dataEndRow})`);
  } else {
    amountCell.value = 0;
  }
  totalsRow.getCell(2).font = sheetFont({ bold: true });
  totalsRow.getCell(2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.totals },
  };
  styleTotalsCell(amountCell, {
    currency: data.currency,
    fill: COLORS.totals,
  });

  formatTextColumns(sheet, [1, 2, 3, 4, 5, 6]);
  formatCurrencyColumns(sheet, [7], data.currency);
  applyTableFonts(sheet, headers.length);

  applyColumnWidths(sheet, [
    {
      header: headers[0]!,
      values: data.bankRows.map((row) => row.employeeNumber),
      kind: "text",
      min: 10,
    },
    {
      header: headers[1]!,
      values: data.bankRows.map((row) => row.employeeName),
      kind: "text",
      min: 28,
      max: 40,
    },
    {
      header: headers[2]!,
      values: data.bankRows.map((row) => row.bankName),
      kind: "text",
      min: 22,
      max: 36,
    },
    {
      header: headers[3]!,
      values: data.bankRows.map((row) => row.accountNumber),
      kind: "text",
      min: 24,
      max: 42,
    },
    {
      header: headers[4]!,
      values: data.bankRows.map((row) => row.accountType ?? ""),
      kind: "text",
      min: 14,
    },
    {
      header: headers[5]!,
      values: data.bankRows.map((row) => row.splitType),
      kind: "text",
      min: 16,
    },
    {
      header: headers[6]!,
      values: data.bankRows.map((row) => row.amount),
      kind: "currency",
      currency: data.currency,
      min: 16,
    },
  ]);

  if (dataEndRow >= dataStartRow) {
    unlockCellRange(sheet, {
      fromRow: dataStartRow,
      toRow: dataEndRow,
      fromCol: 1,
      toCol: headers.length,
    });
  }

  configureSheetPresentation(sheet, {
    dataStartRow,
    printTitlesEndRow: headerRowIndex,
    isPreview: data.isPreview,
  });

  reinforceMetadataBlock(sheet, 1, headerRowIndex - 1);
}

function buildExcludedSheet(
  workbook: import("exceljs").Workbook,
  data: PayRunPaysheetWorkbookData,
) {
  const sheet = workbook.addWorksheet("Excluded employees");
  applySheetTabColor(sheet, SHEET_THEMES.excluded.tab);

  const headers = [
    "Emp #",
    "Employee",
    "Department",
    "Job title",
    "Status",
    "Exclusion reason",
  ];

  const headerRowIndex = writeMetadataBlock(sheet, 1, {
    ...workbookMetadata(data),
    title: `Excluded employees — ${data.runNumber}`,
    columnSpan: headers.length,
  });

  styleTableHeaderRow(sheet, headerRowIndex, headers, SHEET_THEMES.excluded.header);

  const dataStartRow = headerRowIndex + 1;
  let rowIndex = dataStartRow;

  if (data.excludedRows.length === 0) {
    const row = sheet.getRow(rowIndex++);
    row.height = LAYOUT.dataRowHeight;
    sheet.mergeCells(row.number, 1, row.number, headers.length);
    const cell = row.getCell(1);
    cell.value = "No employees were excluded from this pay run.";
    cell.font = sheetFont();
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  } else {
    data.excludedRows.forEach((employee) => {
      const excelRow = sheet.getRow(rowIndex++);
      excelRow.height = LAYOUT.dataRowHeight;
      excelRow.getCell(1).value = employee.employeeNumber;
      excelRow.getCell(2).value = employee.employeeName;
      excelRow.getCell(3).value = employee.departmentName ?? "";
      excelRow.getCell(4).value = employee.jobTitle ?? "";
      excelRow.getCell(5).value = employee.status;
      excelRow.getCell(6).value = employee.exclusionReason ?? "—";
    });
  }

  const dataEndRow = rowIndex - 1;

  formatTextColumns(sheet, [1, 2, 3, 4, 5, 6]);
  applyTableFonts(sheet, headers.length);

  applyColumnWidths(sheet, [
    {
      header: headers[0]!,
      values: data.excludedRows.map((row) => row.employeeNumber),
      kind: "text",
      min: 10,
    },
    {
      header: headers[1]!,
      values: data.excludedRows.map((row) => row.employeeName),
      kind: "text",
      min: 28,
      max: 40,
    },
    {
      header: headers[2]!,
      values: data.excludedRows.map((row) => row.departmentName ?? ""),
      kind: "text",
      min: 20,
      max: 36,
    },
    {
      header: headers[3]!,
      values: data.excludedRows.map((row) => row.jobTitle ?? ""),
      kind: "text",
      min: 20,
      max: 36,
    },
    {
      header: headers[4]!,
      values: data.excludedRows.map((row) => row.status),
      kind: "text",
      min: 12,
    },
    {
      header: headers[5]!,
      values: data.excludedRows.map((row) => row.exclusionReason ?? "—"),
      kind: "text",
      min: 28,
      max: 48,
    },
  ]);

  if (dataEndRow >= dataStartRow && data.excludedRows.length > 0) {
    unlockCellRange(sheet, {
      fromRow: dataStartRow,
      toRow: dataEndRow,
      fromCol: 1,
      toCol: headers.length,
    });
  }

  configureSheetPresentation(sheet, {
    dataStartRow,
    printTitlesEndRow: headerRowIndex,
    isPreview: data.isPreview,
  });

  reinforceMetadataBlock(sheet, 1, headerRowIndex - 1);
}

/** Build the four-sheet paysheet workbook (register, NIS, banks, excluded) with live formulas. */
export async function buildPayRunPaysheetXlsx(
  data: PayRunPaysheetWorkbookData,
): Promise<Buffer> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Q-NXUS";
  workbook.created = new Date();

  buildRegisterSheet(workbook, data);
  buildNisSheet(workbook, data);
  buildBankSheet(workbook, data);
  buildExcludedSheet(workbook, data);

  for (const sheet of workbook.worksheets) {
    if (sheet.name === "Excluded employees") {
      continue;
    }
    await protectFormulaSheet(sheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function payRunPaysheetXlsxFileName(data: PayRunPaysheetWorkbookData): string {
  return `${sanitizeReportFileName(
    `payroll-register-${data.runNumber}-${data.periodKey}`,
  )}.xlsx`;
}

export { sanitizeReportFileName };
