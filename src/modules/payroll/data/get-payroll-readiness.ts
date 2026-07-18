import { prisma } from "@/lib/prisma";
import {
  getOrgEmployeeFileCompleteness,
  resolveStatutoryNumber,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/public";
import { resolveBankAccountsForReadiness } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import type {
  PayrollReadinessData,
  PayrollReadinessRow,
} from "@/src/modules/payroll/lib/payroll-readiness-types";

export type { PayrollReadinessData, PayrollReadinessRow };

export async function getPayrollReadiness(): Promise<PayrollReadinessData> {
  const [employees, fileCompleteness] = await Promise.all([
    prisma.employee.findMany({
      where: {
        isArchived: false,
        employmentStatus: {
          in: ["ACTIVE", "ON_LEAVE"],
        },
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
            accountNumber: true,
            accountNumberLastFour: true,
            accountHolderName: true,
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
            nisNumber: true,
            birNumber: true,
            exemptFromNis: true,
            exemptFromPaye: true,
            bankAccounts: {
              select: {
                bankName: true,
                accountNumber: true,
                amount: true,
                isPrimary: true,
              },
            },
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
    getOrgEmployeeFileCompleteness({ mode: "summary" }),
  ]);

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
        accountNumber: account.accountNumber,
        accountNumberLastFour: account.accountNumberLastFour,
        accountHolderName: account.accountHolderName,
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
      legacyAccounts:
        profile?.bankAccounts.map((account) => ({
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          amount:
            account.amount != null ? Number(account.amount.toString()) : null,
          isPrimary: account.isPrimary,
        })) ?? [],
    });

    const readiness = evaluatePayrollReadiness({
      hasCurrentContract: contract != null,
      baseSalary: contract ? Number(contract.baseSalary.toString()) : null,
      nisNumber: resolveStatutoryNumber(employee.nisNumber, profile?.nisNumber),
      birNumber: resolveStatutoryNumber(employee.birNumber, profile?.birNumber),
      paymentMethod: profile?.paymentMethod ?? "BANK_TRANSFER",
      bankAccounts,
      exemptFromNis: profile?.exemptFromNis ?? false,
      exemptFromPaye: profile?.exemptFromPaye ?? false,
    });

    const blockingIssues = profile
      ? readiness.blockingIssues
      : ["Payroll profile not set up.", ...readiness.blockingIssues];

    const softWarnings: string[] = [];
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
  };
}
