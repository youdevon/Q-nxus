function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
