/**
 * Workforce Hub typography conventions.
 *
 * Page title — PageHeader / PeoplePageHeader h1: Plus Jakarta Sans
 * Page description — shared subtitle under the title
 * Entity title — detail hero name under PageHeader
 * Section heading — in-page section titles: uppercase body sans
 * Field label — form labels: text-sm font-medium
 * Field hint — helper copy under inputs: text-xs text-muted-foreground
 * Field error — validation messages: text-xs text-destructive
 * Meta label — stat / metadata captions: text-xs text-muted-foreground
 * Auth hero — login / change-password: same size as PageHeader
 */
export const UI_TYPOGRAPHY = {
  pageTitle:
    "font-heading text-2xl font-semibold tracking-tight text-foreground",
  pageDescription: "max-w-2xl text-sm text-muted-foreground",
  entityTitle:
    "font-heading text-xl font-semibold tracking-tight text-foreground",
  sectionHeading:
    "text-sm font-semibold tracking-wide uppercase text-foreground",
  fieldLabel: "text-sm font-medium",
  fieldHint: "text-xs text-muted-foreground",
  fieldError: "text-xs text-destructive",
  metaLabel: "text-xs text-muted-foreground",
  authHero:
    "font-heading text-2xl font-semibold tracking-tight text-foreground",
  /** KPI / money figures on detail pages. */
  moneyValue: "text-lg font-semibold tabular-nums tracking-tight text-foreground",
  moneyHero:
    "font-heading text-xl font-semibold tabular-nums tracking-tight text-foreground",
} as const;

/**
 * Soft surface tokens for app chrome and content blocks.
 * Prefer spacing + subtle dividers over stacked border-y frames.
 * Elevation (shadow vs flat panels) — see `src/config/ui-elevation.ts`.
 */
export const UI_SURFACE = {
  appHeader:
    "border-b border-border/60 bg-background/90 supports-backdrop-filter:bg-background/75 backdrop-blur",
  /**
   * Main content canvas behind PageShell — soft primary wash, not a flat slab.
   * Applied on the AppShell content region (not the sidebar).
   */
  contentCanvas: "ui-content-canvas",
  /** Page title row — breathing room without a hard band border. */
  pageHeaderBand: "pb-1",
  /**
   * Title block accent — primary wash + left bar.
   * Pair with `group/page-header` on the parent for icon hover.
   */
  pageTitleAccent:
    "rounded-r-md border-l-[3px] border-primary bg-primary/5 py-2 pl-3 pr-3",
  /**
   * Sticky entity strip under the app header (top-14).
   * Keeps run/employee identity visible while scrolling long pages.
   */
  stickyEntityContext:
    "sticky top-14 z-10 -mx-4 border-b border-border/50 bg-background/90 px-4 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/75 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
  /** Soft list / inbox frames (no outer border-y). */
  listFrame: "divide-y divide-border/70",
  /** Compact directory rows (desktop-friendly density). */
  listRow: "grid gap-3 py-3.5 md:py-4",
  /** Horizontal scroll for data tables on small screens. */
  tableScroll: "overflow-x-auto",
  /** Empty / placeholder states. */
  emptyState: "py-12 text-center text-sm text-muted-foreground",
  /** Search + filter bars. */
  filterBar: "pb-1",
  /** Stat / summary tiles under a section heading. */
  statsRow: "grid gap-x-8 gap-y-5",
  /** Detail / form field grids. */
  formGrid: "grid gap-5 md:grid-cols-2",
  /** Soft alert / notice strips (keep semantic borders). */
  notice: "border-y py-3 text-sm",
} as const;

/**
 * Subtle interactive motion — soft color + tiny scale, no glow or bounce.
 * Prefer these tokens over one-off hover classes so tabs/buttons feel the same.
 */
export const UI_MOTION = {
  /** Color / transform transitions for interactive controls. */
  interactive:
    "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out motion-reduce:transition-none",
  /**
   * Soft hover/press scale — pair with `interactive`.
   * ~2% lift on hover, slight press-in on active.
   */
  hoverSoft:
    "hover:scale-[1.02] active:scale-[0.985] motion-reduce:transform-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
  /**
   * Tabs, chips, and in-page nav pills — transition + soft scale in one token.
   */
  control:
    "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out hover:scale-[1.02] active:scale-[0.985] motion-reduce:transition-none motion-reduce:transform-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
  /**
   * Idle vs active tab/pill surfaces (pair with `control`).
   */
  tabIdle: "text-muted-foreground hover:bg-muted hover:text-foreground",
  tabActive: "bg-primary/10 text-primary",
  /** Subtle icon nudge inside a hovered control. */
  iconNudge:
    "[&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out hover:[&_svg]:scale-105 motion-reduce:hover:[&_svg]:scale-100",
  iconHover:
    "text-primary transition-colors transition-transform duration-200 ease-out group-hover/page-header:scale-105 group-hover/page-header:text-primary motion-reduce:group-hover/page-header:scale-100",
  backLink:
    "inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-200 ease-out hover:text-primary",
  /** Soft page enter — keep under ~200ms; pair with PageTransition. */
  pageEnter:
    "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both ease-out motion-reduce:animate-none",
} as const;
