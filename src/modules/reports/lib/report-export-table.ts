/** Shared column/row model for CSV and styled XLSX report exports. */

export type ReportExportColumnKind =
  | "text"
  | "number"
  | "integer"
  | "currency"
  | "date"
  | "datetime";

export type ReportExportColumn = {
  header: string;
  key: string;
  kind?: ReportExportColumnKind;
  /** Default width hint (characters). */
  width?: number;
  /** ISO currency code for currency columns (default TTD). */
  currency?: string;
  /** Styled XLSX exports — highlight employer contribution columns. */
  xlsxSection?: "employer" | "employer-total";
};

export type ReportExportMetadataLine = {
  label: string;
  value: string;
};

export type ReportExportTable = {
  title: string;
  sheetName?: string;
  metadata?: ReportExportMetadataLine[];
  columns: ReportExportColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  totalsRow?: Record<string, string | number | null | undefined>;
};

export function reportTableToCsvMatrix(table: ReportExportTable): {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
} {
  const headers = table.columns.map((column) => column.header);
  const rows = table.rows.map((row) =>
    table.columns.map((column) => row[column.key] ?? ""),
  );

  if (table.totalsRow) {
    rows.push(
      table.columns.map((column) => table.totalsRow?.[column.key] ?? ""),
    );
  }

  return { headers, rows };
}
