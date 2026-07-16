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
