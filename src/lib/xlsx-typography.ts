/**
 * Shared Excel typography + cell sizing for every XLSX download.
 * Matches the payroll paysheet register (readable on screen / print).
 */

export const XLSX_FONT = {
  family: "Calibri",
  /** Column headers, data rows, and totals. */
  tableSize: 20,
  /** Organization / title / metadata block above each sheet table. */
  headerSectionSize: 24,
} as const;

/** Visual scale for row heights and column widths — paired with large fonts. */
export const XLSX_CELL_SCALE = 2;

export const XLSX_LAYOUT = {
  dataRowHeight: 28 * XLSX_CELL_SCALE,
  headerRowHeight: 34 * XLSX_CELL_SCALE,
  totalsRowHeight: 30 * XLSX_CELL_SCALE,
  metadataRowHeight: 28 * XLSX_CELL_SCALE,
  previewBannerHeight: 32 * XLSX_CELL_SCALE,
  defaultRowHeight: 26 * XLSX_CELL_SCALE,
  viewZoom: 80,
} as const;

export function xlsxTableFont(options?: {
  bold?: boolean;
  color?: string;
}) {
  return {
    name: XLSX_FONT.family,
    size: XLSX_FONT.tableSize,
    bold: options?.bold ?? false,
    ...(options?.color ? { color: { argb: options.color } } : {}),
  };
}

export function xlsxHeaderSectionFont(options?: { color?: string }) {
  return {
    name: XLSX_FONT.family,
    size: XLSX_FONT.headerSectionSize,
    bold: true,
    ...(options?.color ? { color: { argb: options.color } } : {}),
  };
}

/** Apply 20pt Calibri as the default column font for a worksheet. */
export function applyXlsxTableColumnFonts(
  sheet: {
    getColumn: (index: number) => { font?: unknown };
    columnCount?: number;
  },
  columnCount: number,
) {
  const font = xlsxTableFont();
  for (let column = 1; column <= columnCount; column += 1) {
    sheet.getColumn(column).font = font;
  }
}

/**
 * Scale a nominal Excel column width (character units) to match paysheet sizing.
 */
export function scaleXlsxColumnWidth(
  width: number,
  options?: { min?: number; max?: number },
): number {
  const min = (options?.min ?? 10) * XLSX_CELL_SCALE;
  const max = (options?.max ?? 48) * XLSX_CELL_SCALE;
  return Math.min(Math.max(width * XLSX_CELL_SCALE, min), max);
}

/**
 * Estimate a scaled column width from header + sample values (character units).
 */
export function estimateScaledXlsxColumnWidth(input: {
  header: string;
  values: Array<string | number | null | undefined>;
  kind?: "text" | "currency" | "number" | "integer";
  currency?: string;
  min?: number;
  max?: number;
  padding?: number;
}): number {
  const kind = input.kind ?? "text";
  const currency = input.currency ?? "TTD";
  const padding = input.padding ?? 2;

  const valueLengths = input.values.map((value) => {
    if (kind === "currency") {
      if (value == null || value === "") {
        return `${currency} 0.00`.length;
      }
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        return String(value).length;
      }
      return `${currency} ${amount.toLocaleString("en-TT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`.length;
    }
    if (kind === "number" || kind === "integer") {
      if (value == null || value === "") {
        return 0;
      }
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        return String(value).length;
      }
      return amount.toLocaleString("en-TT", {
        minimumFractionDigits: kind === "integer" ? 0 : 2,
        maximumFractionDigits: kind === "integer" ? 0 : 2,
      }).length;
    }
    return value == null ? 0 : String(value).length;
  });

  const maxValueLen = valueLengths.reduce(
    (max, length) => Math.max(max, length),
    0,
  );
  const computed = Math.max(input.header.length, maxValueLen) + padding;
  const kindFloor =
    kind === "currency"
      ? 16
      : kind === "number" || kind === "integer"
        ? 10
        : 12;

  return scaleXlsxColumnWidth(computed, {
    min: input.min ?? kindFloor,
    max: input.max ?? (kind === "text" ? 48 : 24),
  });
}
