import { prisma } from "@/lib/prisma";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import type {
  PayrollReadinessData,
  PayrollReadinessRow,
} from "@/src/modules/payroll/lib/payroll-readiness-types";

export type { PayrollReadinessData, PayrollReadinessRow };

export async function getPayrollReadiness(): Promise<PayrollReadinessData> {
  const employees = await prisma.employee.findMany({
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
          baseSalary: true,
        },
      },
    },
  });

  const rows: PayrollReadinessRow[] = employees.map((employee) => {
    const contract = employee.contracts[0] ?? null;
    const profile = employee.payrollProfile;

    const readiness = evaluatePayrollReadiness({
      hasCurrentContract: contract != null,
      baseSalary: contract ? Number(contract.baseSalary.toString()) : null,
      nisNumber: profile?.nisNumber ?? null,
      birNumber: profile?.birNumber ?? null,
      paymentMethod: profile?.paymentMethod ?? "BANK_TRANSFER",
      bankAccounts:
        profile?.bankAccounts.map((account) => ({
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          amount: account.amount != null ? Number(account.amount.toString()) : null,
          isPrimary: account.isPrimary,
        })) ?? [],
    });

    const blockingIssues = profile
      ? readiness.blockingIssues
      : ["Payroll profile not set up.", ...readiness.blockingIssues];

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: `${employee.firstName} ${employee.lastName}`,
      departmentName: employee.department?.name ?? null,
      payFrequency: profile?.payFrequency ?? null,
      paymentMethod: profile?.paymentMethod ?? null,
      hasProfile: profile != null,
      isReady: profile != null && readiness.isReady,
      blockingIssues,
    };
  });

  return {
    rows,
    readyCount: rows.filter((row) => row.isReady).length,
    notReadyCount: rows.filter((row) => !row.isReady).length,
  };
}
