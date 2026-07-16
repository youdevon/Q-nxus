import { prisma } from "@/lib/prisma";
import { toMonthlyPeriodAmount } from "@/src/modules/payroll/lib/payslip-preview";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import type {
  PayrollSalariesData,
  PayrollSalariesFilters,
  PayrollSalaryRow,
} from "@/src/modules/payroll/lib/payroll-salaries-types";

export type { PayrollSalariesData, PayrollSalariesFilters, PayrollSalaryRow };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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
      department: {
        select: {
          name: true,
        },
      },
      payrollProfile: {
        select: {
          payFrequency: true,
          paymentMethod: true,
          nisNumber: true,
          birNumber: true,
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
          jobTitle: true,
          baseSalary: true,
          currency: true,
          allowances: {
            select: {
              amount: true,
              frequency: true,
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
    let jobTitle: string | null = null;

    if (contract) {
      baseSalary = Number(contract.baseSalary.toString());
      currency = contract.currency;
      jobTitle = contract.jobTitle;
      let allowances = 0;
      for (const allowance of contract.allowances) {
        allowances += toMonthlyPeriodAmount(
          Number(allowance.amount.toString()),
          allowance.frequency,
        );
      }
      monthlyAllowances = roundMoney(allowances);
      grossPay = roundMoney(baseSalary + allowances);
      monthlyTaxableEarnings = roundMoney(baseSalary);
    }

    const readiness = evaluatePayrollReadiness({
      hasCurrentContract: contract != null,
      baseSalary,
      nisNumber: profile?.nisNumber ?? null,
      birNumber: profile?.birNumber ?? null,
      paymentMethod: profile?.paymentMethod ?? "BANK_TRANSFER",
      bankAccounts:
        profile?.bankAccounts.map((account) => ({
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          amount:
            account.amount != null ? Number(account.amount.toString()) : null,
          isPrimary: account.isPrimary,
        })) ?? [],
    });

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: `${employee.firstName} ${employee.lastName}`,
      departmentName: employee.department?.name ?? null,
      jobTitle,
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
