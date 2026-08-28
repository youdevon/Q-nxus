/**
 * Backfill EmployeeBankAccount.routingNumber from the linked financial
 * institution's routingCode (or TT catalog fallback) where the account
 * routing field is blank.
 *
 * Keeps ACH exports and the payroll setup ABA field consistent without
 * requiring a manual re-save on each employee.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-employee-bank-routing.ts
 *   npx tsx --env-file=.env scripts/backfill-employee-bank-routing.ts --apply
 *
 * Default is dry-run (report only). Pass --apply to write.
 */
import "dotenv/config";

import { prisma } from "../lib/prisma";
import { getTtFinancialInstitutionById } from "../src/modules/payroll/lib/tt-financial-institutions";

function parseArgs(argv: string[]) {
  return { apply: argv.includes("--apply") };
}

function maskLast4(lastFour: string | null | undefined): string {
  const digits = (lastFour ?? "").replace(/\D/g, "").slice(-4);
  return digits ? `****${digits}` : "****????";
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));

  const rows = await prisma.employeeBankAccount.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      financialInstitutionId: { not: null },
      OR: [{ routingNumber: null }, { routingNumber: "" }],
    },
    select: {
      id: true,
      accountNumberLastFour: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      financialInstitution: {
        select: {
          shortName: true,
          displayName: true,
          routingCode: true,
          achParticipantCode: true,
          catalogKey: true,
        },
      },
    },
    orderBy: [{ employee: { employeeNumber: "asc" } }],
  });

  type Candidate = {
    id: string;
    employeeNumber: string;
    name: string;
    institution: string;
    accountMasked: string;
    routing: string;
  };

  const candidates: Candidate[] = [];

  for (const row of rows) {
    const fi = row.financialInstitution;
    if (!fi) continue;

    const fromDb =
      fi.routingCode?.trim() || fi.achParticipantCode?.trim() || "";
    const fromCatalog =
      (fi.catalogKey
        ? getTtFinancialInstitutionById(fi.catalogKey)?.routingCode?.trim()
        : "") || "";
    const routing = fromDb || fromCatalog;
    if (!routing) continue;

    candidates.push({
      id: row.id,
      employeeNumber: row.employee.employeeNumber,
      name: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      institution: fi.shortName || fi.displayName,
      accountMasked: maskLast4(row.accountNumberLastFour),
      routing,
    });
  }

  console.log(
    `Active accounts with blank routing + linked FI: ${rows.length}`,
  );
  console.log(
    `Candidates with known institution/catalog routing: ${candidates.length}`,
  );
  console.log(apply ? "Mode: APPLY" : "Mode: DRY-RUN (pass --apply to write)");
  console.log("");

  for (const c of candidates) {
    console.log(
      `#${c.employeeNumber} ${c.name} | ${c.institution} | ${c.accountMasked} | → ${c.routing}`,
    );
  }

  if (!apply) {
    console.log(
      `\nDry-run complete. Re-run with --apply to update ${candidates.length} account(s).`,
    );
    return;
  }

  let updated = 0;
  for (const c of candidates) {
    await prisma.employeeBankAccount.update({
      where: { id: c.id },
      data: { routingNumber: c.routing },
    });
    updated += 1;
  }

  console.log(`\nUpdated ${updated} employee bank account routing number(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
