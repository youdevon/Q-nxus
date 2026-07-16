/**
 * Workforce Hub typography conventions.
 *
 * Page title — PageHeader h1: text-2xl font-semibold tracking-tight
 * Entity title — detail hero name under PageHeader: text-xl …
 * Section heading — in-page section titles: text-sm … uppercase
 * Field label — form labels: text-sm font-medium
 * Field hint — helper copy under inputs: text-xs text-muted-foreground
 * Field error — validation messages: text-xs text-destructive
 * Meta label — stat / metadata captions: text-xs text-muted-foreground
 * Auth hero — login / change-password: same size as PageHeader (text-2xl)
 */
export const UI_TYPOGRAPHY = {
  pageTitle: "text-2xl font-semibold tracking-tight text-foreground",
  entityTitle: "text-xl font-semibold tracking-tight text-foreground",
  sectionHeading:
    "text-sm font-semibold tracking-wide uppercase text-foreground",
  fieldLabel: "text-sm font-medium",
  fieldHint: "text-xs text-muted-foreground",
  fieldError: "text-xs text-destructive",
  metaLabel: "text-xs text-muted-foreground",
  authHero: "text-2xl font-semibold tracking-tight text-foreground",
} as const;

/**
 * Soft surface tokens for app chrome and content blocks.
 * Prefer spacing + subtle dividers over stacked border-y frames.
 */
export const UI_SURFACE = {
  appHeader:
    "border-b border-border/60 bg-background/90 supports-backdrop-filter:bg-background/75 backdrop-blur",
  /** Page title row — breathing room without a hard band border. */
  pageHeaderBand: "pb-1",
  pageTitleAccent: "border-l-[3px] border-primary pl-3",
  /** Soft list / inbox frames (no outer border-y). */
  listFrame: "divide-y divide-border/70",
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
