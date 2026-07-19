import { prisma } from "@/lib/prisma";
import { calculateContractGratuityEstimate } from "@/src/modules/hr/services/calculate-contract-gratuity";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";

export type EmploymentContractListRecord = {
  id: string;
  contractNumber: string | null;
  contractType: string;
  changeType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  jobTitle: string;
  baseSalary: string;
  currency: string;
  gratuityEligible: boolean;
  gratuityRate: string | null;
  gratuityTaxRate: string | null;
  isCurrent: boolean;
  signedDate: string | null;
  collectedAt: string | null;
  terminationDate: string | null;
  documentReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeContractHistory = {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    workforceCategory: string;
    employmentType: string;
    hireDate: string;
    updatedAt: string;
    departmentId: string | null;
    positionId: string | null;
    departmentName: string | null;
    positionTitle: string | null;
  };
  contracts: EmploymentContractListRecord[];
};

function mapContract(contract: {
  id: string;
  contractNumber: string | null;
  contractType: string;
  changeType: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  jobTitle: string;
  baseSalary: { toString(): string };
  currency: string;
  gratuityEligible: boolean;
  gratuityRate: { toString(): string } | null;
  gratuityTaxRate: { toString(): string } | null;
  isCurrent: boolean;
  signedDate: Date | null;
  collectedAt: Date | null;
  terminationDate: Date | null;
  documentReference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmploymentContractListRecord {
  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    contractType: contract.contractType,
    changeType: contract.changeType,
    status: contract.status,
    startDate: contract.startDate.toISOString().slice(0, 10),
    endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
    jobTitle: contract.jobTitle,
    baseSalary: contract.baseSalary.toString(),
    currency: contract.currency,
    gratuityEligible: contract.gratuityEligible,
    gratuityRate: contract.gratuityRate?.toString() ?? null,
    gratuityTaxRate: contract.gratuityTaxRate?.toString() ?? null,
    isCurrent: contract.isCurrent,
    signedDate: contract.signedDate?.toISOString().slice(0, 10) ?? null,
    collectedAt: contract.collectedAt?.toISOString() ?? null,
    terminationDate:
      contract.terminationDate?.toISOString().slice(0, 10) ?? null,
    documentReference: contract.documentReference,
    notes: contract.notes,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
}

export async function getEmployeeContractHistory(
  employeeId: string,
): Promise<EmployeeContractHistory | null> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      workforceCategory: true,
      employmentType: true,
      hireDate: true,
      updatedAt: true,
      departmentId: true,
      positionId: true,
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
      contracts: {
        orderBy: [
          {
            isCurrent: "desc",
          },
          {
            startDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        select: {
          id: true,
          contractNumber: true,
          contractType: true,
          changeType: true,
          status: true,
          startDate: true,
          endDate: true,
          jobTitle: true,
          baseSalary: true,
          currency: true,
          gratuityEligible: true,
          gratuityRate: true,
          gratuityTaxRate: true,
          isCurrent: true,
          signedDate: true,
          collectedAt: true,
          terminationDate: true,
          documentReference: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      workforceCategory: employee.workforceCategory,
      employmentType: employee.employmentType,
      hireDate: employee.hireDate.toISOString().slice(0, 10),
      updatedAt: employee.updatedAt.toISOString(),
      departmentId: employee.departmentId,
      positionId: employee.positionId,
      departmentName: employee.department?.name ?? null,
      positionTitle: resolveEmployeePositionTitle({
        assignmentPositionTitle: employee.assignments[0]?.position?.title,
        positionTitle: employee.position?.title,
        contractJobTitle:
          employee.contracts.find((contract) => contract.isCurrent)?.jobTitle ??
          null,
      }),
    },
    contracts: employee.contracts.map(mapContract),
  };
}

export type EmploymentContractProfile = EmploymentContractListRecord & {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    workforceCategory: string;
  };
  sourceContract: {
    id: string;
    contractNumber: string | null;
    changeType: string;
    status: string;
    jobTitle: string;
    startDate: string;
    endDate: string | null;
    collectedAt: string | null;
    baseSalary: string;
    currency: string;
  } | null;
  previousVersions: {
    id: string;
    contractNumber: string | null;
    changeType: string;
    status: string;
    jobTitle: string;
    startDate: string;
    endDate: string | null;
    collectedAt: string | null;
    baseSalary: string;
    currency: string;
    isCurrent: boolean;
  }[];
  amendments: {
    id: string;
    contractNumber: string | null;
    changeType: string;
    status: string;
    startDate: string;
  }[];
  amendedAfterCollection: boolean;
  terminationReason: string | null;
  probationEndDate: string | null;
  noticePeriodDays: number | null;
  fte: string | null;
  standardHoursPerWeek: string | null;
  approvedAt: string | null;
  employeeSignedAt: string | null;
  orgSignedAt: string | null;
  activatedAt: string | null;
  documentStorageKey: string | null;
  documentFileName: string | null;
  documentMimeType: string | null;
  documentSize: number | null;
  allowances: {
    id: string;
    categoryId: string;
    categoryName: string;
    amount: string;
    frequency: string;
    isTaxable: boolean;
    includedInGratuity: boolean;
    notes: string | null;
  }[];
};

export async function getEmploymentContractProfile(
  employeeId: string,
  contractId: string,
): Promise<EmploymentContractProfile | null> {
  const contract = await prisma.employmentContract.findFirst({
    where: {
      id: contractId,
      employeeId,
    },
    select: {
      id: true,
      contractNumber: true,
      contractType: true,
      changeType: true,
      status: true,
      startDate: true,
      endDate: true,
      jobTitle: true,
      baseSalary: true,
      currency: true,
      gratuityEligible: true,
      gratuityRate: true,
      gratuityTaxRate: true,
      isCurrent: true,
      signedDate: true,
      collectedAt: true,
      terminationDate: true,
      terminationReason: true,
      documentReference: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      probationEndDate: true,
      noticePeriodDays: true,
      fte: true,
      standardHoursPerWeek: true,
      approvedAt: true,
      employeeSignedAt: true,
      orgSignedAt: true,
      activatedAt: true,
      documentStorageKey: true,
      documentFileName: true,
      documentMimeType: true,
      documentSize: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          workforceCategory: true,
        },
      },
      sourceContract: {
        select: {
          id: true,
          contractNumber: true,
          changeType: true,
          status: true,
          jobTitle: true,
          startDate: true,
          endDate: true,
          collectedAt: true,
          baseSalary: true,
          currency: true,
          sourceContractId: true,
        },
      },
      allowances: {
        orderBy: {
          category: {
            name: "asc",
          },
        },
        select: {
          id: true,
          categoryId: true,
          amount: true,
          frequency: true,
          isTaxable: true,
          includedInGratuity: true,
          notes: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
      amendments: {
        orderBy: {
          startDate: "desc",
        },
        select: {
          id: true,
          contractNumber: true,
          changeType: true,
          status: true,
          startDate: true,
        },
      },
    },
  });

  if (!contract) {
    return null;
  }

  const previousVersions: EmploymentContractProfile["previousVersions"] = [];

  let walkId = contract.sourceContract?.id ?? null;

  while (walkId) {
    const previous = await prisma.employmentContract.findFirst({
      where: {
        id: walkId,
        employeeId,
      },
      select: {
        id: true,
        contractNumber: true,
        changeType: true,
        status: true,
        jobTitle: true,
        startDate: true,
        endDate: true,
        collectedAt: true,
        baseSalary: true,
        currency: true,
        isCurrent: true,
        sourceContractId: true,
      },
    });

    if (!previous) {
      break;
    }

    previousVersions.push({
      id: previous.id,
      contractNumber: previous.contractNumber,
      changeType: previous.changeType,
      status: previous.status,
      jobTitle: previous.jobTitle,
      startDate: previous.startDate.toISOString().slice(0, 10),
      endDate: previous.endDate?.toISOString().slice(0, 10) ?? null,
      collectedAt: previous.collectedAt?.toISOString() ?? null,
      baseSalary: previous.baseSalary.toString(),
      currency: previous.currency,
      isCurrent: previous.isCurrent,
    });

    walkId = previous.sourceContractId;
  }

  const amendedAfterCollection =
    Boolean(contract.sourceContract?.collectedAt) &&
    ["AMENDMENT", "SALARY_ADJUSTMENT", "POSITION_CHANGE", "EXTENSION"].includes(
      contract.changeType,
    );

  return {
    ...mapContract(contract),
    employee: contract.employee,
    terminationReason: contract.terminationReason,
    amendedAfterCollection,
    probationEndDate: contract.probationEndDate?.toISOString().slice(0, 10) ?? null,
    noticePeriodDays: contract.noticePeriodDays,
    fte: contract.fte?.toString() ?? null,
    standardHoursPerWeek: contract.standardHoursPerWeek?.toString() ?? null,
    approvedAt: contract.approvedAt?.toISOString() ?? null,
    employeeSignedAt: contract.employeeSignedAt?.toISOString() ?? null,
    orgSignedAt: contract.orgSignedAt?.toISOString() ?? null,
    activatedAt: contract.activatedAt?.toISOString() ?? null,
    documentStorageKey: contract.documentStorageKey,
    documentFileName: contract.documentFileName,
    documentMimeType: contract.documentMimeType,
    documentSize: contract.documentSize,
    previousVersions,
    allowances: contract.allowances.map((allowance) => ({
      id: allowance.id,
      categoryId: allowance.categoryId,
      categoryName: allowance.category.name,
      amount: allowance.amount.toString(),
      frequency: allowance.frequency,
      isTaxable: allowance.isTaxable,
      includedInGratuity: allowance.includedInGratuity,
      notes: allowance.notes,
    })),
    sourceContract: contract.sourceContract
      ? {
          id: contract.sourceContract.id,
          contractNumber: contract.sourceContract.contractNumber,
          changeType: contract.sourceContract.changeType,
          status: contract.sourceContract.status,
          jobTitle: contract.sourceContract.jobTitle,
          startDate: contract.sourceContract.startDate
            .toISOString()
            .slice(0, 10),
          endDate:
            contract.sourceContract.endDate?.toISOString().slice(0, 10) ?? null,
          collectedAt:
            contract.sourceContract.collectedAt?.toISOString() ?? null,
          baseSalary: contract.sourceContract.baseSalary.toString(),
          currency: contract.sourceContract.currency,
        }
      : null,
    amendments: contract.amendments.map((amendment) => ({
      id: amendment.id,
      contractNumber: amendment.contractNumber,
      changeType: amendment.changeType,
      status: amendment.status,
      startDate: amendment.startDate.toISOString().slice(0, 10),
    })),
  };
}

export type ContractMonitoringRecord = {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  contractNumber: string | null;
  positionTitle: string;
  contractType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  baseSalary: string;
  currency: string;
  isCurrent: boolean;
  daysUntilExpiry: number | null;
  expiryCategory:
    | "EXPIRED"
    | "WITHIN_30_DAYS"
    | "WITHIN_60_DAYS"
    | "WITHIN_90_DAYS"
    | "LATER"
    | "NO_END_DATE";
  gratuityEligible: boolean;
  estimatedGrossEarnings: string | null;
  estimatedGrossGratuity: string | null;
  estimatedTax: string | null;
  estimatedNetGratuity: string | null;
};

export type ContractMonitoringDashboard = {
  contracts: ContractMonitoringRecord[];
  summary: {
    active: number;
    pendingApproval: number;
    awaitingSignature: number;
    draft: number;
    expiringWithin30Days: number;
    expiringWithin60Days: number;
    expiringWithin90Days: number;
    expired: number;
    missingEndDate: number;
    estimatedNetGratuityExposure: string;
  };
};

function contractExpiryCategory(
  daysUntilExpiry: number | null,
): ContractMonitoringRecord["expiryCategory"] {
  if (daysUntilExpiry === null) {
    return "NO_END_DATE";
  }

  if (daysUntilExpiry < 0) {
    return "EXPIRED";
  }

  if (daysUntilExpiry <= 30) {
    return "WITHIN_30_DAYS";
  }

  if (daysUntilExpiry <= 60) {
    return "WITHIN_60_DAYS";
  }

  if (daysUntilExpiry <= 90) {
    return "WITHIN_90_DAYS";
  }

  return "LATER";
}

export async function getContractMonitoringDashboard(): Promise<ContractMonitoringDashboard> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return {
      contracts: [],
      summary: {
        active: 0,
        pendingApproval: 0,
        awaitingSignature: 0,
        draft: 0,
        expiringWithin30Days: 0,
        expiringWithin60Days: 0,
        expiringWithin90Days: 0,
        expired: 0,
        missingEndDate: 0,
        estimatedNetGratuityExposure: "0.00",
      },
    };
  }

  const contracts = await prisma.employmentContract.findMany({
    where: {
      employee: {
        organizationId: organization.id,
      },
    },
    orderBy: [
      {
        isCurrent: "desc",
      },
      {
        endDate: "asc",
      },
      {
        startDate: "desc",
      },
    ],
    select: {
      id: true,
      contractNumber: true,
      contractType: true,
      status: true,
      startDate: true,
      endDate: true,
      jobTitle: true,
      baseSalary: true,
      currency: true,
      gratuityEligible: true,
      gratuityRate: true,
      gratuityTaxRate: true,
      isCurrent: true,
      allowances: {
        select: {
          amount: true,
          frequency: true,
          includedInGratuity: true,
        },
      },
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
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
        },
      },
    },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const records = contracts.map((contract) => {
    let daysUntilExpiry: number | null = null;

    if (contract.endDate) {
      const endDate = new Date(contract.endDate);
      endDate.setUTCHours(0, 0, 0, 0);

      daysUntilExpiry = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    let estimatedGrossEarnings: number | null = null;
    let estimatedGrossGratuity: number | null = null;
    let estimatedTax: number | null = null;
    let estimatedNetGratuity: number | null = null;

    if (
      contract.gratuityEligible &&
      contract.endDate &&
      contract.gratuityRate
    ) {
      const estimate = calculateContractGratuityEstimate({
        startDate: contract.startDate,
        endDate: contract.endDate,
        baseSalary: contract.baseSalary.toString(),
        allowances: contract.allowances.map((allowance) => ({
          amount: allowance.amount.toString(),
          frequency: allowance.frequency,
          includedInGratuity: allowance.includedInGratuity,
        })),
        gratuityRate: contract.gratuityRate.toString(),
        gratuityTaxRate: contract.gratuityTaxRate?.toString() ?? 0,
      });

      estimatedGrossEarnings = estimate.estimatedGrossEarnings;
      estimatedGrossGratuity = estimate.estimatedGrossGratuity;
      estimatedTax = estimate.estimatedTax;
      estimatedNetGratuity = estimate.estimatedNetGratuity;
    }

    const positionTitle =
      contract.isCurrent
        ? resolveEmployeePositionTitle({
            assignmentPositionTitle:
              contract.employee.assignments[0]?.position?.title,
            positionTitle: contract.employee.position?.title,
            contractJobTitle: contract.jobTitle,
          }) ?? contract.jobTitle
        : contract.jobTitle;

    return {
      id: contract.id,
      employeeId: contract.employee.id,
      employeeNumber: contract.employee.employeeNumber,
      employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`,
      contractNumber: contract.contractNumber,
      positionTitle,
      contractType: contract.contractType,
      status: contract.status,
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
      baseSalary: contract.baseSalary.toString(),
      currency: contract.currency,
      isCurrent: contract.isCurrent,
      daysUntilExpiry,
      expiryCategory: contractExpiryCategory(daysUntilExpiry),
      gratuityEligible: contract.gratuityEligible,
      estimatedGrossEarnings: estimatedGrossEarnings?.toFixed(2) ?? null,
      estimatedGrossGratuity: estimatedGrossGratuity?.toFixed(2) ?? null,
      estimatedTax: estimatedTax?.toFixed(2) ?? null,
      estimatedNetGratuity: estimatedNetGratuity?.toFixed(2) ?? null,
    } satisfies ContractMonitoringRecord;
  });

  const currentRecords = records.filter((contract) => contract.isCurrent);

  const estimatedNetGratuityExposure = currentRecords.reduce(
    (total, contract) => total + Number(contract.estimatedNetGratuity ?? 0),
    0,
  );

  return {
    contracts: records,
    summary: {
      active: currentRecords.filter((contract) => contract.status === "ACTIVE")
        .length,
      pendingApproval: records.filter(
        (contract) => contract.status === "PENDING_APPROVAL",
      ).length,
      awaitingSignature: records.filter(
        (contract) => contract.status === "AWAITING_SIGNATURE",
      ).length,
      draft: records.filter((contract) => contract.status === "DRAFT").length,
      expiringWithin30Days: currentRecords.filter(
        (contract) => contract.expiryCategory === "WITHIN_30_DAYS",
      ).length,
      expiringWithin60Days: currentRecords.filter(
        (contract) => contract.expiryCategory === "WITHIN_60_DAYS",
      ).length,
      expiringWithin90Days: currentRecords.filter(
        (contract) => contract.expiryCategory === "WITHIN_90_DAYS",
      ).length,
      expired: currentRecords.filter(
        (contract) => contract.expiryCategory === "EXPIRED",
      ).length,
      missingEndDate: currentRecords.filter(
        (contract) => contract.expiryCategory === "NO_END_DATE",
      ).length,
      estimatedNetGratuityExposure: estimatedNetGratuityExposure.toFixed(2),
    },
  };
}

export type AllowanceCategoryRecord = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  isTaxableDefault: boolean;
  includedInGratuityDefault: boolean;
};

export async function getAllowanceCategories(): Promise<
  AllowanceCategoryRecord[]
> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return [];
  }

  return prisma.allowanceCategory.findMany({
    where: {
      organizationId: organization.id,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isTaxableDefault: true,
      includedInGratuityDefault: true,
    },
  });
}

export type ContractCompensationSummary = {
  monthlyBaseSalary: string;
  monthlyRecurringAllowances: string;
  annualRecurringAllowances: string;
  oneTimeAllowances: string;
  monthlyGrossCompensation: string;
  annualGrossCompensation: string;
  taxableAllowanceAnnualTotal: string;
  nonTaxableAllowanceAnnualTotal: string;
  gratuityEligibleAnnualEarnings: string;
  contractMonths: string | null;
  estimatedGrossEarnings: string | null;
  estimatedGrossGratuity: string | null;
  estimatedTax: string | null;
  estimatedNetGratuity: string | null;
};

function annualizeAllowance(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY":
      return amount * 52;
    case "BIWEEKLY":
      return amount * 26;
    case "PER_PAY_PERIOD":
      return amount * 12;
    case "ANNUAL":
      return amount;
    case "ONE_TIME":
      return 0;
    default:
      return amount * 12;
  }
}

export function calculateContractCompensation(contract: {
  baseSalary: string;
  startDate: string;
  endDate: string | null;
  gratuityEligible: boolean;
  gratuityRate: string | null;
  gratuityTaxRate: string | null;
  allowances: {
    amount: string;
    frequency: string;
    isTaxable: boolean;
    includedInGratuity: boolean;
  }[];
}): ContractCompensationSummary {
  const monthlyBaseSalary = Number(contract.baseSalary);

  let annualRecurringAllowances = 0;
  let oneTimeAllowances = 0;
  let taxableAllowanceAnnualTotal = 0;
  let nonTaxableAllowanceAnnualTotal = 0;
  let gratuityEligibleAllowanceAnnualTotal = 0;

  for (const allowance of contract.allowances) {
    const amount = Number(allowance.amount);

    if (allowance.frequency === "ONE_TIME") {
      oneTimeAllowances += amount;
      continue;
    }

    const annualValue = annualizeAllowance(amount, allowance.frequency);

    annualRecurringAllowances += annualValue;

    if (allowance.isTaxable) {
      taxableAllowanceAnnualTotal += annualValue;
    } else {
      nonTaxableAllowanceAnnualTotal += annualValue;
    }

    if (allowance.includedInGratuity) {
      gratuityEligibleAllowanceAnnualTotal += annualValue;
    }
  }

  const monthlyRecurringAllowances = annualRecurringAllowances / 12;

  const monthlyGrossCompensation =
    monthlyBaseSalary + monthlyRecurringAllowances;

  const annualBaseSalary = monthlyBaseSalary * 12;

  const annualGrossCompensation =
    annualBaseSalary + annualRecurringAllowances + oneTimeAllowances;

  const gratuityEligibleAnnualEarnings =
    annualBaseSalary + gratuityEligibleAllowanceAnnualTotal;

  let contractMonths: string | null = null;
  let estimatedGrossEarnings: string | null = null;
  let estimatedGrossGratuity: string | null = null;
  let estimatedTax: string | null = null;
  let estimatedNetGratuity: string | null = null;

  if (contract.gratuityEligible && contract.endDate && contract.gratuityRate) {
    const estimate = calculateContractGratuityEstimate({
      startDate: new Date(`${contract.startDate}T00:00:00.000Z`),
      endDate: new Date(`${contract.endDate}T00:00:00.000Z`),
      baseSalary: contract.baseSalary,
      allowances: contract.allowances,
      gratuityRate: contract.gratuityRate,
      gratuityTaxRate: contract.gratuityTaxRate,
    });

    contractMonths = String(estimate.contractMonths);
    estimatedGrossEarnings = estimate.estimatedGrossEarnings.toFixed(2);
    estimatedGrossGratuity = estimate.estimatedGrossGratuity.toFixed(2);
    estimatedTax = estimate.estimatedTax.toFixed(2);
    estimatedNetGratuity = estimate.estimatedNetGratuity.toFixed(2);
  }

  return {
    monthlyBaseSalary: monthlyBaseSalary.toFixed(2),
    monthlyRecurringAllowances: monthlyRecurringAllowances.toFixed(2),
    annualRecurringAllowances: annualRecurringAllowances.toFixed(2),
    oneTimeAllowances: oneTimeAllowances.toFixed(2),
    monthlyGrossCompensation: monthlyGrossCompensation.toFixed(2),
    annualGrossCompensation: annualGrossCompensation.toFixed(2),
    taxableAllowanceAnnualTotal: taxableAllowanceAnnualTotal.toFixed(2),
    nonTaxableAllowanceAnnualTotal: nonTaxableAllowanceAnnualTotal.toFixed(2),
    gratuityEligibleAnnualEarnings: gratuityEligibleAnnualEarnings.toFixed(2),
    contractMonths,
    estimatedGrossEarnings,
    estimatedGrossGratuity,
    estimatedTax,
    estimatedNetGratuity,
  };
}
