import { prisma } from "@/lib/prisma";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/public";
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
import { evaluatePayrollReadiness } from "@/src/modules/payroll/lib/payroll-readiness";
import { roundToCents } from "@/src/modules/payroll/lib/money";
import type {
  EmployeePayrollSetup,
  PayrollBankAccountHistoryRecord,
  PayrollBankAccountRecord,
  PayrollPayElement,
  StatutoryPreview,
} from "@/src/modules/payroll/lib/payroll-setup-types";
import {
  applyPersonalAllowanceOverride,
  resolveEmployeeTaxPayeInputs,
  type EmployeeTaxProfilePayeFields,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";
import { getEmployeePriorEmploymentYtds } from "@/src/modules/payroll/data/get-employee-prior-employment";
import { getSetupBankingFlags } from "@/src/modules/payroll/data/get-payroll-banking-features";

export type {
  EmployeePayrollSetup,
  PayrollBankAccountHistoryRecord,
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
  options?: {
    includeStatutoryPreview?: boolean;
    includeFinancialInstitutions?: boolean;
    includePriorDocuments?: boolean;
  },
): Promise<EmployeePayrollSetup | null> {
  const includeStatutoryPreview = options?.includeStatutoryPreview !== false;
  const includeFinancialInstitutions =
    options?.includeFinancialInstitutions !== false;
  const includePriorDocuments = options?.includePriorDocuments !== false;

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
          accountType: true,
          isPrimary: true,
          sortOrder: true,
          financialInstitutionId: true,
          verificationStatus: true,
          isVerified: true,
          verifiedAt: true,
          dataSource: true,
          routingNumber: true,
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
          notes: true,
          pensionOnlyIncome: true,
          exemptFromNis: true,
          exemptFromHealthSurcharge: true,
          exemptFromPaye: true,
          isPayrollReady: true,
          updatedAt: true,
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
  const effectiveNis = employee.nisNumber?.trim() || null;
  const effectiveBir = employee.birNumber?.trim() || null;
  const employeeBanks = employee.bankAccounts;
  let bankAccounts: PayrollBankAccountRecord[] = [];

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
    const allocByAccountId = new Map(
      employee.payrollAllocations
        .filter((row) => row.isActive)
        .map((row) => [row.employeeBankAccountId, row]),
    );
    bankAccounts = records.map((account) => {
      const alloc = allocByAccountId.get(account.id);
      const source = employeeBanks.find((row) => row.id === account.id);
      return {
        ...account,
        percentage:
          alloc?.allocationType === "PERCENTAGE" && alloc.percentage != null
            ? alloc.percentage.toString()
            : null,
        verificationStatus: source?.verificationStatus ?? null,
        isVerified: source?.isVerified ?? false,
        verifiedAt: source?.verifiedAt?.toISOString() ?? null,
        dataSource: source?.dataSource ?? null,
        routingNumber: source?.routingNumber ?? null,
      };
    });
  }

  const historyRows = await prisma.employeeBankAccount.findMany({
    where: {
      employeeId: employee.id,
      OR: [{ isActive: false }, { archivedAt: { not: null } }],
    },
    orderBy: [{ archivedAt: "desc" }, { updatedAt: "desc" }],
    take: 25,
    select: {
      id: true,
      bankName: true,
      accountNumberLastFour: true,
      accountType: true,
      verificationStatus: true,
      dataSource: true,
      isPrimary: true,
      effectiveFrom: true,
      effectiveTo: true,
      archivedAt: true,
      changeReason: true,
    },
  });
  const bankAccountHistory = historyRows.map((row) => ({
    id: row.id,
    bankName: row.bankName,
    accountNumberMasked: row.accountNumberLastFour
      ? `••••${row.accountNumberLastFour}`
      : "••••",
    accountType: row.accountType,
    verificationStatus: row.verificationStatus,
    dataSource: row.dataSource,
    isPrimary: row.isPrimary,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    changeReason: row.changeReason,
  }));

  const taxYear = taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));

  const [
    financialInstitutions,
    bankingFlags,
    taxProfileRow,
    priorEmploymentBundle,
  ] = await Promise.all([
    includeFinancialInstitutions
      ? getSelectableFinancialInstitutionOptions()
      : Promise.resolve([] as Awaited<
          ReturnType<typeof getSelectableFinancialInstitutionOptions>
        >),
    getSetupBankingFlags(),
    prisma.employeeTaxProfile.findUnique({
      where: {
        employeeId_taxYear: {
          employeeId: employee.id,
          taxYear,
        },
      },
    }),
    getEmployeePriorEmploymentYtds(employee.id, taxYear, {
      includeDocuments: includePriorDocuments,
    }),
  ]);

  const {
    bankingEnabled,
    splitDepositEnabled,
    multipleAccountsEnabled,
    percentageAllocationEnabled,
    postNetSplitEnabled,
  } = bankingFlags;

  const taxProfileFields: EmployeeTaxProfilePayeFields | null = taxProfileRow
    ? {
        taxCalculationMethod: taxProfileRow.taxCalculationMethod,
        taxProfileStatus: taxProfileRow.taxProfileStatus,
        personalAllowance:
          taxProfileRow.personalAllowance != null
            ? Number(taxProfileRow.personalAllowance.toString())
            : null,
        personalAllowanceSource: taxProfileRow.personalAllowanceSource,
        td1OtherApprovedAnnual:
          taxProfileRow.td1OtherApprovedAnnual != null
            ? Number(taxProfileRow.td1OtherApprovedAnnual.toString())
            : null,
        cumulativeCalculationEnabled:
          taxProfileRow.cumulativeCalculationEnabled,
        previousEmploymentDeclared: taxProfileRow.previousEmploymentDeclared,
        previousEmploymentVerified: taxProfileRow.previousEmploymentVerified,
      }
    : null;

  const resolvedTax = resolveEmployeeTaxPayeInputs({
    taxYear,
    taxProfile: taxProfileFields,
    priorEmployment: priorEmploymentBundle.totals,
  });

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
      accountHolderName: account.accountName,
      accountType: account.accountType ?? null,
      amount: account.amount != null ? Number(account.amount) : null,
      isPrimary: account.isPrimary,
    })),
    exemptFromNis: profile?.exemptFromNis ?? false,
    exemptFromPaye: profile?.exemptFromPaye ?? false,
  });

  let statutoryPreview: StatutoryPreview | null = null;

  if (includeStatutoryPreview && contract && monthlyTaxableEarnings > 0) {
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
            config: applyPersonalAllowanceOverride(
              toPayeConfigInput(payeConfig),
              resolvedTax.personalAllowanceOverride,
            ),
            employeeNisWeekly: nis?.employeeWeekly ?? 0,
            otherApprovedDeductionsAnnual: resolvedTax.td1OtherApprovedAnnual,
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
        ...resolvedTax.calcNotes,
        ...(exemptFromNis
          ? ["NIS exempt (employee opt-out) — no contribution estimated."]
          : []),
        ...(exemptFromPaye
          ? ["PAYE exempt (employee opt-out) — no income tax estimated."]
          : []),
      ],
    };
  }

  const displayTd1 =
    taxProfileRow != null || resolvedTax.td1OtherApprovedAnnual > 0
      ? resolvedTax.td1OtherApprovedAnnual.toFixed(2)
      : null;

  return {
    employee: {
      id: employee.id,
      organizationId: employee.organizationId,
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
          notes: profile.notes,
          td1OtherApprovedAnnual: displayTd1,
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
    bankAccountHistory,
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
    taxProfile: {
      id: taxProfileRow?.id ?? null,
      taxYear,
      taxCalculationMethod: resolvedTax.taxCalculationMethod,
      taxProfileStatus: resolvedTax.taxProfileStatus,
      personalAllowance:
        taxProfileRow?.personalAllowance?.toString() ??
        (resolvedTax.personalAllowanceOverride != null
          ? resolvedTax.personalAllowanceOverride.toFixed(2)
          : null),
      personalAllowanceSource: resolvedTax.personalAllowanceSource,
      td1Submitted: taxProfileRow?.td1Submitted ?? false,
      td1EffectiveDate: taxProfileRow?.td1EffectiveDate
        ? taxProfileRow.td1EffectiveDate.toISOString().slice(0, 10)
        : null,
      td1ApprovedByIrd: taxProfileRow?.td1ApprovedByIrd ?? false,
      td1ApprovalReference: taxProfileRow?.td1ApprovalReference ?? null,
      td1OtherApprovedAnnual: displayTd1,
      cumulativeCalculationEnabled: resolvedTax.cumulativeCalculationEnabled,
      previousEmploymentDeclared: resolvedTax.previousEmploymentDeclared,
      previousEmploymentVerified: resolvedTax.previousEmploymentVerified,
      previousEmploymentSource: taxProfileRow?.previousEmploymentSource ?? null,
      notes: taxProfileRow?.notes ?? null,
      source: resolvedTax.source,
    },
    priorEmployment: {
      taxYear: priorEmploymentBundle.taxYear,
      records: priorEmploymentBundle.records.map((row) => ({
        id: row.id,
        taxYear: row.taxYear,
        employerName: row.employerName,
        employerBirNumber: row.employerBirNumber,
        employmentStartDate: row.employmentStartDate,
        employmentEndDate: row.employmentEndDate,
        asOfDate: row.asOfDate,
        taxableIncomeYtd: row.taxableIncomeYtd,
        payeDeductedYtd: row.payeDeductedYtd,
        nisEmployeeYtd: row.nisEmployeeYtd,
        nisEmployerYtd: row.nisEmployerYtd,
        healthSurchargeYtd: row.healthSurchargeYtd,
        otherApprovedDeductionsYtd: row.otherApprovedDeductionsYtd,
        verified: row.verified,
        notes: row.notes,
        documents: row.documents,
      })),
      totals: {
        taxableIncomeYtd: priorEmploymentBundle.totals.taxableIncomeYtd,
        payeDeductedYtd: priorEmploymentBundle.totals.payeDeductedYtd,
        nisEmployeeYtd: priorEmploymentBundle.totals.nisEmployeeYtd,
        healthSurchargeYtd: priorEmploymentBundle.totals.healthSurchargeYtd,
        otherApprovedDeductionsYtd:
          priorEmploymentBundle.totals.otherApprovedDeductionsYtd,
        recordCount: priorEmploymentBundle.totals.recordCount,
        verifiedCount: priorEmploymentBundle.totals.verifiedCount,
        allVerified: priorEmploymentBundle.totals.allVerified,
      },
      verifiedTotals: {
        taxableIncomeYtd: priorEmploymentBundle.verifiedTotals.taxableIncomeYtd,
        payeDeductedYtd: priorEmploymentBundle.verifiedTotals.payeDeductedYtd,
        nisEmployeeYtd: priorEmploymentBundle.verifiedTotals.nisEmployeeYtd,
        healthSurchargeYtd:
          priorEmploymentBundle.verifiedTotals.healthSurchargeYtd,
        otherApprovedDeductionsYtd:
          priorEmploymentBundle.verifiedTotals.otherApprovedDeductionsYtd,
        recordCount: priorEmploymentBundle.verifiedTotals.recordCount,
        verifiedCount: priorEmploymentBundle.verifiedTotals.verifiedCount,
        allVerified: priorEmploymentBundle.verifiedTotals.allVerified,
      },
    },
  };
}
