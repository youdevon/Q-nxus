import { navigationConfig } from "@/src/config/navigation.config";

export type BreadcrumbCrumb = {
  label: string;
  href: string;
  current: boolean;
};

const STATIC_SEGMENT_LABELS: Record<string, string> = {
  access: "Users and roles",
  allowances: "Allowances",
  amend: "Amend",
  renew: "Renew",
  appraisals: "Appraisals",
  assignments: "Assignments",
  audit: "Audit trail",
  balances: "Balances",
  chart: "Chart",
  close: "Close",
  contracts: "Contracts",
  credentials: "Credentials",
  departments: "Departments",
  documents: "Documents",
  edit: "Edit",
  employees: "Employees",
  expiring: "Expiring",
  "job-description": "Job description",
  "job-descriptions": "Job descriptions",
  leave: "Leave",
  me: "My Profile",
  missing: "Missing documents",
  new: "New",
  notifications: "Notifications",
  "numbering-sequences": "Numbering sequences",
  organization: "Organization",
  payroll: "Payroll",
  payslip: "Payslip",
  people: "Employees",
  positions: "Positions",
  print: "Print",
  qualifications: "Qualifications",
  reporting: "Reporting lines",
  reports: "Reports",
  roles: "Roles",
  settings: "Domain settings",
  structure: "Organization",
  "team-documents": "Team documents",
  training: "Training",
  types: "Types",
  users: "Users",
  workflow: "Workflow",
  email: "System email",
};

/** When an opaque id follows this segment, use this label for the id crumb. */
const ENTITY_LABEL_BY_PARENT: Record<string, string> = {
  allowances: "Allowance",
  appraisals: "Appraisal",
  contracts: "Contract",
  departments: "Department",
  documents: "Document",
  employees: "Employee",
  credentials: "Credential",
  "job-descriptions": "Job description",
  leave: "Request",
  positions: "Position",
  qualifications: "Qualification",
  roles: "Role",
  training: "Training record",
  users: "User",
};

/** Prefer contextual labels for create/new routes. */
const NEW_LABEL_BY_PARENT: Record<string, string> = {
  allowances: "New allowance",
  appraisals: "New appraisal",
  assignments: "New assignment",
  contracts: "New contract",
  credentials: "New credential",
  departments: "New department",
  documents: "New document",
  employees: "New employee",
  "job-descriptions": "New job description",
  leave: "Request leave",
  positions: "New position",
  qualifications: "New qualification",
  roles: "New role",
  training: "New training record",
};

/** Segments that are route folders and should not appear as their own crumb. */
const HIDDEN_SEGMENTS = new Set([
  "positions",
  "departments",
  "employees",
  "job-descriptions",
  "roles",
  "users",
  "allowances",
]);

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^c[a-z0-9]{20,}$|^[a-z0-9]{20,}$/i;

function isIdSegment(segment: string): boolean {
  return ID_PATTERN.test(segment);
}

function titleCaseSegment(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForSegment(
  segment: string,
  parentSegment: string | undefined,
): string {
  if (segment === "new" && parentSegment) {
    return NEW_LABEL_BY_PARENT[parentSegment] ?? "New";
  }

  if (isIdSegment(segment) && parentSegment) {
    return (
      ENTITY_LABEL_BY_PARENT[parentSegment] ?? titleCaseSegment(parentSegment)
    );
  }

  return STATIC_SEGMENT_LABELS[segment] ?? titleCaseSegment(segment);
}

function resolveNavRoot(pathname: string) {
  const items = navigationConfig.flatMap((section) => section.items);

  // Keep all /people/* routes under the Employees root so nested modules
  // (leave, documents, structure) share People breadcrumbs.
  if (pathname === "/people" || pathname.startsWith("/people/")) {
    const peopleItem = items.find((item) => item.href === "/people");
    if (peopleItem) {
      return peopleItem;
    }
  }

  const match = items
    .filter((item) => {
      if (item.href === "/") {
        return false;
      }

      const prefix = item.matchPrefix ?? item.href;
      return pathname.startsWith(prefix);
    })
    .sort((a, b) => {
      const aLen = (a.matchPrefix ?? a.href).length;
      const bLen = (b.matchPrefix ?? b.href).length;
      return bLen - aLen;
    })[0];

  return match ?? null;
}

/**
 * Builds a breadcrumb trail from the pathname using nav roots and
 * known nested route segments. Opaque ids become contextual entity labels.
 */
export function resolveBreadcrumb(pathname: string): BreadcrumbCrumb[] {
  if (pathname === "/" || pathname === "") {
    return [{ label: "Dashboard", href: "/", current: true }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbCrumb[] = [
    { label: "Dashboard", href: "/", current: false },
  ];

  const navRoot = resolveNavRoot(pathname);

  let index = 0;

  if (navRoot) {
    const rootPath = navRoot.matchPrefix ?? navRoot.href;
    const rootSegments = rootPath.split("/").filter(Boolean);
    crumbs.push({
      label: navRoot.title,
      href: navRoot.href,
      current: pathname === navRoot.href,
    });
    index = rootSegments.length;
  }

  let lastVisibleHref = crumbs[crumbs.length - 1]?.href ?? "/";

  while (index < segments.length) {
    const segment = segments[index];
    const parentSegment = index > 0 ? segments[index - 1] : undefined;
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;

    if (HIDDEN_SEGMENTS.has(segment) && !isLast) {
      index += 1;
      continue;
    }

    // Skip repeating the nav root title (e.g. /people already added as Employees)
    if (
      navRoot &&
      href === navRoot.href &&
      crumbs.some((crumb) => crumb.href === navRoot.href)
    ) {
      index += 1;
      continue;
    }

    const label = labelForSegment(segment, parentSegment);

    crumbs.push({
      label,
      href,
      current: isLast,
    });

    lastVisibleHref = href;
    index += 1;
  }

  // Ensure the final crumb is marked current and previous are not
  if (crumbs.length > 0) {
    for (const crumb of crumbs) {
      crumb.current = crumb.href === lastVisibleHref || crumb.href === pathname;
    }

    const last = crumbs[crumbs.length - 1];
    if (last) {
      last.current = true;
      last.href = pathname;
    }
  }

  return crumbs;
}

/**
 * App-header breadcrumbs are redundant when the sidebar + page title
 * already identify the module. Only show them for nested routes.
 */
export function shouldShowAppBreadcrumbs(crumbs: BreadcrumbCrumb[]): boolean {
  const beyondHome = crumbs.filter((crumb) => crumb.href !== "/");
  return beyondHome.length >= 2;
}

/**
 * Drop the Dashboard root and keep at most three crumbs so trails
 * stay short (parent context + current page).
 */
export function simplifyAppBreadcrumbs(
  crumbs: BreadcrumbCrumb[],
): BreadcrumbCrumb[] {
  const withoutHome = crumbs.filter((crumb) => crumb.href !== "/");
  const trimmed = withoutHome.slice(-3);

  return trimmed.map((crumb, index) => ({
    ...crumb,
    current: index === trimmed.length - 1,
  }));
}
