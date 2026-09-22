import { prisma } from "@/lib/prisma";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";
import type {
  RecurringComponentCategory,
  RecurringComponentKind,
} from "@/src/modules/payroll/lib/recurring-payroll-items";

export type PayrollComponentDefinitionRecord = {
  id: string;
  code: string;
  name: string;
  kind: RecurringComponentKind;
  category: RecurringComponentCategory;
  isTaxable: boolean;
  taxTreatment: "TAXABLE_EMPLOYMENT" | "NON_TAXABLE" | "NIS_ONLY" | "PAYE_EXEMPT";
  isActive: boolean;
  defaultAmount: string | null;
  assignmentCount: number;
  updatedAt: string;
};

export type EmployeeRecurringItemRecord = {
  id: string;
  definitionId: string;
  definitionCode: string;
  definitionName: string;
  kind: RecurringComponentKind;
  category: RecurringComponentCategory;
  isTaxable: boolean;
  amount: string;
  remainingBalance: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
};

export async function getPayrollComponentDefinitions(
  actorUserId?: string | null,
): Promise<PayrollComponentDefinitionRecord[]> {
  const organization = await resolvePayrollOrganization({ actorUserId });

  const rows = await prisma.payrollComponentDefinition.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      category: true,
      isTaxable: true,
      taxTreatment: true,
      isActive: true,
      defaultAmount: true,
      updatedAt: true,
      _count: { select: { assignments: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    category: row.category,
    isTaxable: row.isTaxable,
    taxTreatment: row.taxTreatment as PayrollComponentDefinitionRecord["taxTreatment"],
    isActive: row.isActive,
    defaultAmount:
      row.defaultAmount != null ? row.defaultAmount.toString() : null,
    assignmentCount: row._count.assignments,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getActivePayrollComponentDefinitions(
  organizationId: string,
): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    kind: RecurringComponentKind;
    category: RecurringComponentCategory;
    isTaxable: boolean;
    defaultAmount: string | null;
  }>
> {
  const rows = await prisma.payrollComponentDefinition.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      category: true,
      isTaxable: true,
      defaultAmount: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    category: row.category,
    isTaxable: row.isTaxable,
    defaultAmount:
      row.defaultAmount != null ? row.defaultAmount.toString() : null,
  }));
}

export async function getEmployeeRecurringItems(
  employeeId: string,
): Promise<EmployeeRecurringItemRecord[]> {
  const rows = await prisma.employeePayrollRecurringItem.findMany({
    where: { employeeId },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    select: {
      id: true,
      definitionId: true,
      amount: true,
      remainingBalance: true,
      startDate: true,
      endDate: true,
      isActive: true,
      notes: true,
      definition: {
        select: {
          code: true,
          name: true,
          kind: true,
          category: true,
          isTaxable: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    definitionId: row.definitionId,
    definitionCode: row.definition.code,
    definitionName: row.definition.name,
    kind: row.definition.kind,
    category: row.definition.category,
    isTaxable: row.definition.isTaxable,
    amount: row.amount.toString(),
    remainingBalance:
      row.remainingBalance != null ? row.remainingBalance.toString() : null,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate != null ? row.endDate.toISOString().slice(0, 10) : null,
    isActive: row.isActive,
    notes: row.notes,
  }));
}
