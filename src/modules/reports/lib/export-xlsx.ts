import type {
  ReportExportColumn,
  ReportExportColumnKind,
  ReportExportTable,
} from "@/src/modules/reports/lib/report-export-table";
import {
  estimateScaledXlsxColumnWidth,
  XLSX_LAYOUT,
  xlsxHeaderSectionFont,
  xlsxTableFont,
} from "@/src/lib/xlsx-typography";

/** Corporate report palette — subtle, finance-friendly. */
const COLORS = {
  headerFill: "FF334155",
  headerText: "FFFFFFFF",
  titleText: "FF0F172A",
  metaText: "FF64748B",
  border: "FFE2E8F0",
  zebra: "FFF8FAFC",
  totals: "FFE2E8F0",
  employerHeader: "FFBAE6FD",
  employerHeaderText: "FF0C4A6E",
  employerCell: "FFE0F2FE",
  employerCellText: "FF082F49",
  employerTotalHeader: "FF7DD3FC",
  employerTotalCell: "FFBAE6FD",
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

function estimateColumnWidth(
  column: ReportExportColumn,
  values: Array<string | number | null | undefined>,
): number {
  return estimateScaledXlsxColumnWidth({
    header: column.header,
    values,
    kind: column.kind,
    currency: column.currency,
    min: column.width,
    padding: 3,
  });
}

function employerHeaderColors(section: "employer" | "employer-total") {
  return section === "employer-total"
    ? {
        fill: COLORS.employerTotalHeader,
        text: COLORS.employerHeaderText,
      }
    : {
        fill: COLORS.employerHeader,
        text: COLORS.employerHeaderText,
      };
}

function employerDataColors(
  section: "employer" | "employer-total",
  isTotals: boolean,
) {
  if (isTotals) {
    return {
      fill:
        section === "employer-total"
          ? COLORS.employerTotalHeader
          : COLORS.employerHeader,
      text: COLORS.employerCellText,
    };
  }

  return {
    fill:
      section === "employer-total"
        ? COLORS.employerTotalCell
        : COLORS.employerCell,
    text: COLORS.employerCellText,
  };
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
  // Lazy-load ExcelJS so export routes boot without compiling the full package.
  const ExcelJS = (await import("exceljs")).default;
  const { table, organizationName } = input;
  const generatedAt = input.generatedAt ?? new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Q-NXUS";
  workbook.created = generatedAt;

  const sheetName = (table.sheetName ?? "Report").slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    views: [
      {
        state: "frozen",
        ySplit: 1,
        activeCell: "A1",
        zoomScale: XLSX_LAYOUT.viewZoom,
      },
    ],
    properties: { defaultRowHeight: XLSX_LAYOUT.defaultRowHeight },
  });

  const thinBorder = {
    top: { style: "thin" as const, color: { argb: COLORS.border } },
    left: { style: "thin" as const, color: { argb: COLORS.border } },
    bottom: { style: "thin" as const, color: { argb: COLORS.border } },
    right: { style: "thin" as const, color: { argb: COLORS.border } },
  };

  let rowIndex = 1;

  if (organizationName) {
    const row = sheet.getRow(rowIndex++);
    row.height = XLSX_LAYOUT.metadataRowHeight;
    const cell = row.getCell(1);
    cell.value = organizationName;
    cell.font = xlsxHeaderSectionFont({ color: COLORS.titleText });
  }

  {
    const row = sheet.getRow(rowIndex++);
    row.height = XLSX_LAYOUT.metadataRowHeight;
    const cell = row.getCell(1);
    cell.value = table.title;
    cell.font = xlsxHeaderSectionFont({ color: COLORS.titleText });
  }

  {
    const row = sheet.getRow(rowIndex++);
    row.height = XLSX_LAYOUT.metadataRowHeight;
    const cell = row.getCell(1);
    cell.value = `Generated ${generatedAt.toLocaleString("en-TT", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
    cell.font = xlsxHeaderSectionFont({ color: COLORS.metaText });
  }

  for (const line of table.metadata ?? []) {
    const row = sheet.getRow(rowIndex++);
    row.height = XLSX_LAYOUT.metadataRowHeight;
    const cell = row.getCell(1);
    cell.value = `${line.label}: ${line.value}`;
    cell.font = xlsxHeaderSectionFont({ color: COLORS.metaText });
  }

  rowIndex += 1;

  const headerRowIndex = rowIndex;
  const headerRow = sheet.getRow(rowIndex++);
  headerRow.height = XLSX_LAYOUT.headerRowHeight;

  const columnCount = table.columns.length;
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const column = table.columns[columnIndex];
    const cell = headerRow.getCell(columnIndex + 1);
    cell.value = column.header;
    const employerSection = column.xlsxSection;
    const employerHeader = employerSection
      ? employerHeaderColors(employerSection)
      : null;
    cell.font = xlsxTableFont({
      bold: true,
      color: employerHeader?.text ?? COLORS.headerText,
    });
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: employerHeader?.fill ?? COLORS.headerFill },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = thinBorder;
  }

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
    const isTotals =
      table.totalsRow != null && dataIndex === dataRows.length - 1;
    const isZebra = !isTotals && dataIndex % 2 === 1;

    const row = sheet.getRow(rowIndex++);
    row.height = isTotals
      ? XLSX_LAYOUT.totalsRowHeight
      : XLSX_LAYOUT.dataRowHeight;

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const column = table.columns[columnIndex];
      const cell = row.getCell(columnIndex + 1);
      const raw = sourceRow[column.key];
      const kind = column.kind ?? "text";
      const currency = column.currency ?? "TTD";

      if (kind === "text" || raw == null || raw === "") {
        cell.value = raw == null || raw === "" ? "" : String(raw);
      } else if (kind === "integer") {
        cell.value = Number(raw);
      } else if (kind === "number" || kind === "currency") {
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

      const employerSection = column.xlsxSection;
      const employerData = employerSection
        ? employerDataColors(employerSection, isTotals)
        : null;

      cell.font = xlsxTableFont({
        bold: isTotals,
        color: employerData?.text ?? COLORS.titleText,
      });

      if (employerData) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: employerData.fill },
        };
      } else if (isTotals) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.totals },
        };
      } else if (isZebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.zebra },
        };
      }

      cell.alignment = {
        vertical: "middle",
        horizontal:
          kind === "number" || kind === "integer" || kind === "currency"
            ? "right"
            : "left",
        wrapText: false,
      };

      cell.border = thinBorder;
    }
  }

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const column = table.columns[columnIndex];
    const values = table.rows.map((row) => row[column.key]);
    if (table.totalsRow) {
      values.push(table.totalsRow[column.key]);
    }
    values.push(column.header);
    sheet.getColumn(columnIndex + 1).width = estimateColumnWidth(
      column,
      values,
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function sanitizeReportFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}
