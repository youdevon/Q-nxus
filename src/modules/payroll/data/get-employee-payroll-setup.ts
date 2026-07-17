import { prisma } from "@/lib/prisma";
import { getCurrentHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { getCurrentNisClasses } from "@/src/modules/payroll/data/get-nis-classes";
import { getCurrentPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import {
  computeHealthSurcharge,
  toHealthConfigInput,
} from "@/src/modules/payroll/lib/health-surcharge";
import {
  computeNisContribution,
  toNisClassInputs,
} from "@/src/modules/payroll/lib/nis-contribution";
import {
  computePayeContribution,
  toPayeConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import type {
  EmployeePayrollSetup,
  PayrollBankAccountRecord,
  PayrollPayElement,
  StatutoryPreview,
} from "@/src/modules/payroll/lib/payroll-setup-types";

export type {
  EmployeePayrollSetup,
  PayrollBankAccountRecord,
  PayrollPayElement,
  StatutoryPreview,
};

function allowanceFrequencyLabel(frequency: string): string {
  return frequency
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export async function getEmployeePayrollSetup(
  employeeId: string,
): Promise<EmployeePayrollSetup | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
      dateOfBirth: true,
      payrollProfile: {
        select: {
          id: true,
          payFrequency: true,
          paymentMethod: true,
          nisNumber: true,
          birNumber: true,
          notes: true,
          td1OtherApprovedAnnual: true,
          pensionOnlyIncome: true,
          isPayrollReady: true,
          updatedAt: true,
          bankAccounts: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              bankName: true,
              branchName: true,
              accountNumber: true,
              accountName: true,
              amount: true,
              isPrimary: true,
              sortOrder: true,
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
          id: true,
          jobTitle: true,
          baseSalary: true,
          currency: true,
          startDate: true,
          endDate: true,
          terminationDate: true,
          allowances: {
            select: {
              amount: true,
              frequency: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  const contract = employee.contracts[0] ?? null;
  const profile = employee.payrollProfile;
  const bankAccounts: PayrollBankAccountRecord[] =
    profile?.bankAccounts.map((account) => ({
      id: account.id,
      bankName: account.bankName,
      branchName: account.branchName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      amount: account.amount?.toString() ?? null,
      isPrimary: account.isPrimary,
      sortOrder: account.sortOrder,
    })) ?? [];

  const payElements: PayrollPayElement[] = [];
  let monthlyTaxableEarnings = 0;

  if (contract) {
    const baseSalary = Number(contract.baseSalary.toString());
    monthlyTaxableEarnings += baseSalary;

    payElements.push({
      label: `Base salary — ${contract.jobTitle}`,
      amount: contract.baseSalary.toString(),
      currency: contract.currency,
      frequency: "Monthly",
      source: "CONTRACT_SALARY",
      isTaxable: true,
    });

    for (const allowance of contract.allowances) {
      payElements.push({
        label: allowance.category.name,
        amount: allowance.amount.toString(),
        currency: contract.currency,
        frequency: allowanceFrequencyLabel(allowance.frequency),
        source: "CONTRACT_ALLOWANCE",
        isTaxable: false,
      });
    }
  }

  monthlyTaxableEarnings = Math.round(monthlyTaxableEarnings * 100) / 100;

  const readiness = evaluatePayrollReadiness({
    hasCurrentContract: contract != null,
    baseSalary: contract ? Number(contract.baseSalary.toString()) : null,
    nisNumber: profile?.nisNumber ?? null,
    birNumber: profile?.birNumber ?? null,
    paymentMethod: profile?.paymentMethod ?? "BANK_TRANSFER",
    bankAccounts: bankAccounts.map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      amount: account.amount != null ? Number(account.amount) : null,
      isPrimary: account.isPrimary,
    })),
  });

  let statutoryPreview: StatutoryPreview | null = null;

  if (contract && monthlyTaxableEarnings > 0) {
    const [nisClasses, payeConfig, healthConfig] = await Promise.all([
      getCurrentNisClasses(),
      getCurrentPayeTaxConfig(),
      getCurrentHealthSurchargeConfig(),
    ]);

    const nis =
      nisClasses.length > 0
        ? computeNisContribution({
            monthlySalary: monthlyTaxableEarnings,
            classes: toNisClassInputs(nisClasses),
          })
        : null;

    const paye =
      payeConfig != null
        ? computePayeContribution({
            monthlyTaxableEarnings,
            config: toPayeConfigInput(payeConfig),
            employeeNisWeekly: nis?.employeeWeekly ?? 0,
            otherApprovedDeductionsAnnual:
              profile?.td1OtherApprovedAnnual != null
                ? Number(profile.td1OtherApprovedAnnual.toString())
                : 0,
          })
        : null;

    const health =
      healthConfig != null
        ? computeHealthSurcharge({
            config: toHealthConfigInput(healthConfig),
            monthlyEarnings: monthlyTaxableEarnings,
            dateOfBirth: employee.dateOfBirth,
            pensionOnlyIncome: profile?.pensionOnlyIncome ?? false,
          })
        : null;

    statutoryPreview = {
      monthlyTaxableEarnings,
      nis,
      paye,
      health,
      notes: [
        "Phase 1 taxable pay uses current contract base salary only; allowances remain visible in gross pay but are excluded from statutory deductions.",
        "Overtime, bonuses, and commissions are deferred from this preview.",
      ],
    };
  }

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: `${employee.firstName} ${employee.lastName}`,
      employmentStatus: employee.employmentStatus,
      dateOfBirth: employee.dateOfBirth
        ? employee.dateOfBirth.toISOString().slice(0, 10)
        : null,
    },
    profile: profile
      ? {
          id: profile.id,
          payFrequency: profile.payFrequency,
          paymentMethod: profile.paymentMethod,
          nisNumber: profile.nisNumber,
          birNumber: profile.birNumber,
          notes: profile.notes,
          td1OtherApprovedAnnual:
            profile.td1OtherApprovedAnnual?.toString() ?? null,
          pensionOnlyIncome: profile.pensionOnlyIncome,
          isPayrollReady: profile.isPayrollReady,
          updatedAt: profile.updatedAt.toISOString(),
        }
      : null,
    bankAccounts,
    currentContract: contract
      ? {
          id: contract.id,
          jobTitle: contract.jobTitle,
          baseSalary: contract.baseSalary.toString(),
          currency: contract.currency,
          startDate: contract.startDate.toISOString().slice(0, 10),
          endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
          terminationDate:
            contract.terminationDate?.toISOString().slice(0, 10) ?? null,
        }
      : null,
    payElements,
    readiness,
    statutoryPreview,
  };
}
