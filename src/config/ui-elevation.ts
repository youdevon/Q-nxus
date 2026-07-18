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
} as const;

/** Class string type for elevation tokens. */
export type UiElevationToken = (typeof UI_ELEVATION)[keyof typeof UI_ELEVATION];
