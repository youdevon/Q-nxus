"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Network, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { OrganizationChartPosition } from "@/src/modules/hr/data/get-organization-chart";
import {
  buildDepartmentColorMap,
  type DepartmentColor,
} from "@/src/modules/hr/lib/organization-department-colors";

const NODE_WIDTH = 176;
const NODE_HEIGHT = 76;
const HOLDER_NODE_HEIGHT = 52;
const HORIZONTAL_GAP = 24;
const VERTICAL_GAP = 56;
const CHART_PADDING = 32;

type ChartHolder = OrganizationChartPosition["holders"][number];

type PositionLayoutNode = {
  kind: "position";
  position: OrganizationChartPosition;
  children: LayoutNode[];
  centerX: number;
  topY: number;
  subtreeWidth: number;
};

type HolderLayoutNode = {
  kind: "holder";
  holder: ChartHolder;
  parentPositionId: string;
  departmentId: string;
  children: LayoutNode[];
  centerX: number;
  topY: number;
  subtreeWidth: number;
};

type LayoutNode = PositionLayoutNode | HolderLayoutNode;

type PositionedChart = {
  nodes: LayoutNode[];
  width: number;
  height: number;
  departmentColors: Map<string, DepartmentColor>;
  departmentNames: Map<string, string>;
};

function nodeHeight(node: LayoutNode): number {
  return node.kind === "holder" ? HOLDER_NODE_HEIGHT : NODE_HEIGHT;
}

function measureSubtree(node: LayoutNode): number {
  if (node.children.length === 0) {
    node.subtreeWidth = NODE_WIDTH;
    return node.subtreeWidth;
  }

  const childrenWidth = node.children.reduce(
    (total, child, index) =>
      total + measureSubtree(child) + (index > 0 ? HORIZONTAL_GAP : 0),
    0,
  );

  node.subtreeWidth = Math.max(NODE_WIDTH, childrenWidth);

  return node.subtreeWidth;
}

function assignPositions(
  node: LayoutNode,
  left: number,
  topY: number,
): number {
  node.topY = topY;

  if (node.children.length === 0) {
    node.centerX = left + NODE_WIDTH / 2;
    return left + NODE_WIDTH;
  }

  let childLeft = left;
  const childCenters: number[] = [];
  const childTop = topY + nodeHeight(node) + VERTICAL_GAP;

  for (const child of node.children) {
    const childRight = assignPositions(child, childLeft, childTop);

    childCenters.push(child.centerX);
    childLeft = childRight + HORIZONTAL_GAP;
  }

  const firstChild = childCenters[0]!;
  const lastChild = childCenters[childCenters.length - 1]!;

  node.centerX = (firstChild + lastChild) / 2;

  return left + node.subtreeWidth;
}

function holderDisplayName(holder: ChartHolder): string {
  return holder.preferredName ?? holder.employeeName;
}

function createLayoutNode(
  position: OrganizationChartPosition,
  expandedPositionId: string | null,
): PositionLayoutNode {
  const showOccupants =
    position.holders.length >= 2 && expandedPositionId === position.id;

  const holderChildren: LayoutNode[] = showOccupants
    ? position.holders.map((holder) => ({
        kind: "holder" as const,
        holder,
        parentPositionId: position.id,
        departmentId: position.departmentId,
        children: [],
        centerX: 0,
        topY: 0,
        subtreeWidth: 0,
      }))
    : [];

  const reportChildren = position.directReports.map((child) =>
    createLayoutNode(child, expandedPositionId),
  );

  return {
    kind: "position",
    position,
    children: [...holderChildren, ...reportChildren],
    centerX: 0,
    topY: 0,
    subtreeWidth: 0,
  };
}

function layoutForest(
  roots: OrganizationChartPosition[],
  expandedPositionId: string | null,
): PositionedChart {
  const layoutRoots = roots.map((root) =>
    createLayoutNode(root, expandedPositionId),
  );
  const departmentIds = new Set<string>();
  const departmentNames = new Map<string, string>();

  function collectDepartments(node: LayoutNode) {
    if (node.kind === "position") {
      departmentIds.add(node.position.departmentId);
      departmentNames.set(
        node.position.departmentId,
        node.position.departmentName,
      );
    } else {
      departmentIds.add(node.departmentId);
    }

    for (const child of node.children) {
      collectDepartments(child);
    }
  }

  for (const root of layoutRoots) {
    collectDepartments(root);
  }

  let cursor = CHART_PADDING;
  let maxBottom = CHART_PADDING + NODE_HEIGHT;
  let maxRight = CHART_PADDING + NODE_WIDTH;

  for (const root of layoutRoots) {
    measureSubtree(root);
    const right = assignPositions(root, cursor, 0);

    cursor = right + HORIZONTAL_GAP * 2;

    function trackBounds(node: LayoutNode) {
      maxRight = Math.max(
        maxRight,
        node.centerX + NODE_WIDTH / 2 + CHART_PADDING,
      );
      maxBottom = Math.max(
        maxBottom,
        node.topY + nodeHeight(node) + CHART_PADDING,
      );

      for (const child of node.children) {
        trackBounds(child);
      }
    }

    trackBounds(root);
  }

  const allNodes: LayoutNode[] = [];

  function flatten(node: LayoutNode) {
    allNodes.push(node);

    for (const child of node.children) {
      flatten(child);
    }
  }

  for (const root of layoutRoots) {
    flatten(root);
  }

  return {
    nodes: allNodes,
    width: Math.max(maxRight, NODE_WIDTH + CHART_PADDING * 2),
    height: Math.max(maxBottom, NODE_HEIGHT + CHART_PADDING * 2),
    departmentColors: buildDepartmentColorMap([...departmentIds]),
    departmentNames,
  };
}

function getHolderLabel(position: OrganizationChartPosition): string {
  if (position.holders.length === 0) {
    return "Vacant";
  }

  if (position.holders.length === 1) {
    return holderDisplayName(position.holders[0]!);
  }

  return `${position.holders.length} people`;
}

function connectorPath(parent: LayoutNode, child: LayoutNode): string {
  const parentBottom = parent.topY + nodeHeight(parent);
  const childTop = child.topY;
  const midY = parentBottom + (childTop - parentBottom) / 2;

  return [
    `M ${parent.centerX} ${parentBottom}`,
    `L ${parent.centerX} ${midY}`,
    `L ${child.centerX} ${midY}`,
    `L ${child.centerX} ${childTop}`,
  ].join("");
}

type ChartPositionNodeProps = {
  node: PositionLayoutNode;
  colors: DepartmentColor;
  isSelected: boolean;
  isDimmed: boolean;
  isExpanded: boolean;
  onSelectPosition?: (positionId: string) => void;
};

function ChartPositionNode({
  node,
  colors,
  isSelected,
  isDimmed,
  isExpanded,
  onSelectPosition,
}: ChartPositionNodeProps) {
  const holderCount = node.position.holders.length;
  const vacant = holderCount === 0;
  const multiOccupant = holderCount >= 2;
  const holderLabel = getHolderLabel(node.position);
  const left = node.centerX - NODE_WIDTH / 2;

  return (
    <button
      type="button"
      aria-expanded={multiOccupant ? isExpanded : undefined}
      aria-label={
        multiOccupant
          ? `${node.position.title}, ${holderCount} people${
              isExpanded ? ", expanded" : ", collapsed"
            }`
          : undefined
      }
      className={[
        "absolute flex flex-col overflow-hidden rounded-md border text-left transition-[opacity,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "z-10 border-foreground ring-2 ring-foreground/20"
          : "border-border",
        isDimmed ? "opacity-45" : "opacity-100",
      ].join(" ")}
      style={{
        left,
        top: node.topY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        background: colors.background,
        borderColor: isSelected ? undefined : colors.border,
      }}
      onClick={() => onSelectPosition?.(node.position.id)}
    >
      <span className="h-1 shrink-0" style={{ background: colors.accent }} />

      <span className="flex min-h-0 flex-1 flex-col px-2.5 py-2">
        <span className="truncate text-sm font-medium leading-tight">
          {node.position.title}
        </span>

        <span
          className={[
            "mt-1 flex min-w-0 items-center gap-1.5 text-xs leading-tight",
            vacant ? "text-muted-foreground italic" : "text-foreground/80",
          ].join(" ")}
        >
          {multiOccupant ? (
            <>
              <Users className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {holderCount}
              </Badge>
              <span className="truncate">people</span>
            </>
          ) : (
            <span className="truncate">{holderLabel}</span>
          )}
        </span>

        <span className="mt-auto truncate text-[10px] leading-tight text-muted-foreground">
          {node.position.departmentName}
        </span>
      </span>
    </button>
  );
}

type ChartHolderNodeProps = {
  node: HolderLayoutNode;
  colors: DepartmentColor;
  isDimmed: boolean;
};

function ChartHolderNode({ node, colors, isDimmed }: ChartHolderNodeProps) {
  const left = node.centerX - NODE_WIDTH / 2;
  const name = holderDisplayName(node.holder);

  return (
    <div
      className={[
        "absolute flex flex-col overflow-hidden rounded-md border border-dashed text-left",
        isDimmed ? "opacity-45" : "opacity-100",
      ].join(" ")}
      style={{
        left,
        top: node.topY,
        width: NODE_WIDTH,
        height: HOLDER_NODE_HEIGHT,
        background: colors.background,
        borderColor: colors.border,
      }}
    >
      <span
        className="h-1 shrink-0 opacity-70"
        style={{ background: colors.accent }}
      />

      <span className="flex min-h-0 flex-1 flex-col justify-center px-2.5 py-1.5">
        <span className="truncate text-sm font-medium leading-tight">
          {name}
        </span>
        <span className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
          {node.holder.isActing ? "Acting · " : ""}
          {node.holder.employeeNumber}
        </span>
      </span>
    </div>
  );
}

type OrganizationVisualChartProps = {
  roots: OrganizationChartPosition[];
  highlightedPositionId: string | null;
  onSelectPosition?: (positionId: string) => void;
};

function findPositionInForest(
  positions: OrganizationChartPosition[],
  positionId: string,
): OrganizationChartPosition | null {
  for (const position of positions) {
    if (position.id === positionId) {
      return position;
    }

    const nested = findPositionInForest(position.directReports, positionId);

    if (nested) {
      return nested;
    }
  }

  return null;
}

export function OrganizationVisualChart({
  roots,
  highlightedPositionId,
  onSelectPosition,
}: OrganizationVisualChartProps) {
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(
    highlightedPositionId,
  );
  const previousHighlightRef = useRef(highlightedPositionId);

  useEffect(() => {
    if (highlightedPositionId !== previousHighlightRef.current) {
      previousHighlightRef.current = highlightedPositionId;
      setExpandedPositionId(highlightedPositionId);
      return;
    }

    if (!highlightedPositionId) {
      setExpandedPositionId(null);
    }
  }, [highlightedPositionId]);

  const chart = useMemo(
    () => layoutForest(roots, expandedPositionId),
    [roots, expandedPositionId],
  );

  function handleSelectPosition(positionId: string) {
    const position = findPositionInForest(roots, positionId);
    const holderCount = position?.holders.length ?? 0;

    if (holderCount >= 2 && expandedPositionId === positionId) {
      setExpandedPositionId(null);
      return;
    }

    if (holderCount >= 2) {
      setExpandedPositionId(positionId);
    } else {
      setExpandedPositionId(null);
    }

    onSelectPosition?.(positionId);
  }

  if (roots.length === 0) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center border border-border py-12 text-center">
        <div>
          <Network className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No positions to display</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select another department or create positions to build the
            hierarchy.
          </p>
        </div>
      </div>
    );
  }

  const nodeById = new Map(
    chart.nodes
      .filter((node): node is PositionLayoutNode => node.kind === "position")
      .map((node) => [node.position.id, node]),
  );

  const connectors = chart.nodes.flatMap((node) =>
    node.children.map((child) => ({
      key:
        node.kind === "position"
          ? `${node.position.id}-${
              child.kind === "position"
                ? child.position.id
                : child.holder.assignmentId
            }`
          : `${node.holder.assignmentId}-${
              child.kind === "position"
                ? child.position.id
                : child.holder.assignmentId
            }`,
      path: connectorPath(node, child),
    })),
  );

  const hasSelection = highlightedPositionId !== null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-border bg-muted/10">
        <div
          className="relative"
          style={{
            width: chart.width,
            height: chart.height,
            minWidth: "100%",
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 text-border"
            width={chart.width}
            height={chart.height}
            aria-hidden
          >
            {connectors.map((connector) => (
              <path
                key={connector.key}
                d={connector.path}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            ))}
          </svg>

          {chart.nodes.map((node) => {
            if (node.kind === "holder") {
              const colors = chart.departmentColors.get(node.departmentId)!;
              const parentSelected =
                highlightedPositionId === node.parentPositionId;

              return (
                <ChartHolderNode
                  key={`holder-${node.holder.assignmentId}`}
                  node={node}
                  colors={colors}
                  isDimmed={hasSelection && !parentSelected}
                />
              );
            }

            const colors = chart.departmentColors.get(
              node.position.departmentId,
            )!;

            return (
              <ChartPositionNode
                key={node.position.id}
                node={node}
                colors={colors}
                isSelected={highlightedPositionId === node.position.id}
                isExpanded={expandedPositionId === node.position.id}
                isDimmed={
                  hasSelection &&
                  highlightedPositionId !== node.position.id &&
                  !isInReportingLineage(
                    highlightedPositionId,
                    node.position.id,
                    nodeById,
                  )
                }
                onSelectPosition={handleSelectPosition}
              />
            );
          })}
        </div>
      </div>

      {chart.departmentNames.size > 0 && (
        <div className="flex flex-wrap gap-3">
          {[...chart.departmentNames.entries()]
            .sort((left, right) => left[1].localeCompare(right[1]))
            .map(([departmentId, departmentName]) => {
              const colors = chart.departmentColors.get(departmentId)!;

              return (
                <div
                  key={departmentId}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span
                    className="size-2.5 rounded-sm border"
                    style={{
                      background: colors.accent,
                      borderColor: colors.border,
                    }}
                  />
                  {departmentName}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function isInReportingLineage(
  focusPositionId: string,
  nodePositionId: string,
  nodeById: Map<string, PositionLayoutNode>,
): boolean {
  let current = nodeById.get(focusPositionId);

  while (current) {
    if (current.position.id === nodePositionId) {
      return true;
    }

    const parentId = current.position.reportsToPositionId;

    if (!parentId) {
      break;
    }

    current = nodeById.get(parentId);
  }

  current = nodeById.get(nodePositionId);

  while (current) {
    if (current.position.id === focusPositionId) {
      return true;
    }

    const parentId = current.position.reportsToPositionId;

    if (!parentId) {
      break;
    }

    current = nodeById.get(parentId);
  }

  return false;
}
