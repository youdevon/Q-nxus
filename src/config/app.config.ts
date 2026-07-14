/**
 * Centralized customer-facing application identity.
 * All UI surfaces should consume these values — never hard-code the display name.
 */
export const appConfig = {
  /** Internal platform codename — not typically shown to end users */
  codename: "Q-NXUS",
  /** Primary name shown in the UI chrome and browser title */
  displayName: "Workforce Hub",
  /** Owning organization */
  organizationName: "Acme Corporation",
  /** Compact label for collapsed sidebar and tight spaces */
  shortName: "WH",
  /** Default browser metadata description */
  description:
    "Modular enterprise platform for human resources, payroll, and operations.",
} as const

export type AppConfig = typeof appConfig
