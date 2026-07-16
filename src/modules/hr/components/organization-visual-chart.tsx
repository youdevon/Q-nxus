"use client";

import { useMemo } from "react";
import { Network } from "lucide-react";

import type { OrganizationChartPosition } from "@/src/modules/hr/data/get-organization-chart";
import {
  buildDepartmentColorMap,
  type DepartmentColor,
} from "@/src/modules/hr/lib/organization-department-colors";

const NODE_WIDTH = 176;
const NODE_HEIGHT = 76;
const HORIZONTAL_GAP = 24;
const VERTICAL_GAP = 56;
const CHART_PADDING = 32;

type LayoutNode = {
  position: OrganizationChartPosition;
  children: LayoutNode[];
  centerX: number;
  topY: number;
  subtreeWidth: number;
};

type PositionedChart = {
  nodes: LayoutNode[];
  width: number;
  height: number;
  departmentColors: Map<string, DepartmentColor>;
  departmentNames: Map<string, string>;
};

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
  depth: number,
): number {
  node.topY = depth * (NODE_HEIGHT + VERTICAL_GAP);

  if (node.children.length === 0) {
    node.centerX = left + NODE_WIDTH / 2;
    return left + NODE_WIDTH;
  }

  let childLeft = left;
  const childCenters: number[] = [];

  for (const child of node.children) {
    const childRight = assignPositions(child, childLeft, depth + 1);

    childCenters.push(child.centerX);
    childLeft = childRight + HORIZONTAL_GAP;
  }

  const firstChild = childCenters[0]!;
  const lastChild = childCenters[childCenters.length - 1]!;

  node.centerX = (firstChild + lastChild) / 2;

  return left + node.subtreeWidth;
}

function createLayoutNode(position: OrganizationChartPosition): LayoutNode {
  return {
    position,
    children: position.directReports.map(createLayoutNode),
    centerX: 0,
    topY: 0,
    subtreeWidth: 0,
  };
}

function layoutForest(roots: OrganizationChartPosition[]): PositionedChart {
  const layoutRoots = roots.map(createLayoutNode);
  const departmentIds = new Set<string>();
  const departmentNames = new Map<string, string>();

  function collectDepartments(node: LayoutNode) {
    departmentIds.add(node.position.departmentId);
    departmentNames.set(
      node.position.departmentId,
      node.position.departmentName,
    );

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

    root.centerX += 0;
    cursor = right + HORIZONTAL_GAP * 2;

    function trackBounds(node: LayoutNode) {
      maxRight = Math.max(
        maxRight,
        node.centerX + NODE_WIDTH / 2 + CHART_PADDING,
      );
      maxBottom = Math.max(maxBottom, node.topY + NODE_HEIGHT + CHART_PADDING);

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

  const holder = position.holders[0]!;

  return holder.preferredName ?? holder.employeeName;
}

function connectorPath(parent: LayoutNode, child: LayoutNode): string {
  const parentBottom = parent.topY + NODE_HEIGHT;
  const childTop = child.topY;
  const midY = parentBottom + (childTop - parentBottom) / 2;

  return [
    `M ${parent.centerX} ${parentBottom}`,
    `L ${parent.centerX} ${midY}`,
    `L ${child.centerX} ${midY}`,
    `L ${child.centerX} ${childTop}`,
  ].join("");
}

type ChartNodeProps = {
  node: LayoutNode;
  colors: DepartmentColor;
  isSelected: boolean;
  isDimmed: boolean;
  onSelectPosition?: (positionId: string) => void;
};

function ChartNode({
  node,
  colors,
  isSelected,
  isDimmed,
  onSelectPosition,
}: ChartNodeProps) {
  const holderLabel = getHolderLabel(node.position);
  const vacant = node.position.holders.length === 0;
  const left = node.centerX - NODE_WIDTH / 2;

  return (
    <button
      type="button"
      className={[
        "absolute flex flex-col overflow-hidden rounded-md border text-left shadow-sm transition-[opacity,box-shadow,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "z-10 border-foreground shadow-md ring-2 ring-foreground/20"
          : "border-border hover:shadow-md",
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
            "mt-1 truncate text-xs leading-tight",
            vacant ? "text-muted-foreground italic" : "text-foreground/80",
          ].join(" ")}
        >
          {holderLabel}
        </span>

        <span className="mt-auto truncate text-[10px] leading-tight text-muted-foreground">
          {node.position.departmentName}
        </span>
      </span>
    </button>
  );
}

type OrganizationVisualChartProps = {
  roots: OrganizationChartPosition[];
  highlightedPositionId: string | null;
  onSelectPosition?: (positionId: string) => void;
};

export function OrganizationVisualChart({
  roots,
  highlightedPositionId,
  onSelectPosition,
}: OrganizationVisualChartProps) {
  const chart = useMemo(() => layoutForest(roots), [roots]);

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

  const nodeById = new Map(chart.nodes.map((node) => [node.position.id, node]));

  const connectors = chart.nodes.flatMap((node) =>
    node.children.map((child) => ({
      key: `${node.position.id}-${child.position.id}`,
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
            const colors = chart.departmentColors.get(
              node.position.departmentId,
            )!;

            return (
              <ChartNode
                key={node.position.id}
                node={node}
                colors={colors}
                isSelected={highlightedPositionId === node.position.id}
                isDimmed={
                  hasSelection &&
                  highlightedPositionId !== node.position.id &&
                  !isInReportingLineage(
                    highlightedPositionId,
                    node.position.id,
                    nodeById,
                  )
                }
                onSelectPosition={onSelectPosition}
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
  nodeById: Map<string, LayoutNode>,
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
