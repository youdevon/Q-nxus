import { prisma } from "@/lib/prisma";
import {
  resolveEmployeePositionTitle,
  resolveStatutoryNumber,
} from "@/src/modules/hr/public";
import { getCurrentHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { getSelectableFinancialInstitutionOptions } from "@/src/modules/payroll/data/get-financial-institutions";
import { getCurrentNisClasses } from "@/src/modules/payroll/data/get-nis-classes";
import { getCurrentPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import { toPayrollBankAccountRecords } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
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
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import { roundToCents } from "@/src/modules/payroll/lib/money";
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
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
      dateOfBirth: true,
      nisNumber: true,
      birNumber: true,
      bankAccounts: {
        where: { isActive: true, archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
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
          exemptFromNis: true,
          exemptFromHealthSurcharge: true,
          exemptFromPaye: true,
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
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
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
              id: true,
              amount: true,
              frequency: true,
              isTaxable: true,
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
  const positionTitle = resolveEmployeePositionTitle({
    assignmentPositionTitle: employee.assignments[0]?.position?.title,
    positionTitle: employee.position?.title,
    contractJobTitle: contract?.jobTitle,
  });
  const effectiveNis = resolveStatutoryNumber(
    employee.nisNumber,
    profile?.nisNumber,
  );
  const effectiveBir = resolveStatutoryNumber(
    employee.birNumber,
    profile?.birNumber,
  );
  const employeeBanks = employee.bankAccounts;
  let bankAccounts: PayrollBankAccountRecord[];

  if (employeeBanks.length > 0) {
    const records = toPayrollBankAccountRecords({
      accounts: employeeBanks.map((account) => ({
        id: account.id,
        bankName: account.bankName,
        branchName: account.branchName,
        accountNumber:
          decryptAccountNumber(account.accountNumber) ?? account.accountNumber,
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
    });
    const allocByAccountId = new Map(
      employee.payrollAllocations
        .filter((row) => row.isActive)
        .map((row) => [row.employeeBankAccountId, row]),
    );
    bankAccounts = records.map((account) => {
      const alloc = allocByAccountId.get(account.id);
      return {
        ...account,
        percentage:
          alloc?.allocationType === "PERCENTAGE" && alloc.percentage != null
            ? alloc.percentage.toString()
            : null,
      };
    });
  } else {
    bankAccounts =
      profile?.bankAccounts.map((account) => ({
        id: account.id,
        bankName: account.bankName,
        branchName: account.branchName,
        accountNumber:
          decryptAccountNumber(account.accountNumber) ?? account.accountNumber,
        accountName: account.accountName,
        amount: account.amount?.toString() ?? null,
        percentage: null,
        isPrimary: account.isPrimary,
        sortOrder: account.sortOrder,
      })) ?? [];
  }

  const [
    financialInstitutions,
    bankingEnabled,
    splitDepositEnabled,
    multipleAccountsEnabled,
    percentageAllocationEnabled,
    postNetSplitEnabled,
  ] = await Promise.all([
    getSelectableFinancialInstitutionOptions(),
    isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED),
    isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.SPLIT_DEPOSIT_ENABLED),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.MULTIPLE_EMPLOYEE_BANK_ACCOUNTS_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PERCENTAGE_ALLOCATION_ENABLED,
    ),
    isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.POST_NET_SPLIT_ENABLED),
  ]);

  const payElements: PayrollPayElement[] = [];
  let monthlyTaxableEarnings = 0;

  if (contract) {
    const baseSalary = Number(contract.baseSalary.toString());
    monthlyTaxableEarnings += baseSalary;

    payElements.push({
      label: `Base salary — ${positionTitle ?? contract.jobTitle}`,
      amount: contract.baseSalary.toString(),
      currency: contract.currency,
      frequency: "Monthly",
      source: "CONTRACT_SALARY",
      isTaxable: true,
      contractAllowanceId: null,
    });

    for (const allowance of contract.allowances) {
      const amount = Number(allowance.amount.toString());
      if (allowance.isTaxable) {
        monthlyTaxableEarnings += amount;
      }

      payElements.push({
        label: allowance.category.name,
        amount: allowance.amount.toString(),
        currency: contract.currency,
        frequency: allowanceFrequencyLabel(allowance.frequency),
        source: "CONTRACT_ALLOWANCE",
        isTaxable: allowance.isTaxable,
        contractAllowanceId: allowance.id,
      });
    }
  }

  monthlyTaxableEarnings = roundToCents(monthlyTaxableEarnings);

  const readiness = evaluatePayrollReadiness({
    hasCurrentContract: contract != null,
    baseSalary: contract ? Number(contract.baseSalary.toString()) : null,
    nisNumber: effectiveNis,
    birNumber: effectiveBir,
    paymentMethod: profile?.paymentMethod ?? "BANK_TRANSFER",
    bankAccounts: bankAccounts.map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      amount: account.amount != null ? Number(account.amount) : null,
      isPrimary: account.isPrimary,
    })),
    exemptFromNis: profile?.exemptFromNis ?? false,
    exemptFromPaye: profile?.exemptFromPaye ?? false,
  });

  let statutoryPreview: StatutoryPreview | null = null;

  if (contract && monthlyTaxableEarnings > 0) {
    const [nisClasses, payeConfig, healthConfig] = await Promise.all([
      getCurrentNisClasses(),
      getCurrentPayeTaxConfig(),
      getCurrentHealthSurchargeConfig(),
    ]);

    const exemptFromNis = profile?.exemptFromNis ?? false;
    const exemptFromPaye = profile?.exemptFromPaye ?? false;
    const exemptFromHealthSurcharge =
      profile?.exemptFromHealthSurcharge ?? false;

    const nis =
      !exemptFromNis && nisClasses.length > 0
        ? computeNisContribution({
            monthlySalary: monthlyTaxableEarnings,
            classes: toNisClassInputs(nisClasses),
          })
        : null;

    const paye =
      !exemptFromPaye && payeConfig != null
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
            exemptFromHealthSurcharge,
          })
        : null;

    statutoryPreview = {
      monthlyTaxableEarnings,
      nis,
      paye,
      health,
      notes: [
        "Taxable contract allowances (isTaxable) are included in NIS/PAYE/Health taxable pay; non-taxable allowances remain in gross only.",
        "Overtime, bonuses, and commissions are deferred from this preview.",
        ...(exemptFromNis
          ? ["NIS exempt (employee opt-out) — no contribution estimated."]
          : []),
        ...(exemptFromPaye
          ? ["PAYE exempt (employee opt-out) — no income tax estimated."]
          : []),
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
      nisNumber: employee.nisNumber,
      birNumber: employee.birNumber,
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
          exemptFromNis: profile.exemptFromNis,
          exemptFromHealthSurcharge: profile.exemptFromHealthSurcharge,
          exemptFromPaye: profile.exemptFromPaye,
          isPayrollReady: profile.isPayrollReady,
          updatedAt: profile.updatedAt.toISOString(),
        }
      : null,
    statutoryNumbers: {
      nisNumber: effectiveNis,
      birNumber: effectiveBir,
      fromEmployee: Boolean(
        employee.nisNumber?.trim() || employee.birNumber?.trim(),
      ),
    },
    bankAccounts,
    financialInstitutions,
    bankingFlags: {
      bankingEnabled,
      splitDepositEnabled,
      multipleAccountsEnabled,
      percentageAllocationEnabled,
      postNetSplitEnabled,
    },
    currentContract: contract
      ? {
          id: contract.id,
          positionTitle: positionTitle ?? contract.jobTitle,
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
