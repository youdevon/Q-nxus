/**
 * True for document print preview routes (shell-less; no app chrome).
 * Prefer this broad matcher over per-route allowlists so new print pages
 * stay consistent by default.
 */
export function isPrintDocumentRoute(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return (
    path === "/payroll/print/ready" ||
    path.endsWith("/print") ||
    path.includes("/print/")
  );
}
