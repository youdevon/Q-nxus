/**
 * Workforce Hub elevation conventions.
 *
 * Prefer border + light background for content panels.
 * Soft shadow only for floating / sticky controls, dropdowns, and overlays.
 * Do not stack multi-layer shadows or use elevation on static list cards.
 */
export const UI_ELEVATION = {
  /**
   * Flat content panel — border (+ optional light bg) only.
   * Use for cards, payslip documents, org-chart nodes, list frames.
   */
  surface: "border border-border bg-background shadow-none",

  /**
   * Soft raised chrome for floating UI: sticky hamburger shells,
   * dropdown / popover panels, combobox lists.
   */
  raised: "shadow-md ring-1 ring-border/50",

  /**
   * Modal / dialog / sheet elevation above the page.
   */
  overlay: "shadow-lg ring-1 ring-foreground/10",

  /**
   * Auth sign-in panel — floating card clearly lifted from the page canvas.
   * Uses theme tokens so light and dark both keep readable contrast.
   */
  authCard:
    "rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xl shadow-black/10 ring-1 ring-black/5 dark:border-border dark:bg-card dark:shadow-black/50 dark:ring-white/10",
} as const;

/** Class string type for elevation tokens. */
export type UiElevationToken = (typeof UI_ELEVATION)[keyof typeof UI_ELEVATION];
