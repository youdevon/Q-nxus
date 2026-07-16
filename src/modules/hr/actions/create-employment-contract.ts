"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AllowanceFrequency,
  ContractChangeType,
  EmploymentContractType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { earliestRenewalStartDate } from "@/src/lib/contract-dates";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  createContractLeaveBalances,
  type LeaveEntitlementOverride,
} from "@/src/modules/hr/services/create-contract-leave-balances";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type EmploymentContractFormState = {
  status: "idle" | "error" | "conflict";
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

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDecimal(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

type SubmittedAllowance = {
  categoryId: string;
  customCategoryName: string;
  amount: string;
  frequency: string;
  isTaxable: boolean;
  includedInGratuity: boolean;
  notes: string;
};

function parseAllowances(formData: FormData): SubmittedAllowance[] | null {
  const rawValue = textValue(formData, "allowancesJson");

  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as SubmittedAllowance[];
  } catch {
    return null;
  }
}

export async function createEmploymentContract(
  _previousState: EmploymentContractFormState,
  formData: FormData,
): Promise<EmploymentContractFormState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");
  const sourceContractId = nullableText(formData, "sourceContractId");
  const contractNumber = nullableText(formData, "contractNumber");
  const contractTypeValue = textValue(formData, "contractType");
  const changeTypeValue = textValue(formData, "changeType");
  const startDate = parseDate(textValue(formData, "startDate"));
  const endDate = parseDate(textValue(formData, "endDate"));
  const signedDate = parseDate(textValue(formData, "signedDate"));
  const jobTitle = textValue(formData, "jobTitle");
  const baseSalary = parseDecimal(textValue(formData, "baseSalary"));
  const currency = textValue(formData, "currency").toUpperCase() || "TTD";
  const gratuityEligible = formData.get("gratuityEligible") === "on";
  const gratuityRate = parseDecimal(textValue(formData, "gratuityRate"));
  const gratuityTaxRate = parseDecimal(textValue(formData, "gratuityTaxRate"));
  const documentReference = nullableText(formData, "documentReference");
  const notes = nullableText(formData, "notes");
  const vacationLeaveDaysRaw = textValue(formData, "vacationLeaveDays");
  const sickLeaveDaysRaw = textValue(formData, "sickLeaveDays");

  const allowances = parseAllowances(formData);

  const fieldErrors: Record<string, string> = {};

  function parseNonNegativeLeaveDays(
    raw: string,
    field: string,
    label: string,
  ): number | null {
    if (!raw) {
      return null;
    }

    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed < 0) {
      fieldErrors[field] =
        `Enter a valid non-negative number of ${label} days.`;
      return null;
    }

    return parsed;
  }

  const vacationLeaveDays = parseNonNegativeLeaveDays(
    vacationLeaveDaysRaw,
    "vacationLeaveDays",
    "vacation leave",
  );
  const sickLeaveDays = parseNonNegativeLeaveDays(
    sickLeaveDaysRaw,
    "sickLeaveDays",
    "sick leave",
  );

  if (allowances === null) {
    fieldErrors.allowances = "The allowance information could not be read.";
  }

  if (allowances) {
    allowances.forEach((allowance, index) => {
      const amount = Number(allowance.amount);

      if (
        !allowance.categoryId ||
        (allowance.categoryId === "NEW" &&
          allowance.customCategoryName.trim().length < 2)
      ) {
        fieldErrors[`allowance.${index}.category`] =
          `Select or enter a category for allowance ${index + 1}.`;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        fieldErrors[`allowance.${index}.amount`] =
          `Enter a valid amount for allowance ${index + 1}.`;
      }

      if (
        !Object.values(AllowanceFrequency).includes(
          allowance.frequency as AllowanceFrequency,
        )
      ) {
        fieldErrors[`allowance.${index}.frequency`] =
          `Select a valid frequency for allowance ${index + 1}.`;
      }
    });
  }

  if (
    !Object.values(EmploymentContractType).includes(
      contractTypeValue as EmploymentContractType,
    )
  ) {
    fieldErrors.contractType = "Select a valid contract type.";
  }

  if (
    !Object.values(ContractChangeType).includes(
      changeTypeValue as ContractChangeType,
    )
  ) {
    fieldErrors.changeType = "Select a valid change type.";
  }

  if (!startDate) {
    fieldErrors.startDate = "Enter a valid start date.";
  }

  if (!endDate) {
    fieldErrors.endDate =
      "Enter a contract end date. Leave balances and gratuity estimates require an end date.";
  }

  if (endDate && startDate && endDate < startDate) {
    fieldErrors.endDate = "The end date cannot be before the start date.";
  }

  if (jobTitle.length < 2) {
    fieldErrors.jobTitle = "Enter a valid job title.";
  }

  if (baseSalary === null || baseSalary < 0) {
    fieldErrors.baseSalary = "Enter a valid salary.";
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    fieldErrors.currency = "Currency must use a three-letter code.";
  }

  if (
    gratuityEligible &&
    (gratuityRate === null || gratuityRate < 0 || gratuityRate > 100)
  ) {
    fieldErrors.gratuityRate = "Enter a gratuity rate between 0 and 100.";
  }

  if (
    gratuityEligible &&
    (gratuityTaxRate === null || gratuityTaxRate < 0 || gratuityTaxRate > 100)
  ) {
    fieldErrors.gratuityTaxRate =
      "Enter a gratuity tax rate between 0 and 100.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the contract information.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      organizationId: true,
    },
  });

  if (!employee) {
    return {
      status: "error",
      message: "The employee record no longer exists.",
    };
  }

  if (startDate! < employee.hireDate) {
    return {
      status: "error",
      message: "The contract cannot begin before the employee’s hire date.",
    };
  }

  if (sourceContractId) {
    const sourceContract = await prisma.employmentContract.findFirst({
      where: {
        id: sourceContractId,
        employeeId,
      },
      select: {
        id: true,
        status: true,
        endDate: true,
        terminationDate: true,
      },
    });

    if (!sourceContract) {
      return {
        status: "error",
        message: "The source contract is invalid.",
      };
    }

    const isRenewal =
      changeTypeValue === "RENEWAL" || changeTypeValue === "EXTENSION";

    if (isRenewal && startDate) {
      const earliestStart = earliestRenewalStartDate({
        endDate: sourceContract.endDate?.toISOString().slice(0, 10) ?? null,
        terminationDate:
          sourceContract.terminationDate?.toISOString().slice(0, 10) ?? null,
        status: sourceContract.status,
      });

      if (earliestStart) {
        const startIso = startDate.toISOString().slice(0, 10);

        if (startIso < earliestStart) {
          fieldErrors.startDate = `Renewal start date must be on or after ${earliestStart} so it does not overlap the previous contract.`;
        }
      } else {
        fieldErrors.startDate =
          "The previous contract needs an end or termination date before it can be renewed.";
      }

      if (Object.keys(fieldErrors).length > 0) {
        return {
          status: "error",
          message: "Review the contract information.",
          fieldErrors,
        };
      }
    }
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const contract = await prisma.$transaction(async (transaction) => {
      const currentContracts = await transaction.employmentContract.findMany({
        where: {
          employeeId,
          isCurrent: true,
        },
      });

      for (const current of currentContracts) {
        await transaction.employmentContract.update({
          where: {
            id: current.id,
          },
          data: {
            isCurrent: false,
            status: "SUPERSEDED",
          },
        });
      }

      const created = await transaction.employmentContract.create({
        data: {
          employeeId,
          sourceContractId,
          contractNumber,
          contractType: contractTypeValue as EmploymentContractType,
          changeType: changeTypeValue as ContractChangeType,
          status: "ACTIVE",
          startDate: startDate!,
          endDate: endDate!,
          jobTitle,
          baseSalary: baseSalary!,
          currency,
          gratuityEligible,
          gratuityRate: gratuityEligible ? gratuityRate : null,
          gratuityTaxRate: gratuityEligible ? gratuityTaxRate : null,
          isCurrent: true,
          signedDate,
          documentReference,
          notes,
        },
      });

      for (const allowance of allowances ?? []) {
        let categoryId = allowance.categoryId;

        if (categoryId === "NEW") {
          const customName = allowance.customCategoryName.trim();

          const category = await transaction.allowanceCategory.upsert({
            where: {
              organizationId_name: {
                organizationId: employee.organizationId,
                name: customName,
              },
            },
            update: {
              isActive: true,
            },
            create: {
              organizationId: employee.organizationId,
              name: customName,
              isTaxableDefault: allowance.isTaxable,
              includedInGratuityDefault: allowance.includedInGratuity,
              isActive: true,
            },
            select: {
              id: true,
            },
          });

          categoryId = category.id;
        } else {
          const category = await transaction.allowanceCategory.findFirst({
            where: {
              id: categoryId,
              organizationId: employee.organizationId,
              isActive: true,
            },
            select: {
              id: true,
            },
          });

          if (!category) {
            throw new Error("INVALID_ALLOWANCE_CATEGORY");
          }
        }

        await transaction.employmentContractAllowance.create({
          data: {
            contractId: created.id,
            categoryId,
            amount: Number(allowance.amount),
            frequency: allowance.frequency as AllowanceFrequency,
            isTaxable: allowance.isTaxable,
            includedInGratuity: allowance.includedInGratuity,
            notes: allowance.notes.trim() || null,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: changeTypeValue === "INITIAL" ? "CREATE" : "AMEND",
          entityType: "EmploymentContract",
          entityId: created.id,
          description: `${changeTypeValue === "INITIAL" ? "Created" : "Added"} employment contract for ${employee.employeeNumber} — ${employee.firstName} ${employee.lastName}.`,
          newValues: {
            employeeId,
            sourceContractId,
            contractNumber,
            contractType: created.contractType,
            changeType: created.changeType,
            status: created.status,
            startDate: created.startDate,
            endDate: created.endDate,
            jobTitle: created.jobTitle,
            baseSalary: created.baseSalary.toString(),
            currency: created.currency,
            gratuityEligible: created.gratuityEligible,
            gratuityRate: created.gratuityRate?.toString() ?? null,
            gratuityTaxRate: created.gratuityTaxRate?.toString() ?? null,
            isCurrent: created.isCurrent,
            vacationLeaveDays,
            sickLeaveDays,
            allowances: (allowances ?? []).map((allowance) => ({
              categoryId: allowance.categoryId,
              customCategoryName: allowance.customCategoryName,
              amount: allowance.amount,
              frequency: allowance.frequency,
              isTaxable: allowance.isTaxable,
              includedInGratuity: allowance.includedInGratuity,
            })),
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return created;
    });

    try {
      const entitlementOverrides: LeaveEntitlementOverride[] = [];

      if (vacationLeaveDays !== null) {
        entitlementOverrides.push({
          leaveTypeCode: "VAC",
          entitlementDays: vacationLeaveDays,
        });
      }

      if (sickLeaveDays !== null) {
        entitlementOverrides.push({
          leaveTypeCode: "SICK",
          entitlementDays: sickLeaveDays,
        });
      }

      await createContractLeaveBalances(
        contract.id,
        actor.actor.userId,
        entitlementOverrides.length > 0 ? { entitlementOverrides } : undefined,
      );
    } catch (balanceError) {
      console.error(
        "Employment contract created but leave balances could not be generated:",
        balanceError,
      );
    }

    revalidatePath("/people");
    revalidatePath(`/people/employees/${employeeId}`);
    revalidatePath(`/people/employees/${employeeId}/contracts`);
    revalidatePath("/people/leave/balances");
    revalidatePath("/leave");

    redirect(`/people/employees/${employeeId}/contracts/${contract.id}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to create employment contract:", error);

    return {
      status: "error",
      message:
        error instanceof Error && error.message === "INVALID_ALLOWANCE_CATEGORY"
          ? "One of the selected allowance categories is invalid."
          : "The employment contract could not be saved.",
    };
  }
}
