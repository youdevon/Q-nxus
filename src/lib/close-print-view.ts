/**
 * Leave a shell-less print preview.
 *
 * Prefer closing a script-opened tab; otherwise navigate immediately to the
 * fallback (App Router often has an empty referrer, and history.back is
 * unreliable). Optional same-origin referrer is used when it is clearly a
 * non-print parent page.
 */

import { isPrintDocumentRoute } from "@/src/lib/is-print-document-route";

export function closePrintView(fallbackHref: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const fallback =
    fallbackHref.trim().length > 0 ? fallbackHref.trim() : "/payroll";

  if (window.opener && !window.opener.closed) {
    try {
      window.close();
    } catch {
      // Fall through to navigation when the browser blocks window.close().
    }
    // If close worked, this document is gone; if not, navigate below.
  }

  const referrer = document.referrer;
  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      const sameOrigin = refUrl.origin === window.location.origin;
      const differentPage = refUrl.href !== window.location.href;
      const notAnotherPrint = !isPrintDocumentRoute(refUrl.pathname);
      if (sameOrigin && differentPage && notAnotherPrint) {
        window.location.replace(refUrl.pathname + refUrl.search + refUrl.hash);
        return;
      }
    } catch {
      // Invalid referrer — use fallback.
    }
  }

  window.location.replace(fallback);
}
