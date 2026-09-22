import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";

import {
  applyRecurringItemsForPeriod,
  computeBalanceAfterPost,
  type RecurringItemInput,
} from "@/src/modules/payroll/lib/recurring-payroll-items";

type DecimalLike = { toString(): string };

function toNumber(value: DecimalLike | number | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  return Number(value.toString());
}

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Load employee recurring assignments for payslip assembly / post decrement.
 */
export async function loadEmployeeRecurringItems(
  client: DbClient,
  employeeId: string,
): Promise<RecurringItemInput[]> {
  const rows = await client.employeePayrollRecurringItem.findMany({
    where: { employeeId },
    select: {
      id: true,
      amount: true,
      remainingBalance: true,
      startDate: true,
      endDate: true,
      isActive: true,
      definition: {
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          category: true,
          isTaxable: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount.toString()),
    remainingBalance: toNumber(row.remainingBalance),
    startDate: row.startDate,
    endDate: row.endDate,
    isActive: row.isActive,
    definition: {
      id: row.definition.id,
      code: row.definition.code,
      name: row.definition.name,
      kind: row.definition.kind,
      category: row.definition.category,
      isTaxable: row.definition.isTaxable,
      isActive: row.definition.isActive,
    },
  }));
}

/**
 * Decrement remainingBalance for balance-tracked recurring items that applied
 * to included employees in a REGULAR posted pay run. Deactivates when balance
 * hits zero. Correction / off-cycle posts skip this to avoid double-decrement.
 */
export async function decrementRecurringBalancesForPayRun(
  transaction: Prisma.TransactionClient,
  input: {
    employeeIds: string[];
    periodStart: Date;
    periodEnd: Date;
  },
): Promise<{ updatedCount: number }> {
  if (input.employeeIds.length === 0) {
    return { updatedCount: 0 };
  }

  let updatedCount = 0;

  for (const employeeId of input.employeeIds) {
    const items = await loadEmployeeRecurringItems(transaction, employeeId);
    const applied = applyRecurringItemsForPeriod(
      items,
      input.periodStart,
      input.periodEnd,
    );

    for (const line of applied) {
      const source = items.find((item) => item.id === line.recurringItemId);
      if (!source || source.remainingBalance == null) {
        continue;
      }

      const next = computeBalanceAfterPost(
        source.remainingBalance,
        line.amount,
      );
      if (!next) {
        continue;
      }

      await transaction.employeePayrollRecurringItem.update({
        where: { id: line.recurringItemId },
        data: {
          remainingBalance: new PrismaNamespace.Decimal(next.remainingBalance),
          isActive: next.isActive,
        },
      });
      updatedCount += 1;
    }
  }

  return { updatedCount };
}
