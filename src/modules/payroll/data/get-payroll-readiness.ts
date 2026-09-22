import { prisma } from "@/lib/prisma";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";
import {
  getOrgEmployeeFileCompleteness,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/public";
import { resolveBankAccountsForReadiness } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import { PAY_RUN_PAYEE_GROUP_OPTIONS } from "@/src/modules/payroll/lib/pay-run-payee-group";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import type {
  PayrollReadinessData,
  PayrollReadinessRow,
} from "@/src/modules/payroll/lib/payroll-readiness-types";

export type { PayrollReadinessData, PayrollReadinessRow };

const EMPTY_READINESS: PayrollReadinessData = {
  rows: [],
  readyCount: 0,
  notReadyCount: 0,
  groupCounts: [],
};

export async function getPayrollReadiness(options?: {
  /** Soft file-completeness warnings. Default true for directory; skip for batch/calc. */
  includeFileCompleteness?: boolean;
  /** When set, only evaluate these employees (pay-run soft warnings). */
  employeeIds?: string[];
  /** Limit to one or more workforce categories (pay-run payee groups). */
  workforceCategories?: string[];
}): Promise<PayrollReadinessData> {
  const includeFileCompleteness = options?.includeFileCompleteness !== false;
  const organizationId = await getSessionOrganizationId();

  if (!organizationId) {
    return EMPTY_READINESS;
  }

  if (options?.employeeIds && options.employeeIds.length === 0) {
    return EMPTY_READINESS;
  }

  if (
    options?.workforceCategories &&
    options.workforceCategories.length === 0
  ) {
    return EMPTY_READINESS;
  }

  const activePayeeWhere = {
    organizationId,
    isArchived: false,
    employmentStatus: {
      in: ["ACTIVE", "ON_LEAVE"] as const,
    },
  };

  const [employees, categoryGroups] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...activePayeeWhere,
        ...(options?.employeeIds ? { id: { in: options.employeeIds } } : {}),
        ...(options?.workforceCategories
          ? {
              workforceCategory: {
                in: options.workforceCategories as Array<
                  "EMPLOYEE" | "BOARD" | "AGENT" | "CONTRACTOR"
                >,
              },
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        workforceCategory: true,
        nisNumber: true,
        birNumber: true,
        departmentId: true,
        department: {
          select: {
            name: true,
          },
        },
        bankAccounts: {
          where: { isActive: true, archivedAt: null },
          orderBy: [{ sortOrder: "asc" }],
          select: {
            id: true,
            bankName: true,
            branchName: true,
            // Presence check only — avoid loading encrypted full numbers.
            accountNumberLastFour: true,
            accountHolderName: true,
            accountType: true,
            isPrimary: true,
            sortOrder: true,
            financialInstitutionId: true,
          },
        },
        payrollAllocations: {
          where: { isActive: true },
          orderBy: [{ priority: "asc" }],
          select: {
            employeeBankAccountId: true,
            allocationType: true,
            fixedAmount: true,
            percentage: true,
            receivesRemainder: true,
            isActive: true,
            priority: true,
          },
        },
        payrollProfile: {
          select: {
            payFrequency: true,
            paymentMethod: true,
            exemptFromNis: true,
            exemptFromPaye: true,
          },
        },
        contracts: {
          where: {
            isCurrent: true,
            status: "ACTIVE",
          },
          take: 1,
          select: {
            baseSalary: true,
          },
        },
      },
    }),
    options?.employeeIds
      ? Promise.resolve(
          [] as Array<{
            workforceCategory:
              | "EMPLOYEE"
              | "BOARD"
              | "AGENT"
              | "CONTRACTOR";
            _count: { _all: number };
          }>,
        )
      : prisma.employee.groupBy({
          by: ["workforceCategory"],
          where: activePayeeWhere,
          _count: { _all: true },
        }),
  ]);

  const countByCategory = new Map(
    categoryGroups.map((row) => [row.workforceCategory, row._count._all]),
  );

  const groupCounts = PAY_RUN_PAYEE_GROUP_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    count: countByCategory.get(option.value) ?? 0,
  }));

  const fileCompleteness = includeFileCompleteness
    ? await getOrgEmployeeFileCompleteness({
        mode: "summary",
        employees: employees
          .filter((employee) => employee.workforceCategory === "EMPLOYEE")
          .map((employee) => ({
            id: employee.id,
            employeeNumber: employee.employeeNumber,
            firstName: employee.firstName,
            lastName: employee.lastName,
            departmentId: employee.departmentId,
            departmentName: employee.department?.name ?? null,
          })),
      })
    : [];

  const completenessByEmployee = new Map(
    fileCompleteness.map((row) => [row.employeeId, row.completeness]),
  );

  const rows: PayrollReadinessRow[] = employees.map((employee) => {
    const contract = employee.contracts[0] ?? null;
    const profile = employee.payrollProfile;

    const bankAccounts = resolveBankAccountsForReadiness({
      employeeAccounts: employee.bankAccounts.map((account) => ({
        id: account.id,
        bankName: account.bankName,
        branchName: account.branchName,
        accountNumber:
          account.accountNumberLastFour &&
          account.accountNumberLastFour.length > 0
            ? `****${account.accountNumberLastFour}`
            : "****",
        accountNumberLastFour: account.accountNumberLastFour,
        accountHolderName: account.accountHolderName,
        accountType: account.accountType,
        isPrimary: account.isPrimary,
        sortOrder: account.sortOrder,
        financialInstitutionId: account.financialInstitutionId,
      })),
      allocations: employee.payrollAllocations.map((row) => ({
        employeeBankAccountId: row.employeeBankAccountId,
        allocationType: row.allocationType,
        fixedAmount: row.fixedAmount?.toString() ?? null,
        percentage: row.percentage?.toString() ?? null,
        receivesRemainder: row.receivesRemainder,
        isActive: row.isActive,
        priority: row.priority,
      })),
    });

    const readiness = evaluatePayrollReadiness({
      hasCurrentContract: contract != null,
      baseSalary: contract ? Number(contract.baseSalary.toString()) : null,
      nisNumber: employee.nisNumber?.trim() || null,
      birNumber: employee.birNumber?.trim() || null,
      paymentMethod: profile?.paymentMethod ?? "BANK_TRANSFER",
      bankAccounts,
      exemptFromNis: profile?.exemptFromNis ?? false,
      exemptFromPaye: profile?.exemptFromPaye ?? false,
    });

    const blockingIssues = profile
      ? readiness.blockingIssues
      : ["Payroll profile not set up.", ...readiness.blockingIssues];

    const softWarnings: string[] = [...(readiness.softWarnings ?? [])];
    const file = completenessByEmployee.get(employee.id);
    if (file && !file.isComplete) {
      softWarnings.push(
        `Employee file incomplete (${file.completeCount} of ${file.totalCount}).`,
      );
    }

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: `${employee.firstName} ${employee.lastName}`,
      workforceCategory: employee.workforceCategory,
      workforceCategoryLabel: workforceCategoryBadgeLabel(
        employee.workforceCategory,
      ),
      departmentName: employee.department?.name ?? null,
      payFrequency: profile?.payFrequency ?? null,
      paymentMethod: profile?.paymentMethod ?? null,
      hasProfile: profile != null,
      isReady: profile != null && readiness.isReady,
      blockingIssues,
      softWarnings,
    };
  });

  return {
    rows,
    readyCount: rows.filter((row) => row.isReady).length,
    notReadyCount: rows.filter((row) => !row.isReady).length,
    groupCounts,
  };
}
