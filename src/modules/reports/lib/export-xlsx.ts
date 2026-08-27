import ExcelJS from "exceljs";

import type {
  ReportExportColumn,
  ReportExportColumnKind,
  ReportExportMetadataLine,
  ReportExportTable,
} from "@/src/modules/reports/lib/report-export-table";

/** Corporate report palette — subtle, finance-friendly. */
const COLORS = {
  headerFill: "FF334155",
  headerText: "FFFFFFFF",
  titleText: "FF0F172A",
  metaText: "FF64748B",
  border: "FFE2E8F0",
  zebra: "FFF8FAFC",
} as const;

const FONT = {
  family: "Calibri",
  titleSize: 15,
  metaSize: 10,
  headerSize: 11,
  dataSize: 11,
} as const;

function numFmtForKind(
  kind: ReportExportColumnKind | undefined,
  currency: string,
): string | undefined {
  switch (kind) {
    case "currency":
      return currency === "TTD"
        ? '"TTD "#,##0.00'
        : `"${currency}" #,##0.00`;
    case "number":
      return "#,##0.00";
    case "integer":
      return "#,##0";
    case "date":
      return "yyyy-mm-dd";
    case "datetime":
      return "yyyy-mm-dd hh:mm";
    default:
      return undefined;
  }
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function estimateColumnWidth(
  column: ReportExportColumn,
  values: Array<string | number | null | undefined>,
): number {
  const headerLen = column.header.length;
  const maxValueLen = values.reduce<number>((max, value) => {
    const text = value == null ? "" : String(value);
    return Math.max(max, text.length);
  }, 0);
  const computed = Math.max(headerLen, maxValueLen) + 2;
  const min = column.width ?? 10;
  return Math.min(Math.max(computed, min), 48);
}

export type StyledReportXlsxInput = {
  organizationName?: string | null;
  generatedAt?: Date;
  table: ReportExportTable;
};

/** Build a professionally styled XLSX workbook buffer for a report table. */
export async function buildStyledReportXlsx(
  input: StyledReportXlsxInput,
): Promise<Buffer> {
  const { table, organizationName } = input;
  const generatedAt = input.generatedAt ?? new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Q-NXUS";
  workbook.created = generatedAt;

  const sheetName = (table.sheetName ?? "Report").slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A1" }],
    properties: { defaultRowHeight: 18 },
  });

  let rowIndex = 1;

  if (organizationName) {
    const row = sheet.getRow(rowIndex++);
    row.height = 22;
    const cell = row.getCell(1);
    cell.value = organizationName;
    cell.font = {
      name: FONT.family,
      size: FONT.titleSize,
      bold: true,
      color: { argb: COLORS.titleText },
    };
  }

  {
    const row = sheet.getRow(rowIndex++);
    row.height = 22;
    const cell = row.getCell(1);
    cell.value = table.title;
    cell.font = {
      name: FONT.family,
      size: FONT.titleSize,
      bold: true,
      color: { argb: COLORS.titleText },
    };
  }

  {
    const row = sheet.getRow(rowIndex++);
    row.height = 16;
    const cell = row.getCell(1);
    cell.value = `Generated ${generatedAt.toLocaleString("en-TT", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
    cell.font = {
      name: FONT.family,
      size: FONT.metaSize,
      color: { argb: COLORS.metaText },
    };
  }

  for (const line of table.metadata ?? []) {
    const row = sheet.getRow(rowIndex++);
    row.height = 16;
    const cell = row.getCell(1);
    cell.value = `${line.label}: ${line.value}`;
    cell.font = {
      name: FONT.family,
      size: FONT.metaSize,
      color: { argb: COLORS.metaText },
    };
  }

  rowIndex += 1;

  const headerRowIndex = rowIndex;
  const headerRow = sheet.getRow(rowIndex++);
  headerRow.height = 22;

  table.columns.forEach((column, columnIndex) => {
    const cell = headerRow.getCell(columnIndex + 1);
    cell.value = column.header;
    cell.font = {
      name: FONT.family,
      size: FONT.headerSize,
      bold: true,
      color: { argb: COLORS.headerText },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.headerFill },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    applyBorder(cell);
  });

  sheet.views = [
    {
      state: "frozen",
      ySplit: headerRowIndex,
      activeCell: `A${headerRowIndex + 1}`,
    },
  ];

  const dataRows = table.totalsRow
    ? [...table.rows, table.totalsRow]
    : table.rows;

  for (let dataIndex = 0; dataIndex < dataRows.length; dataIndex += 1) {
    const sourceRow = dataRows[dataIndex];
    const isTotals = table.totalsRow != null && dataIndex === dataRows.length - 1;
    const isZebra = !isTotals && dataIndex % 2 === 1;

    const row = sheet.getRow(rowIndex++);
    row.height = 18;

    table.columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      const raw = sourceRow[column.key];
      const kind = column.kind ?? "text";
      const currency = column.currency ?? "TTD";

      if (kind === "text" || raw == null || raw === "") {
        cell.value = raw == null || raw === "" ? "" : String(raw);
      } else if (kind === "integer") {
        cell.value = Number(raw);
      } else if (
        kind === "number" ||
        kind === "currency"
      ) {
        cell.value = Number(raw);
      } else if (kind === "date" || kind === "datetime") {
        const parsed = new Date(String(raw));
        cell.value = Number.isNaN(parsed.getTime()) ? String(raw) : parsed;
      } else {
        cell.value = String(raw);
      }

      const numFmt = numFmtForKind(kind, currency);
      if (numFmt) {
        cell.numFmt = numFmt;
      }

      cell.font = {
        name: FONT.family,
        size: FONT.dataSize,
        bold: isTotals,
        color: { argb: COLORS.titleText },
      };

      if (isZebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.zebra },
        };
      }

      cell.alignment = {
        vertical: "middle",
        horizontal:
          kind === "number" ||
          kind === "integer" ||
          kind === "currency"
            ? "right"
            : "left",
        wrapText: kind === "text",
      };

      applyBorder(cell);
    });
  }

  table.columns.forEach((column, columnIndex) => {
    const values = table.rows.map((row) => row[column.key]);
    if (table.totalsRow) {
      values.push(table.totalsRow[column.key]);
    }
    sheet.getColumn(columnIndex + 1).width = estimateColumnWidth(column, values);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function sanitizeReportFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}
