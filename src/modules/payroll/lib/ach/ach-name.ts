/**
 * ACH Individual Name sanitising / formatting (positions 55–76).
 */

import {
  FCB_LEGACY_FIELD_WIDTHS,
  padRightFixed,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import type { FcbAchNameFormat } from "@/src/modules/payroll/lib/ach/fcb-tt-config";

/** Allowed after sanitise: A–Z, 0–9, space, hyphen, apostrophe, period. */
const ALLOWED = /[^A-Z0-9 \-'.]/g;

const TRANSLIT: Record<string, string> = {
  Á: "A",
  À: "A",
  Â: "A",
  Ä: "A",
  Ã: "A",
  Å: "A",
  É: "E",
  È: "E",
  Ê: "E",
  Ë: "E",
  Í: "I",
  Ì: "I",
  Î: "I",
  Ï: "I",
  Ó: "O",
  Ò: "O",
  Ô: "O",
  Ö: "O",
  Õ: "O",
  Ú: "U",
  Ù: "U",
  Û: "U",
  Ü: "U",
  Ý: "Y",
  Ç: "C",
  Ñ: "N",
  Æ: "AE",
  Œ: "OE",
  Ø: "O",
  ß: "SS",
  "'": "'",
  "’": "'",
  "`": "'",
  "´": "'",
};

/** Uppercase, transliterate accents, strip disallowed characters. */
export function sanitizeAchReceiverNameChars(raw: string): string {
  const upper = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (TRANSLIT[ch]) {
      out += TRANSLIT[ch];
      continue;
    }
    out += ch;
  }
  return out.replace(ALLOWED, "").replace(/\s+/g, " ").trim();
}

/**
 * Default known-good format: FIRST + two spaces + LAST (remainder).
 * Each part is trimmed before join; result truncated/padded to 22.
 */
export function formatAchReceiverNameParts(
  name: string,
  format: FcbAchNameFormat = "FIRST_TWO_SPACES_LAST",
): string {
  const cleaned = sanitizeAchReceiverNameChars(name);
  if (!cleaned) {
    return padRightFixed("", FCB_LEGACY_FIELD_WIDTHS.receiverName);
  }

  if (format === "FIRST_TWO_SPACES_LAST") {
    const space = cleaned.indexOf(" ");
    const formatted =
      space < 0
        ? cleaned
        : `${cleaned.slice(0, space).trim()}  ${cleaned.slice(space + 1).trim()}`;
    return padRightFixed(formatted, FCB_LEGACY_FIELD_WIDTHS.receiverName);
  }

  return padRightFixed(cleaned, FCB_LEGACY_FIELD_WIDTHS.receiverName);
}
