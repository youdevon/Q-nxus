/**
 * Parallel payroll comparison — diff Q-NXUS posted payslips against a
 * trusted external CSV export (e.g. the outgoing payroll provider's final
 * run) before cutting the legacy system over.
 *
 * Usage:
 *   npx tsx scripts/parallel-payroll-compare.ts --trusted path/to/trusted.csv
 *   npx tsx scripts/parallel-payroll-compare.ts --trusted path/to/trusted.csv --pay-run-id <id>
 *   npm run payroll:parallel -- --trusted path/to/trusted.csv --pay-run-id <id>
 *
 * Trusted CSV columns (header required):
 *   employeeNumber,grossPay,totalDeductions,netPay,paye,nisEmployee,healthSurcharge
 * (paye / nisEmployee / healthSurcharge are optional columns.)
 *
 * Without --pay-run-id, the CSV is parsed and summarized only — a pay run
 * must be identified to diff against POSTED payslips, since the DB does not
 * know which period a bare trusted export corresponds to.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";

import { prisma } from "../lib/prisma";
import {
  compareParallelPayroll,
  parseTrustedPayrollCsv,
  type ParallelQxRow,
} from "../src/modules/payroll/lib/parallel-payroll-compare";
import { extractStatutoryRemittanceRow } from "../src/modules/payroll/lib/statutory-remittance";

function parseArgs(argv: string[]): {
  trustedPath: string | null;
  payRunId: string | null;
} {
  let trustedPath: string | null = null;
  let payRunId: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--trusted") {
      trustedPath = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--pay-run-id") {
      payRunId = argv[i + 1] ?? null;
      i += 1;
    }
  }

  return { trustedPath, payRunId };
}

async function loadQxRowsForPayRun(payRunId: string): Promise<{
  runNumber: string;
  status: string;
  rows: ParallelQxRow[];
}> {
  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    select: { runNumber: true, status: true },
  });

  if (!run) {
    throw new Error(`Pay run not found: ${payRunId}`);
  }

  if (run.status !== "POSTED" && run.status !== "RECONCILED" && run.status !== "CLOSED") {
    throw new Error(
      `Pay run ${run.runNumber} is not posted (status: ${run.status}). Only posted, frozen figures can be parallel-tested.`,
    );
  }

  const slips = await prisma.payslip.findMany({
    where: { payRunId, status: "POSTED" },
    select: {
      employeeNumber: true,
      employeeName: true,
      currency: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      snapshot: true,
    },
  });

  const rows: ParallelQxRow[] = slips.map((slip) => {
    const statutory = extractStatutoryRemittanceRow(slip.snapshot, slip.currency);
    return {
      employeeNumber: slip.employeeNumber,
      employeeName: slip.employeeName,
      grossPay: Number(slip.grossPay.toString()),
      totalDeductions: Number(slip.totalDeductions.toString()),
      netPay: Number(slip.netPay.toString()),
      paye: statutory.paye,
      nisEmployee: statutory.nisEmployee,
      healthSurcharge: statutory.health,
    };
  });

  return { runNumber: run.runNumber, status: run.status, rows };
}

async function main() {
  const { trustedPath, payRunId } = parseArgs(process.argv.slice(2));

  if (!trustedPath) {
    console.error(
      "Usage: npx tsx scripts/parallel-payroll-compare.ts --trusted <path.csv> [--pay-run-id <id>]",
    );
    process.exitCode = 1;
    return;
  }

  const csv = readFileSync(trustedPath, "utf8");
  const trusted = parseTrustedPayrollCsv(csv);
  console.log(`Trusted CSV: ${trusted.length} employee row(s) from ${trustedPath}.`);

  if (!payRunId) {
    console.log(
      "No --pay-run-id given — skipping DB comparison. Pass --pay-run-id <id> to diff against a posted pay run.",
    );
    return;
  }

  const { runNumber, status, rows: qnxus } = await loadQxRowsForPayRun(payRunId);
  console.log(`Pay run ${runNumber} (${status}): ${qnxus.length} posted payslip(s).`);

  const result = compareParallelPayroll({ trusted, qnxus });

  console.log(
    JSON.stringify(
      {
        payRunId,
        runNumber,
        matchedEmployees: result.matchedEmployees,
        missingInQx: result.missingInQx,
        missingInTrusted: result.missingInTrusted,
        diffCount: result.diffs.length,
        diffs: result.diffs,
      },
      null,
      2,
    ),
  );

  if (
    result.diffs.length > 0 ||
    result.missingInQx.length > 0 ||
    result.missingInTrusted.length > 0
  ) {
    console.error(
      `Parallel comparison found ${result.diffs.length} field diff(s), ${result.missingInQx.length} missing in Q-NXUS, ${result.missingInTrusted.length} missing in trusted export.`,
    );
    process.exitCode = 1;
  } else {
    console.log("Parallel comparison matched with no diffs.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
