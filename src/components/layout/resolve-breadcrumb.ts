import { navigationConfig } from "@/src/config/navigation.config"

export type BreadcrumbCrumb = {
  label: string
  href: string
  current: boolean
}

const STATIC_SEGMENT_LABELS: Record<string, string> = {
  access: "Users and roles",
  allowances: "Allowances",
  amend: "Amend",
  appraisals: "Appraisals",
  assignments: "Assignments",
  audit: "Audit trail",
  balances: "Leave balances",
  "business-units": "Business units",
  chart: "Organization chart",
  close: "Close",
  contracts: "Contracts",
  departments: "Departments",
  documents: "Documents",
  edit: "Edit",
  employees: "Employees",
  features: "Feature controls",
  "job-description": "Job description",
  "job-descriptions": "Job descriptions",
  leave: "Leave",
  locations: "Locations",
  me: "My profile",
  new: "New",
  notifications: "Notifications",
  "numbering-sequences": "Numbering sequences",
  organization: "Organization",
  payroll: "Payroll",
  people: "People",
  positions: "Positions",
  reporting: "Reporting",
  reports: "Reports",
  roles: "Roles",
  settings: "Domain settings",
  structure: "Structure",
  types: "Leave types",
  users: "Users",
  email: "System email",
}

/** When an opaque id follows this segment, use this label for the id crumb. */
const ENTITY_LABEL_BY_PARENT: Record<string, string> = {
  allowances: "Allowance",
  appraisals: "Appraisal",
  "business-units": "Business unit",
  contracts: "Contract",
  departments: "Department",
  employees: "Employee",
  "job-descriptions": "Job description",
  leave: "Request",
  locations: "Location",
  positions: "Position",
  roles: "Role",
  users: "User",
}

/** Prefer contextual labels for create/new routes. */
const NEW_LABEL_BY_PARENT: Record<string, string> = {
  allowances: "New allowance",
  appraisals: "New appraisal",
  assignments: "New assignment",
  "business-units": "New business unit",
  contracts: "New contract",
  departments: "New department",
  employees: "New employee",
  "job-descriptions": "New job description",
  leave: "New request",
  locations: "New location",
  positions: "New position",
  roles: "New role",
}

/** Segments that are route folders and should not appear as their own crumb. */
const HIDDEN_SEGMENTS = new Set([
  "employees",
  "positions",
  "departments",
  "contracts",
  "appraisals",
  "assignments",
  "job-descriptions",
  "roles",
  "users",
  "allowances",
  "business-units",
])

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^c[a-z0-9]{20,}$|^[a-z0-9]{20,}$/i

function isIdSegment(segment: string): boolean {
  return ID_PATTERN.test(segment)
}

function titleCaseSegment(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function labelForSegment(
  segment: string,
  parentSegment: string | undefined,
): string {
  if (segment === "new" && parentSegment) {
    return NEW_LABEL_BY_PARENT[parentSegment] ?? "New"
  }

  if (isIdSegment(segment) && parentSegment) {
    return (
      ENTITY_LABEL_BY_PARENT[parentSegment] ?? titleCaseSegment(parentSegment)
    )
  }

  return STATIC_SEGMENT_LABELS[segment] ?? titleCaseSegment(segment)
}

function resolveNavRoot(pathname: string) {
  const items = navigationConfig.flatMap((section) => section.items)

  const match = items
    .filter((item) => item.href !== "/" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return match ?? null
}

/**
 * Builds a breadcrumb trail from the pathname using nav roots and
 * known nested route segments. Opaque ids become contextual entity labels.
 */
export function resolveBreadcrumb(pathname: string): BreadcrumbCrumb[] {
  if (pathname === "/" || pathname === "") {
    return [{ label: "Dashboard", href: "/", current: true }]
  }

  const segments = pathname.split("/").filter(Boolean)
  const crumbs: BreadcrumbCrumb[] = [
    { label: "Dashboard", href: "/", current: false },
  ]

  const navRoot = resolveNavRoot(pathname)

  let index = 0

  if (navRoot) {
    const rootSegments = navRoot.href.split("/").filter(Boolean)
    crumbs.push({
      label: navRoot.title,
      href: navRoot.href,
      current: pathname === navRoot.href,
    })
    index = rootSegments.length
  }

  let lastVisibleHref = crumbs[crumbs.length - 1]?.href ?? "/"

  while (index < segments.length) {
    const segment = segments[index]
    const parentSegment = index > 0 ? segments[index - 1] : undefined
    const href = `/${segments.slice(0, index + 1).join("/")}`
    const isLast = index === segments.length - 1

    if (HIDDEN_SEGMENTS.has(segment) && !isLast) {
      index += 1
      continue
    }

    // Skip repeating the nav root title (e.g. /people already added as People)
    if (
      navRoot &&
      href === navRoot.href &&
      crumbs.some((crumb) => crumb.href === navRoot.href)
    ) {
      index += 1
      continue
    }

    const label = labelForSegment(segment, parentSegment)

    crumbs.push({
      label,
      href,
      current: isLast,
    })

    lastVisibleHref = href
    index += 1
  }

  // Ensure the final crumb is marked current and previous are not
  if (crumbs.length > 0) {
    for (const crumb of crumbs) {
      crumb.current = crumb.href === lastVisibleHref || crumb.href === pathname
    }

    const last = crumbs[crumbs.length - 1]
    if (last) {
      last.current = true
      last.href = pathname
    }
  }

  return crumbs
}
