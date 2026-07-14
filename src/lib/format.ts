export function formatRelativeTime(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate)
  const diffMs = date.getTime() - now.getTime()
  const absMs = Math.abs(diffMs)
  const minutes = Math.round(absMs / 60_000)
  const hours = Math.round(absMs / 3_600_000)
  const days = Math.round(absMs / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (minutes < 1) return "just now"
  if (minutes < 60) return rtf.format(Math.sign(diffMs) * minutes, "minute")
  if (hours < 24) return rtf.format(Math.sign(diffMs) * hours, "hour")
  return rtf.format(Math.sign(diffMs) * days, "day")
}

export function formatModuleSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    core: "Core",
    hr: "HR",
    payroll: "Payroll",
    admin: "Admin",
    notifications: "Notifications",
    audit: "Audit",
  }
  return labels[source] ?? source
}
