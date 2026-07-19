/**
 * Build-time defaults for product chrome.
 * Live sidebar/org branding resolves via getApplicationChrome()
 * (Organization + ApplicationSetting), not these hardcoded values.
 */
export const appConfig = {
  /** Internal platform codename — not typically shown to end users */
  codename: "Q-NXUS",
  /** Primary product/software name (not the customer organization) */
  displayName: "Workforce Hub",
  /** Fallback owning organization when DB org is missing */
  organizationName: "Organization",
  /** Compact fallback when org short name / code are unavailable */
  shortName: "Org",
  /** Default browser metadata description */
  description:
    "Modular enterprise platform for human resources, payroll, and operations.",
} as const;

export type AppConfig = typeof appConfig;
