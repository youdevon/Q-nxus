export function formatRelativeTime(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  const diffMs = date.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (minutes < 1) return "just now";
  if (minutes < 60) return rtf.format(Math.sign(diffMs) * minutes, "minute");
  if (hours < 24) return rtf.format(Math.sign(diffMs) * hours, "hour");
  return rtf.format(Math.sign(diffMs) * days, "day");
}

type DecimalLike = { toString(): string };

export type MoneyValue = number | string | DecimalLike | null | undefined;

const moneyNumberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type DisplayDateOptions = {
  /** Returned when the value is empty or unparseable. Defaults to "". */
  fallback?: string;
};

function parseDisplayDateParts(
  value: string | Date,
): { year: number; month: number; day: number } | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnly = trimmed.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (
      !Number.isFinite(year) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return { year, month, day };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

/**
 * Display dates as `2025 Jan 20` (year, short month, day).
 * Accepts ISO date strings (`2025-01-20`), ISO datetimes, or Date values.
 * Form inputs and stored values should keep ISO; use this only for UI display.
 */
export function formatDisplayDate(
  value: string | Date | null | undefined,
  options?: DisplayDateOptions,
): string {
  const fallback = options?.fallback ?? "";

  if (value == null || value === "") {
    return fallback;
  }

  const parts = parseDisplayDateParts(value);
  if (!parts) {
    return fallback || (typeof value === "string" ? value : fallback);
  }

  return `${parts.year} ${MONTH_SHORT[parts.month - 1]} ${parts.day}`;
}

/**
 * Display date-times as `2025 Jan 20, 14:32` (UTC clock time from the value).
 */
export function formatDisplayDateTime(
  value: string | Date | null | undefined,
  options?: DisplayDateOptions,
): string {
  const fallback = options?.fallback ?? "";

  if (value == null || value === "") {
    return fallback;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
            ? `${value.trim()}T00:00:00.000Z`
            : value,
        );

  if (Number.isNaN(date.getTime())) {
    return fallback || (typeof value === "string" ? value : fallback);
  }

  const datePart = formatDisplayDate(date, { fallback });
  if (!datePart) {
    return fallback;
  }

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${datePart}, ${hours}:${minutes}`;
}

/**
 * Display-only money formatting: thousand separators and exactly 2 decimals
 * (e.g. `1,234.00`). Optionally prefixes a currency code (`GYD 1,234.00`).
 */
export function formatMoney(
  value: MoneyValue,
  options?: { currency?: string },
): string {
  if (value == null || value === "") {
    return "";
  }

  const numeric = typeof value === "number" ? value : Number(String(value));

  if (!Number.isFinite(numeric)) {
    return "";
  }

  const formatted = moneyNumberFormatter.format(numeric);
  return options?.currency ? `${options.currency} ${formatted}` : formatted;
}

export function formatModuleSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    core: "Core",
    hr: "HR",
    payroll: "Payroll",
    admin: "Admin",
    notifications: "Notifications",
    audit: "Audit",
  };
  return labels[source] ?? source;
}
