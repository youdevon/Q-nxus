export type DepartmentColor = {
  background: string;
  border: string;
  accent: string;
};

const DEPARTMENT_PALETTE: DepartmentColor[] = [
  {
    background:
      "color-mix(in oklch, oklch(0.52 0.12 250) 10%, var(--background))",
    border: "oklch(0.52 0.12 250)",
    accent: "oklch(0.52 0.12 250)",
  },
  {
    background:
      "color-mix(in oklch, oklch(0.55 0.11 200) 10%, var(--background))",
    border: "oklch(0.55 0.11 200)",
    accent: "oklch(0.55 0.11 200)",
  },
  {
    background:
      "color-mix(in oklch, oklch(0.52 0.1 155) 10%, var(--background))",
    border: "oklch(0.52 0.1 155)",
    accent: "oklch(0.52 0.1 155)",
  },
  {
    background:
      "color-mix(in oklch, oklch(0.58 0.1 85) 12%, var(--background))",
    border: "oklch(0.58 0.1 85)",
    accent: "oklch(0.58 0.1 85)",
  },
  {
    background:
      "color-mix(in oklch, oklch(0.55 0.1 25) 10%, var(--background))",
    border: "oklch(0.55 0.1 25)",
    accent: "oklch(0.55 0.1 25)",
  },
  {
    background:
      "color-mix(in oklch, oklch(0.52 0.12 305) 10%, var(--background))",
    border: "oklch(0.52 0.12 305)",
    accent: "oklch(0.52 0.12 305)",
  },
  {
    background:
      "color-mix(in oklch, oklch(0.56 0.1 55) 12%, var(--background))",
    border: "oklch(0.56 0.1 55)",
    accent: "oklch(0.56 0.1 55)",
  },
  {
    background:
      "color-mix(in oklch, oklch(0.5 0.09 280) 10%, var(--background))",
    border: "oklch(0.5 0.09 280)",
    accent: "oklch(0.5 0.09 280)",
  },
];

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

export function getDepartmentColor(departmentId: string): DepartmentColor {
  return DEPARTMENT_PALETTE[
    hashString(departmentId) % DEPARTMENT_PALETTE.length
  ];
}

export function buildDepartmentColorMap(
  departmentIds: string[],
): Map<string, DepartmentColor> {
  const map = new Map<string, DepartmentColor>();

  for (const departmentId of departmentIds) {
    map.set(departmentId, getDepartmentColor(departmentId));
  }

  return map;
}
