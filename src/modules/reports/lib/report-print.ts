/** Build a dedicated print route URL, preserving current filter query params. */
export function reportPrintHref(
  basePath: string,
  searchParams?: Record<string, string | undefined | null>,
): string {
  const normalized = basePath.replace(/\/$/, "");
  const printPath = `${normalized}/print`;
  const params = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null && value !== "") {
        params.set(key, value);
      }
    }
  }

  const query = params.toString();
  return query ? `${printPath}?${query}` : printPath;
}

export function formatReportGeneratedAt(date: Date = new Date()): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
