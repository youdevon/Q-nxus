import type {
  OrganizationChartData,
  OrganizationChartPosition,
} from "@/src/modules/hr/data/get-organization-chart";

export type OrganizationSelection =
  | { type: "org" }
  | { type: "department"; departmentId: string }
  | { type: "position"; positionId: string };

export type OrganizationDiagramView = {
  title: string;
  description: string;
  roots: OrganizationChartPosition[];
  ancestors: OrganizationChartPosition[];
  highlightedPositionId: string | null;
  unassignedPositions: OrganizationChartPosition[];
};

function visitPosition(
  position: OrganizationChartPosition,
  map: Map<string, OrganizationChartPosition>,
) {
  if (map.has(position.id)) {
    return;
  }

  map.set(position.id, position);

  for (const child of position.directReports) {
    visitPosition(child, map);
  }
}

export function flattenOrganizationPositions(
  data: OrganizationChartData,
): Map<string, OrganizationChartPosition> {
  const map = new Map<string, OrganizationChartPosition>();

  for (const position of data.rootPositions) {
    visitPosition(position, map);
  }

  for (const position of data.unassignedPositions) {
    visitPosition(position, map);
  }

  return map;
}

/** Eligible reports-to options for a position (excludes self and descendants). */
export function getEligibleReportingManagers(
  positionId: string,
  positionMap: Map<string, OrganizationChartPosition>,
): OrganizationChartPosition[] {
  const childrenByParent = new Map<string, string[]>();

  for (const position of positionMap.values()) {
    if (!position.reportsToPositionId) {
      continue;
    }

    const children = childrenByParent.get(position.reportsToPositionId) ?? [];
    children.push(position.id);
    childrenByParent.set(position.reportsToPositionId, children);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(positionId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (descendants.has(current)) {
      continue;
    }

    descendants.add(current);
    queue.push(...(childrenByParent.get(current) ?? []));
  }

  const excluded = new Set([positionId, ...descendants]);

  return [...positionMap.values()]
    .filter((position) => position.isActive && !excluded.has(position.id))
    .sort((left, right) => {
      const departmentCompare = left.departmentName.localeCompare(
        right.departmentName,
      );

      if (departmentCompare !== 0) {
        return departmentCompare;
      }

      return left.title.localeCompare(right.title);
    });
}

function filterSubtreeToDepartment(
  position: OrganizationChartPosition,
  departmentId: string,
): OrganizationChartPosition {
  return {
    ...position,
    directReports: position.directReports
      .filter((child) => child.departmentId === departmentId)
      .map((child) => filterSubtreeToDepartment(child, departmentId)),
  };
}

function getDepartmentRoots(
  departmentId: string,
  positionMap: Map<string, OrganizationChartPosition>,
): OrganizationChartPosition[] {
  const inDepartment = [...positionMap.values()].filter(
    (position) => position.departmentId === departmentId,
  );

  const roots = inDepartment.filter((position) => {
    if (!position.reportsToPositionId) {
      return true;
    }

    const parent = positionMap.get(position.reportsToPositionId);

    return !parent || parent.departmentId !== departmentId;
  });

  return roots.map((position) =>
    filterSubtreeToDepartment(position, departmentId),
  );
}

function getPositionAncestors(
  position: OrganizationChartPosition,
  positionMap: Map<string, OrganizationChartPosition>,
): OrganizationChartPosition[] {
  const ancestors: OrganizationChartPosition[] = [];
  let parentId = position.reportsToPositionId;

  while (parentId) {
    const parent = positionMap.get(parentId);

    if (!parent) {
      break;
    }

    ancestors.unshift(parent);
    parentId = parent.reportsToPositionId;
  }

  return ancestors;
}

export function buildOrganizationDiagramView(
  data: OrganizationChartData,
  selection: OrganizationSelection,
  departmentName?: string,
): OrganizationDiagramView {
  const positionMap = flattenOrganizationPositions(data);

  if (selection.type === "org") {
    return {
      title: "Whole organization",
      description: `${data.organization.name} reporting hierarchy`,
      roots: data.rootPositions,
      ancestors: [],
      highlightedPositionId: null,
      unassignedPositions: data.unassignedPositions,
    };
  }

  if (selection.type === "department") {
    const roots = getDepartmentRoots(selection.departmentId, positionMap);

    return {
      title: departmentName ?? "Department",
      description:
        "Positions in this department and their internal reporting lines",
      roots,
      ancestors: [],
      highlightedPositionId: null,
      unassignedPositions: [],
    };
  }

  const focus = positionMap.get(selection.positionId);

  if (!focus) {
    return {
      title: "Position not found",
      description: "This position is not available in the current chart",
      roots: [],
      ancestors: [],
      highlightedPositionId: null,
      unassignedPositions: [],
    };
  }

  return {
    title: focus.title,
    description: `${focus.departmentName} · reporting lines`,
    roots: [focus],
    ancestors: getPositionAncestors(focus, positionMap),
    highlightedPositionId: focus.id,
    unassignedPositions: [],
  };
}
