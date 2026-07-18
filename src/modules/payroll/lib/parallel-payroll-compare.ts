/**
 * Parallel payroll comparison harness (Wave E).
 *
 * Compare Q-NXUS posted payslip figures to an external trusted CSV export.
 * Unexplained diffs must be resolved before production go-live.
 *
 * Trusted CSV columns (header required):
 * employeeNumber,grossPay,totalDeductions,netPay,paye,nisEmployee,healthSurcharge
 */

import { moneyDiffCents, roundToCents } from "@/src/modules/payroll/lib/money";

export type ParallelTrustedRow = {
  employeeNumber: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paye?: number;
  nisEmployee?: number;
  healthSurcharge?: number;
};

export type ParallelQxRow = ParallelTrustedRow & {
  employeeName?: string;
};

export type ParallelDiff = {
  employeeNumber: string;
  field: string;
  trusted: number;
  qnxus: number;
  deltaCents: number;
};

export function parseTrustedPayrollCsv(csv: string): ParallelTrustedRow[] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].split(",").map((cell) => cell.replaceAll('"', "").trim());
  const index = Object.fromEntries(header.map((name, i) => [name, i]));

  const required = ["employeeNumber", "grossPay", "totalDeductions", "netPay"];
  for (const key of required) {
    if (index[key] == null) {
      throw new Error(`Trusted CSV missing required column: ${key}`);
    }
  }

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.replaceAll('"', "").trim());
    const num = (key: string) =>
      roundToCents(Number(cells[index[key]] ?? 0));
    return {
      employeeNumber: cells[index.employeeNumber] ?? "",
      grossPay: num("grossPay"),
      totalDeductions: num("totalDeductions"),
      netPay: num("netPay"),
      paye: index.paye != null ? num("paye") : undefined,
      nisEmployee: index.nisEmployee != null ? num("nisEmployee") : undefined,
      healthSurcharge:
        index.healthSurcharge != null ? num("healthSurcharge") : undefined,
    };
  });
}

export function compareParallelPayroll(input: {
  trusted: ParallelTrustedRow[];
  qnxus: ParallelQxRow[];
}): {
  matchedEmployees: number;
  missingInQx: string[];
  missingInTrusted: string[];
  diffs: ParallelDiff[];
} {
  const trustedByNumber = new Map(
    input.trusted.map((row) => [row.employeeNumber, row]),
  );
  const qxByNumber = new Map(input.qnxus.map((row) => [row.employeeNumber, row]));

  const missingInQx = [...trustedByNumber.keys()].filter(
    (id) => !qxByNumber.has(id),
  );
  const missingInTrusted = [...qxByNumber.keys()].filter(
    (id) => !trustedByNumber.has(id),
  );

  const diffs: ParallelDiff[] = [];
  let matchedEmployees = 0;

  for (const [employeeNumber, trusted] of trustedByNumber) {
    const qx = qxByNumber.get(employeeNumber);
    if (!qx) {
      continue;
    }
    matchedEmployees += 1;

    const fields: Array<
      "grossPay" | "totalDeductions" | "netPay" | "paye" | "nisEmployee" | "healthSurcharge"
    > = [
      "grossPay",
      "totalDeductions",
      "netPay",
      "paye",
      "nisEmployee",
      "healthSurcharge",
    ];
    for (const field of fields) {
      const left = trusted[field];
      const right = qx[field];
      if (typeof left !== "number" || typeof right !== "number") {
        continue;
      }
      const delta = moneyDiffCents(left, right);
      if (delta !== 0) {
        diffs.push({
          employeeNumber,
          field,
          trusted: left,
          qnxus: right,
          deltaCents: delta,
        });
      }
    }
  }

  return { matchedEmployees, missingInQx, missingInTrusted, diffs };
}
