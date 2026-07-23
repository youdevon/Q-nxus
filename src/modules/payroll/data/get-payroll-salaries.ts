import { prisma } from "@/lib/prisma";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/public";
import { resolveBankAccountsForReadiness } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import { toMonthlyPeriodAmount } from "@/src/modules/payroll/lib/payslip-preview";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import { addCents, fromCents, toCents } from "@/src/modules/payroll/lib/money";
import type {
  PayrollSalariesData,
  PayrollSalariesFilters,
  PayrollSalaryRow,
} from "@/src/modules/payroll/lib/payroll-salaries-types";

export type { PayrollSalariesData, PayrollSalariesFilters, PayrollSalaryRow };


/**
 * Roster of active employees with current-contract salary info.
 * Master salary view only — not posted payroll history.
 */
export async function getPayrollSalaries(
  filters: PayrollSalariesFilters = {},
): Promise<PayrollSalariesData> {
  const query = filters.query?.trim();

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      employmentStatus: {
        in: ["ACTIVE", "ON_LEAVE"],
      },
      ...(query
        ? {
            OR: [
              {
                employeeNumber: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                firstName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                preferredName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      nisNumber: true,
      birNumber: true,
      department: {
        select: {
          name: true,
        },
      },
      position: {
        select: {
          title: true,
        },
      },
      assignments: {
        where: {
          isCurrent: true,
        },
        take: 1,
        select: {
          position: {
            select: {
              title: true,
            },
          },
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
          jobTitle: true,
          baseSalary: true,
          currency: true,
          allowances: {
            select: {
              amount: true,
              frequency: true,
              isTaxable: true,
            },
          },
        },
      },
    },
  });

  const rows: PayrollSalaryRow[] = employees.map((employee) => {
    const contract = employee.contracts[0] ?? null;
    const profile = employee.payrollProfile;

    let baseSalary: number | null = null;
    let monthlyAllowances: number | null = null;
    let grossPay: number | null = null;
    let monthlyTaxableEarnings: number | null = null;
    let currency: string | null = null;
    let positionTitle: string | null = null;

    if (contract) {
      baseSalary = Number(contract.baseSalary.toString());
      currency = contract.currency;
      positionTitle = resolveEmployeePositionTitle({
        assignmentPositionTitle: employee.assignments[0]?.position?.title,
        positionTitle: employee.position?.title,
        contractJobTitle: contract.jobTitle,
      });
      let allowancesCents = 0;
      let taxableAllowancesCents = 0;
      for (const allowance of contract.allowances) {
        const monthly = toMonthlyPeriodAmount(
          Number(allowance.amount.toString()),
          allowance.frequency,
        );
        const monthlyCents = toCents(monthly);
        allowancesCents = addCents(allowancesCents, monthlyCents);
        if (allowance.isTaxable) {
          taxableAllowancesCents = addCents(taxableAllowancesCents, monthlyCents);
        }
      }
      const baseSalaryCents = toCents(baseSalary);
      monthlyAllowances = fromCents(allowancesCents);
      grossPay = fromCents(addCents(baseSalaryCents, allowancesCents));
      monthlyTaxableEarnings = fromCents(
        addCents(baseSalaryCents, taxableAllowancesCents),
      );
    }

    const bankAccounts = resolveBankAccountsForReadiness({
      employeeAccounts: employee.bankAccounts.map((account) => ({
        id: account.id,
        bankName: account.bankName,
        branchName: account.branchName,
        accountNumber: account.accountNumber,
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
      baseSalary,
      nisNumber: employee.nisNumber?.trim() || null,
      birNumber: employee.birNumber?.trim() || null,
      paymentMethod: profile?.paymentMethod ?? "BANK_TRANSFER",
      bankAccounts,
      exemptFromNis: profile?.exemptFromNis ?? false,
      exemptFromPaye: profile?.exemptFromPaye ?? false,
    });

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: `${employee.firstName} ${employee.lastName}`,
      departmentName: employee.department?.name ?? null,
      positionTitle,
      payFrequency: profile?.payFrequency ?? null,
      currency,
      baseSalary,
      monthlyAllowances,
      grossPay,
      monthlyTaxableEarnings,
      hasCurrentContract: contract != null,
      isReady: profile != null && readiness.isReady,
    };
  });

  return {
    rows,
    totalCount: rows.length,
  };
}
