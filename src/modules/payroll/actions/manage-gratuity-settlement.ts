"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  defaultTtGratuityPolicyInput,
  getGratuityPolicyAsOf,
  toGratuityPolicyInput,
} from "@/src/modules/payroll/data/get-gratuity-policy";
import {
  buildCorrectionDeltaEmployeeSnapshot,
  toPayslipCreateData,
} from "@/src/modules/payroll/lib/build-pay-run-snapshots";
import { toPayslipBankAccountInputs } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import {
  aggregateIncludedPayRunTotals,
  type PayRunMembershipStatus,
} from "@/src/modules/payroll/lib/pay-run-membership";
import { isPayRunMutable } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { applyFixedBankAllocations } from "@/src/modules/payroll/lib/payslip-preview";
import { toStatutoryAsOfKey } from "@/src/modules/payroll/lib/statutory-as-of";
import { rebuildDraftPayslipFromLineItems } from "@/src/modules/payroll/services/recalculate-draft-pay-run";
import { computeSettlementAmounts } from "@/src/modules/payroll/services/gratuity-settlement";
import { sumActualEligibleContractEarnings } from "@/src/modules/payroll/services/actual-gratuity-earnings";
import { loadPayrollOrganizationName } from "@/src/modules/payroll/services/sync-correction-delta-lines";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";
import { completeOffboardingTask } from "@/src/modules/hr/services/employee-lifecycle-cases";

export type GratuitySettlementFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function revalidateGratuitySettlementPaths(options?: {
  employeeId?: string;
  contractId?: string;
}) {
  revalidatePath("/payroll/gratuity");
  revalidatePath("/payroll/settings/gratuity");
  revalidatePath("/payroll/runs");
  if (options?.employeeId && options?.contractId) {
    revalidatePath(
      `/people/employees/${options.employeeId}/contracts/${options.contractId}`,
    );
  }
}

function moneyDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

async function loadContractForSettlement(contractId: string) {
  return prisma.employmentContract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      employeeId: true,
      startDate: true,
      endDate: true,
      baseSalary: true,
      currency: true,
      gratuityEligible: true,
      gratuityRate: true,
      jobTitle: true,
      employee: {
        select: {
          id: true,
          organizationId: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          nisNumber: true,
          birNumber: true,
          department: { select: { name: true } },
          position: { select: { title: true } },
        },
      },
      allowances: {
        select: {
          amount: true,
          frequency: true,
          includedInGratuity: true,
          category: { select: { name: true } },
        },
      },
      gratuitySettlement: {
        select: { id: true, status: true },
      },
    },
  });
}

export async function recalculateGratuitySettlement(
  _previousState: GratuitySettlementFormState,
  formData: FormData,
): Promise<GratuitySettlementFormState> {
  const actor = await requireActor("payroll.view", "payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const contractId = textValue(formData, "contractId");

  if (!contractId) {
    return { status: "error", message: "Contract is required." };
  }

  const contract = await loadContractForSettlement(contractId);

  if (!contract) {
    return { status: "error", message: "Contract not found." };
  }

  if (!contract.gratuityEligible) {
    return {
      status: "error",
      message: "This contract is not marked gratuity-eligible.",
    };
  }

  if (
    contract.gratuitySettlement &&
    (contract.gratuitySettlement.status === "PAID" ||
      contract.gratuitySettlement.status === "SCHEDULED" ||
      contract.gratuitySettlement.status === "APPROVED")
  ) {
    return {
      status: "error",
      message: `Cannot recalculate a settlement in ${contract.gratuitySettlement.status} status.`,
    };
  }

  const asOf = new Date();
  const policyAsOf = contract.endDate ?? asOf;
  const policy = await getGratuityPolicyAsOf(policyAsOf);
  const policyInput = policy
    ? toGratuityPolicyInput(policy)
    : defaultTtGratuityPolicyInput();

  const endForActual = contract.endDate ?? asOf;
  const useActualBasis =
    startOfUtcDay(endForActual).getTime() <= startOfUtcDay(asOf).getTime();

  let actual:
    | Awaited<ReturnType<typeof sumActualEligibleContractEarnings>>
    | null = null;

  if (useActualBasis) {
    actual = await sumActualEligibleContractEarnings({
      employeeId: contract.employeeId,
      contractStart: contract.startDate,
      contractEnd: endForActual,
      gratuityIncludedAllowanceNames: contract.allowances
        .filter((row) => row.includedInGratuity)
        .map((row) => row.category.name),
      totalAllowanceNames: contract.allowances.map((row) => row.category.name),
    });
  }

  let amounts;
  try {
    amounts = computeSettlementAmounts(
      {
        startDate: contract.startDate,
        endDate: contract.endDate,
        baseSalary: contract.baseSalary.toString(),
        allowances: contract.allowances.map((row) => ({
          amount: row.amount.toString(),
          frequency: row.frequency,
          includedInGratuity: row.includedInGratuity,
        })),
        gratuityEligible: contract.gratuityEligible,
        gratuityRate: contract.gratuityRate?.toString() ?? null,
      },
      policyInput,
      {
        asOf,
        requireEndDate: true,
        actualEligibleGrossEarnings:
          actual?.source === "ACTUAL_PAYROLL" ? actual.amount : null,
        actualPayslipCount: actual?.payslipCount ?? 0,
      },
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to calculate gratuity for this contract.",
    };
  }

  const endDate = amounts.endDateUsed;
  const today = startOfUtcDay(asOf);
  const endDay = startOfUtcDay(endDate);
  const isFuture = endDay > today;

  let status: "ESTIMATED" | "CALCULATED" | "INELIGIBLE" = isFuture
    ? "ESTIMATED"
    : "CALCULATED";

  if (amounts.ineligibleReason) {
    status = "INELIGIBLE";
  }

  const now = new Date();
  const snapshot = {
    policyId: policy?.id ?? null,
    policy: policyInput,
    contract: {
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      baseSalary: contract.baseSalary.toString(),
      gratuityRate: contract.gratuityRate?.toString() ?? null,
      allowances: contract.allowances.map((row) => ({
        amount: row.amount.toString(),
        frequency: row.frequency,
        includedInGratuity: row.includedInGratuity,
        categoryName: row.category.name,
      })),
    },
    result: amounts,
    earningsBasis: amounts.earningsBasis,
    variance: {
      contractEstimateGrossEarnings: amounts.contractEstimateGrossEarnings,
      contractEstimateGrossGratuity: amounts.contractEstimateGrossGratuity,
      varianceGrossEarnings: amounts.varianceGrossEarnings,
      varianceGrossGratuity: amounts.varianceGrossGratuity,
      actualPayslipCount: amounts.actualPayslipCount,
    },
    calculatedAt: now.toISOString(),
  };

  const organization = await resolvePayrollOrganization({
    actorUserId: actor.actor.userId,
  });
  const metadata = await getAuditRequestMetadata(formData);

  try {
    const settlement = await prisma.employeeGratuitySettlement.upsert({
      where: { contractId: contract.id },
      create: {
        organizationId: organization.id,
        employeeId: contract.employeeId,
        contractId: contract.id,
        policyId: policy?.id ?? null,
        status,
        currency: contract.currency,
        formulaKind: amounts.formulaKind,
        ratePercent: new Prisma.Decimal(amounts.ratePercent.toFixed(4)),
        contractMonths: amounts.contractMonths,
        serviceYears: new Prisma.Decimal(amounts.serviceYears.toFixed(4)),
        monthlyEligibleEarnings: moneyDecimal(amounts.monthlyEligibleEarnings),
        eligibleGrossEarnings: moneyDecimal(amounts.estimatedGrossEarnings),
        grossAmount: moneyDecimal(amounts.estimatedGrossGratuity),
        taxAmount: moneyDecimal(amounts.estimatedTax),
        netAmount: moneyDecimal(amounts.estimatedNetGratuity),
        accruedAmount: moneyDecimal(amounts.accruedAmount),
        accrualThroughDate: startOfUtcDay(asOf),
        estimatedAt: status === "ESTIMATED" ? now : null,
        calculatedAt: status === "CALCULATED" ? now : null,
        taxRemittanceStatus:
          amounts.estimatedTax > 0 ? "PENDING" : "NOT_APPLICABLE",
        calculationSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      update: {
        policyId: policy?.id ?? null,
        status,
        formulaKind: amounts.formulaKind,
        ratePercent: new Prisma.Decimal(amounts.ratePercent.toFixed(4)),
        contractMonths: amounts.contractMonths,
        serviceYears: new Prisma.Decimal(amounts.serviceYears.toFixed(4)),
        monthlyEligibleEarnings: moneyDecimal(amounts.monthlyEligibleEarnings),
        eligibleGrossEarnings: moneyDecimal(amounts.estimatedGrossEarnings),
        grossAmount: moneyDecimal(amounts.estimatedGrossGratuity),
        taxAmount: moneyDecimal(amounts.estimatedTax),
        netAmount: moneyDecimal(amounts.estimatedNetGratuity),
        accruedAmount: moneyDecimal(amounts.accruedAmount),
        accrualThroughDate: startOfUtcDay(asOf),
        estimatedAt: status === "ESTIMATED" ? now : undefined,
        calculatedAt: status === "CALCULATED" ? now : undefined,
        voidedAt: null,
        voidedByUserId: null,
        voidReason: null,
        taxRemittanceStatus:
          amounts.estimatedTax > 0 ? "PENDING" : "NOT_APPLICABLE",
        calculationSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeGratuitySettlement",
        entityId: settlement.id,
        description: `Recalculated gratuity settlement for contract ${contractId} (${status}).`,
        newValues: {
          status,
          grossAmount: amounts.estimatedGrossGratuity,
          taxAmount: amounts.estimatedTax,
          netAmount: amounts.estimatedNetGratuity,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("recalculateGratuitySettlement failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not recalculate the gratuity settlement.",
    };
  }

  revalidateGratuitySettlementPaths({
    employeeId: contract.employeeId,
    contractId,
  });
  return {
    status: "success",
    message: `Gratuity settlement ${status.toLowerCase()}.`,
  };
}

export async function approveGratuitySettlement(
  _previousState: GratuitySettlementFormState,
  formData: FormData,
): Promise<GratuitySettlementFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const settlementId = textValue(formData, "settlementId");

  if (!settlementId) {
    return { status: "error", message: "Settlement is required." };
  }

  const settlement = await prisma.employeeGratuitySettlement.findUnique({
    where: { id: settlementId },
    select: {
      id: true,
      status: true,
      contractId: true,
      employeeId: true,
      netAmount: true,
    },
  });

  if (!settlement) {
    return { status: "error", message: "Settlement not found." };
  }

  if (
    settlement.status !== "CALCULATED" &&
    settlement.status !== "ESTIMATED"
  ) {
    return {
      status: "error",
      message: "Only estimated or calculated settlements can be approved.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();

  await prisma.employeeGratuitySettlement.update({
    where: { id: settlement.id },
    data: {
      status: "APPROVED",
      approvedAt: now,
      approvedByUserId: actor.actor.userId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      userId: actor.actor.userId,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "EmployeeGratuitySettlement",
      entityId: settlement.id,
      description: `Approved gratuity settlement ${settlement.id}.`,
      newValues: {
        status: "APPROVED",
        netAmount: settlement.netAmount.toString(),
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  revalidateGratuitySettlementPaths({
    employeeId: settlement.employeeId,
    contractId: settlement.contractId,
  });
  return { status: "success", message: "Gratuity settlement approved." };
}

export async function voidGratuitySettlement(
  _previousState: GratuitySettlementFormState,
  formData: FormData,
): Promise<GratuitySettlementFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const settlementId = textValue(formData, "settlementId");
  const reason = textValue(formData, "reason");

  if (!settlementId) {
    return { status: "error", message: "Settlement is required." };
  }

  if (!reason) {
    return {
      status: "error",
      message: "A void reason is required.",
      fieldErrors: { reason: "Enter a reason." },
    };
  }

  const settlement = await prisma.employeeGratuitySettlement.findUnique({
    where: { id: settlementId },
    select: {
      id: true,
      status: true,
      contractId: true,
      employeeId: true,
      payslipId: true,
      payRunId: true,
    },
  });

  if (!settlement) {
    return { status: "error", message: "Settlement not found." };
  }

  if (settlement.status === "PAID" || settlement.status === "VOID") {
    return {
      status: "error",
      message: `Cannot void a settlement in ${settlement.status} status.`,
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      if (settlement.payslipId && settlement.payRunId) {
        const payRun = await tx.payRun.findUnique({
          where: { id: settlement.payRunId },
          select: { status: true },
        });

        if (payRun && isPayRunMutable(payRun.status)) {
          await tx.payrollLineItem.deleteMany({
            where: {
              payslipId: settlement.payslipId,
              code: { in: ["GRATUITY", "GRATUITY_TAX"] },
            },
          });
        }
      }

      await tx.employeeGratuitySettlement.update({
        where: { id: settlement.id },
        data: {
          status: "VOID",
          voidedAt: now,
          voidedByUserId: actor.actor.userId,
          voidReason: reason,
          payRunId: null,
          payslipId: null,
          scheduledAt: null,
        },
      });
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeGratuitySettlement",
        entityId: settlement.id,
        description: `Voided gratuity settlement ${settlement.id}.`,
        newValues: { status: "VOID", reason },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("voidGratuitySettlement failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not void the gratuity settlement.",
    };
  }

  revalidateGratuitySettlementPaths({
    employeeId: settlement.employeeId,
    contractId: settlement.contractId,
  });
  return { status: "success", message: "Gratuity settlement voided." };
}

export async function scheduleGratuitySettlement(
  _previousState: GratuitySettlementFormState,
  formData: FormData,
): Promise<GratuitySettlementFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const settlementId = textValue(formData, "settlementId");
  const payRunId = textValue(formData, "payRunId");

  if (!settlementId || !payRunId) {
    return {
      status: "error",
      message: "Settlement and pay run are required.",
    };
  }

  const settlement = await prisma.employeeGratuitySettlement.findUnique({
    where: { id: settlementId },
    select: {
      id: true,
      status: true,
      contractId: true,
      employeeId: true,
      organizationId: true,
      currency: true,
      grossAmount: true,
      taxAmount: true,
      netAmount: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          nisNumber: true,
          birNumber: true,
          department: { select: { name: true } },
          position: { select: { title: true } },
        },
      },
    },
  });

  if (!settlement) {
    return { status: "error", message: "Settlement not found." };
  }

  if (settlement.status !== "APPROVED") {
    return {
      status: "error",
      message: "Only approved settlements can be scheduled.",
    };
  }

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPeriod: {
        select: {
          id: true,
          name: true,
          periodStart: true,
          periodEnd: true,
        },
      },
      payslips: {
        where: { employeeId: settlement.employeeId },
        select: {
          id: true,
          status: true,
          employeeId: true,
          employeeNumber: true,
          employeeName: true,
        },
      },
    },
  });

  if (!payRun || payRun.organizationId !== settlement.organizationId) {
    return { status: "error", message: "Pay run not found." };
  }

  if (payRun.status !== "DRAFT") {
    return {
      status: "error",
      message: "Gratuity can only be scheduled onto a draft pay run.",
    };
  }

  const gross = Number(settlement.grossAmount.toString());
  const tax = Number(settlement.taxAmount.toString());
  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();

  try {
    const payslipId = await prisma.$transaction(async (tx) => {
      let payslip = payRun.payslips[0] ?? null;

      if (!payslip) {
        if (payRun.runKind !== "OFF_CYCLE") {
          throw new Error(
            "Include the employee on this draft pay run first",
          );
        }

        const employeeName =
          `${settlement.employee.preferredName ?? settlement.employee.firstName} ${settlement.employee.lastName}`.trim();
        const organizationName = await loadPayrollOrganizationName(
          settlement.organizationId,
        );
        const periodAsOf = toStatutoryAsOfKey(payRun.payrollPeriod.periodEnd);
        const lineItems = [
          {
            lineType: "EARNING" as const,
            code: "GRATUITY",
            label: "Contract gratuity",
            amount: gross,
            isTaxable: false,
            notes: null,
          },
          ...(tax > 0
            ? [
                {
                  lineType: "DEDUCTION" as const,
                  code: "GRATUITY_TAX",
                  label: "Gratuity tax withholding",
                  amount: tax,
                  isTaxable: false,
                  notes: null,
                },
              ]
            : []),
        ];

        const snapshot = buildCorrectionDeltaEmployeeSnapshot({
          employeeId: settlement.employeeId,
          currency: settlement.currency,
          employeeNumber: settlement.employee.employeeNumber,
          employeeName,
          nisNumber: settlement.employee.nisNumber,
          birNumber: settlement.employee.birNumber,
          jobTitle: settlement.employee.position?.title ?? null,
          departmentName: settlement.employee.department?.name ?? null,
          payFrequency: "MONTHLY",
          paymentMethod: "BANK_TRANSFER",
          organizationName,
          periodLabel: payRun.payrollPeriod.name,
          periodAsOf,
          lineItems,
          isReady: true,
          blockingIssues: [],
        });

        const bankProfile = await tx.employee.findUnique({
          where: { id: settlement.employeeId },
          select: {
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
          },
        });

        if (bankProfile && bankProfile.bankAccounts.length > 0) {
          const bankInputs = toPayslipBankAccountInputs({
            accounts: bankProfile.bankAccounts,
            allocations: bankProfile.payrollAllocations.map((row) => ({
              employeeBankAccountId: row.employeeBankAccountId,
              allocationType: row.allocationType,
              fixedAmount: row.fixedAmount?.toString() ?? null,
              percentage: row.percentage?.toString() ?? null,
              receivesRemainder: row.receivesRemainder,
              isActive: row.isActive,
              priority: row.priority,
            })),
          });
          const allocated = applyFixedBankAllocations({
            availableAfterStatutory: snapshot.netPay,
            accounts: bankInputs,
          });
          snapshot.snapshot.payslip.bankDistribution =
            allocated.lines.length > 0 ? allocated.lines : null;
        }

        const created = await tx.payslip.create({
          data: toPayslipCreateData({
            organizationId: settlement.organizationId,
            payRunId: payRun.id,
            payrollPeriodId: payRun.payrollPeriod.id,
            row: snapshot,
            status: "DRAFT",
          }),
          select: { id: true },
        });

        await tx.payrollLineItem.createMany({
          data: lineItems.map((line) => ({
            organizationId: settlement.organizationId,
            payRunId: payRun.id,
            payslipId: created.id,
            employeeId: settlement.employeeId,
            lineType: line.lineType,
            code: line.code as "GRATUITY" | "GRATUITY_TAX",
            label: line.label,
            amount: moneyDecimal(line.amount),
            isTaxable: line.isTaxable,
            notes: line.notes,
            createdById: actor.actor.userId,
          })),
        });

        const siblingPayslips = await tx.payslip.findMany({
          where: { payRunId: payRun.id },
          select: {
            id: true,
            status: true,
            grossPay: true,
            totalDeductions: true,
            netPay: true,
          },
        });

        const totals = aggregateIncludedPayRunTotals(
          siblingPayslips.map((slip) => ({
            status: slip.status as PayRunMembershipStatus,
            grossPay:
              slip.id === created.id
                ? snapshot.grossPay
                : Number(slip.grossPay.toString()),
            totalDeductions:
              slip.id === created.id
                ? snapshot.totalDeductions
                : Number(slip.totalDeductions.toString()),
            netPay:
              slip.id === created.id
                ? snapshot.netPay
                : Number(slip.netPay.toString()),
          })),
        );

        await tx.payRun.update({
          where: { id: payRun.id },
          data: {
            employeeCount: totals.employeeCount,
            totalGross: moneyDecimal(totals.totalGross),
            totalDeductions: moneyDecimal(totals.totalDeductions),
            totalNet: moneyDecimal(totals.totalNet),
          },
        });

        payslip = {
          id: created.id,
          status: "DRAFT",
          employeeId: settlement.employeeId,
          employeeNumber: settlement.employee.employeeNumber,
          employeeName,
        };
      } else {
        if (payslip.status !== "DRAFT") {
          throw new Error(
            "Gratuity can only be added to an included draft payslip.",
          );
        }

        await tx.payrollLineItem.deleteMany({
          where: {
            payslipId: payslip.id,
            code: { in: ["GRATUITY", "GRATUITY_TAX"] },
          },
        });

        await tx.payrollLineItem.create({
          data: {
            organizationId: settlement.organizationId,
            payRunId: payRun.id,
            payslipId: payslip.id,
            employeeId: settlement.employeeId,
            lineType: "EARNING",
            code: "GRATUITY",
            label: "Contract gratuity",
            amount: moneyDecimal(gross),
            isTaxable: false,
            notes: null,
            createdById: actor.actor.userId,
          },
        });

        if (tax > 0) {
          await tx.payrollLineItem.create({
            data: {
              organizationId: settlement.organizationId,
              payRunId: payRun.id,
              payslipId: payslip.id,
              employeeId: settlement.employeeId,
              lineType: "DEDUCTION",
              code: "GRATUITY_TAX",
              label: "Gratuity tax withholding",
              amount: moneyDecimal(tax),
              isTaxable: false,
              notes: null,
              createdById: actor.actor.userId,
            },
          });
        }
      }

      await tx.employeeGratuitySettlement.update({
        where: { id: settlement.id },
        data: {
          status: "SCHEDULED",
          payRunId: payRun.id,
          payslipId: payslip.id,
          scheduledAt: now,
        },
      });

      return payslip.id;
    });

    if (payRun.payslips.length > 0) {
      const recalculated = await rebuildDraftPayslipFromLineItems({
        payRun: {
          id: payRun.id,
          organizationId: payRun.organizationId,
          status: payRun.status,
          runKind: payRun.runKind,
          payrollPeriod: payRun.payrollPeriod,
        },
        payslip: await prisma.payslip.findUniqueOrThrow({
          where: { id: payslipId },
          select: {
            id: true,
            status: true,
            employeeId: true,
            employeeNumber: true,
            employeeName: true,
            lineItems: {
              select: {
                lineType: true,
                code: true,
                label: true,
                amount: true,
                isTaxable: true,
                notes: true,
              },
            },
          },
        }),
        siblingPayslips: await prisma.payslip.findMany({
          where: { payRunId: payRun.id },
          select: {
            id: true,
            status: true,
            grossPay: true,
            totalDeductions: true,
            netPay: true,
          },
        }),
      });

      if (!recalculated.ok) {
        return { status: "error", message: recalculated.message };
      }
    }

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeGratuitySettlement",
        entityId: settlement.id,
        description: `Scheduled gratuity settlement onto pay run ${payRun.runNumber}.`,
        newValues: {
          status: "SCHEDULED",
          payRunId: payRun.id,
          payslipId,
          grossAmount: gross,
          taxAmount: tax,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("scheduleGratuitySettlement failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not schedule the gratuity settlement.",
    };
  }

  revalidateGratuitySettlementPaths({
    employeeId: settlement.employeeId,
    contractId: settlement.contractId,
  });
  revalidatePath(`/payroll/runs/${payRunId}`);
  return {
    status: "success",
    message: "Gratuity settlement scheduled on the draft pay run.",
  };
}

export async function markGratuityTaxRemitted(
  _previousState: GratuitySettlementFormState,
  formData: FormData,
): Promise<GratuitySettlementFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const settlementId = textValue(formData, "settlementId");
  const reference = textValue(formData, "reference");

  if (!settlementId) {
    return { status: "error", message: "Settlement is required." };
  }

  if (!reference) {
    return {
      status: "error",
      message: "A remittance reference is required.",
      fieldErrors: { reference: "Enter a remittance reference." },
    };
  }

  const settlement = await prisma.employeeGratuitySettlement.findUnique({
    where: { id: settlementId },
    select: {
      id: true,
      status: true,
      contractId: true,
      employeeId: true,
      taxAmount: true,
      taxRemittanceStatus: true,
    },
  });

  if (!settlement) {
    return { status: "error", message: "Settlement not found." };
  }

  if (settlement.status === "VOID") {
    return { status: "error", message: "Cannot remit tax for a void settlement." };
  }

  if (Number(settlement.taxAmount.toString()) <= 0) {
    return {
      status: "error",
      message: "This settlement has no gratuity tax to remit.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const now = new Date();

  await prisma.employeeGratuitySettlement.update({
    where: { id: settlement.id },
    data: {
      taxRemittanceStatus: "REMITTED",
      taxRemittedAt: now,
      taxRemittedByUserId: actor.actor.userId,
      taxRemittanceReference: reference,
    },
  });

  await prisma.auditEvent.create({
    data: {
      userId: actor.actor.userId,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "EmployeeGratuitySettlement",
      entityId: settlement.id,
      description: `Marked gratuity tax remitted for settlement ${settlement.id}.`,
      newValues: {
        taxRemittanceStatus: "REMITTED",
        taxRemittanceReference: reference,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  revalidateGratuitySettlementPaths({
    employeeId: settlement.employeeId,
    contractId: settlement.contractId,
  });
  return { status: "success", message: "Gratuity tax marked as remitted." };
}

/**
 * Mark SCHEDULED settlements attached to a posted pay run as PAID.
 * Intended to be called from postPayRun after a successful post.
 * Also auto-completes open offboarding FINAL_PAY_CHECK tasks when gratuity is paid.
 */
export async function markGratuitySettlementsPaidForPayRun(
  payRunId: string,
  options?: { actorUserId?: string | null },
): Promise<{ updated: number }> {
  const now = new Date();

  const settlements = await prisma.employeeGratuitySettlement.findMany({
    where: {
      payRunId,
      status: "SCHEDULED",
    },
    select: {
      id: true,
      employeeId: true,
      contractId: true,
      netAmount: true,
      grossAmount: true,
      currency: true,
    },
  });

  if (settlements.length === 0) {
    return { updated: 0 };
  }

  const result = await prisma.employeeGratuitySettlement.updateMany({
    where: {
      id: { in: settlements.map((row) => row.id) },
      status: "SCHEDULED",
    },
    data: {
      status: "PAID",
      paidAt: now,
    },
  });

  const payRun = await prisma.payRun.findUnique({
    where: { id: payRunId },
    select: { postedById: true, runNumber: true },
  });
  const actorUserId =
    options?.actorUserId ?? payRun?.postedById ?? null;

  for (const settlement of settlements) {
    const tasks = await prisma.employeeOffboardingTask.findMany({
      where: {
        code: "FINAL_PAY_CHECK",
        status: { in: ["PENDING", "IN_PROGRESS"] },
        case: {
          employeeId: settlement.employeeId,
          status: { in: ["OPEN", "CLEARED"] },
        },
      },
      select: { id: true },
    });

    for (const task of tasks) {
      if (!actorUserId) {
        await prisma.employeeOffboardingTask.update({
          where: { id: task.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            relatedEntityType: "EmployeeGratuitySettlement",
            relatedEntityId: settlement.id,
            notes: `Auto-completed: gratuity settlement paid on pay run ${payRun?.runNumber ?? payRunId} (net ${settlement.netAmount.toString()} ${settlement.currency}).`,
          },
        });
        continue;
      }

      await completeOffboardingTask({
        taskId: task.id,
        completedByUserId: actorUserId,
        relatedEntityType: "EmployeeGratuitySettlement",
        relatedEntityId: settlement.id,
        notes: `Auto-completed: gratuity settlement paid on pay run ${payRun?.runNumber ?? payRunId} (net ${settlement.netAmount.toString()} ${settlement.currency}).`,
      });
    }

    revalidatePath(`/people/employees/${settlement.employeeId}`);
  }

  if (result.count > 0) {
    revalidatePath("/payroll/gratuity");
    revalidatePath("/people/lifecycle");
  }

  return { updated: result.count };
}
