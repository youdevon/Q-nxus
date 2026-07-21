"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import {
  AllowanceFrequency,
  ContractChangeType,
  EmploymentContractType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { earliestRenewalStartDate } from "@/src/lib/contract-dates";
import { formatSequenceReference } from "@/src/modules/admin/lib/numbering-sequence";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";
import { isNonEmployeePayee } from "@/src/modules/hr/lib/workforce-category";
import { activateEmploymentContractInTransaction } from "@/src/modules/hr/services/activate-employment-contract";
import { syncAssignedEmployeeAccessRoles } from "@/src/modules/hr/services/assign-employee-to-position";
import {
  CONTRACT_WORKFLOW_SETTING_CODE,
  parseContractWorkflowSettings,
} from "@/src/modules/hr/lib/contract-workflow-settings";

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

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === 1;
}

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

    return parsed.map((entry) => {
      const allowance = entry as Partial<SubmittedAllowance>;

      return {
        categoryId:
          typeof allowance.categoryId === "string" ? allowance.categoryId : "",
        customCategoryName:
          typeof allowance.customCategoryName === "string"
            ? allowance.customCategoryName
            : "",
        amount: typeof allowance.amount === "string" ? allowance.amount : "",
        frequency:
          typeof allowance.frequency === "string" ? allowance.frequency : "",
        isTaxable: asBoolean(allowance.isTaxable),
        includedInGratuity: asBoolean(allowance.includedInGratuity),
        notes: typeof allowance.notes === "string" ? allowance.notes : "",
      };
    });
  } catch {
    return null;
  }
}

type SaveIntent = "draft" | "submit" | "activate";

function parseSaveIntent(raw: string): SaveIntent {
  if (raw === "submit" || raw === "activate") {
    return raw;
  }

  return "draft";
}

async function allocateContractNumber(
  organizationId: string,
  transaction: Prisma.TransactionClient,
): Promise<string> {
  const sequence = await transaction.numberingSequence.findFirst({
    where: {
      organizationId,
      sequenceCode: "CONTRACT",
      isActive: true,
    },
  });

  if (!sequence) {
    throw new Error("CONTRACT_SEQUENCE_MISSING");
  }

  const updatedSequence = await transaction.numberingSequence.update({
    where: { id: sequence.id },
    data: {
      currentNumber: { increment: 1 },
      version: { increment: 1 },
    },
  });

  return formatSequenceReference({
    value: updatedSequence.currentNumber,
    minimumLength: updatedSequence.minimumLength,
    prefix: updatedSequence.prefix,
    suffix: updatedSequence.suffix,
  });
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
  const positionId = nullableText(formData, "positionId");
  const employeeUpdatedAt = nullableText(formData, "employeeUpdatedAt");
  let contractNumber = nullableText(formData, "contractNumber");
  const contractTypeValue = textValue(formData, "contractType");
  const changeTypeValue = textValue(formData, "changeType");
  const startDateMode = textValue(formData, "startDateMode");
  const useHireDateAsStart =
    startDateMode === "hire" && sourceContractId === null;
  const submittedStartDate = parseDate(textValue(formData, "startDate"));
  let startDate = useHireDateAsStart ? null : submittedStartDate;
  const endDate = parseDate(textValue(formData, "endDate"));
  const signedDate = parseDate(textValue(formData, "signedDate"));
  const baseSalary = parseDecimal(textValue(formData, "baseSalary"));
  const currency = textValue(formData, "currency").toUpperCase() || "TTD";
  const gratuityEligible = formData.get("gratuityEligible") === "on";
  const gratuityRate = parseDecimal(textValue(formData, "gratuityRate"));
  const gratuityTaxRate = parseDecimal(textValue(formData, "gratuityTaxRate"));
  const documentReference = nullableText(formData, "documentReference");
  const notes = nullableText(formData, "notes");
  const vacationLeaveDaysRaw = textValue(formData, "vacationLeaveDays");
  const sickLeaveDaysRaw = textValue(formData, "sickLeaveDays");
  const fte = parseDecimal(textValue(formData, "fte"));
  const standardHoursPerWeek = parseDecimal(
    textValue(formData, "standardHoursPerWeek"),
  );
  const probationEndDate = parseDate(textValue(formData, "probationEndDate"));
  const noticePeriodDaysRaw = textValue(formData, "noticePeriodDays");
  const noticePeriodDays =
    noticePeriodDaysRaw.length > 0
      ? Number.parseInt(noticePeriodDaysRaw, 10)
      : null;
  const saveIntent = parseSaveIntent(textValue(formData, "saveIntent"));

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

  if (!useHireDateAsStart && !startDate) {
    fieldErrors.startDate = "Enter a valid start date.";
  }

  if (!endDate) {
    fieldErrors.endDate =
      "Enter a contract end date. Leave balances and gratuity estimates require an end date.";
  }

  if (endDate && startDate && endDate < startDate) {
    fieldErrors.endDate = "The end date cannot be before the start date.";
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

  if (
    noticePeriodDaysRaw.length > 0 &&
    (noticePeriodDays === null ||
      !Number.isFinite(noticePeriodDays) ||
      noticePeriodDays < 0)
  ) {
    fieldErrors.noticePeriodDays = "Enter a valid notice period in days.";
  }

  if (fte !== null && (fte <= 0 || fte > 2)) {
    fieldErrors.fte = "Enter an FTE between 0 and 2.";
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
      workforceCategory: true,
      organizationId: true,
      departmentId: true,
      positionId: true,
      updatedAt: true,
      position: {
        select: {
          id: true,
          title: true,
          departmentId: true,
        },
      },
      assignments: {
        where: {
          isCurrent: true,
        },
        orderBy: {
          startDate: "desc",
        },
        take: 1,
        select: {
          id: true,
          startDate: true,
          position: {
            select: {
              title: true,
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return {
      status: "error",
      message: "The employee record no longer exists.",
    };
  }

  if (isNonEmployeePayee(employee.workforceCategory) && !endDate) {
    return {
      status: "error",
      message: "Review the contract information.",
      fieldErrors: {
        endDate:
          "Agents, board members, and contractors require an engagement end date.",
      },
    };
  }

  if (useHireDateAsStart) {
    startDate = employee.hireDate;

    if (
      submittedStartDate &&
      submittedStartDate.getTime() !== employee.hireDate.getTime()
    ) {
      return {
        status: "error",
        message: "Review the contract information.",
        fieldErrors: {
          startDate:
            "When using the hire date, the start date must match the employee’s hire date.",
        },
      };
    }
  }

  if (!startDate) {
    return {
      status: "error",
      message: "Review the contract information.",
      fieldErrors: {
        startDate: "Enter a valid start date.",
      },
    };
  }

  if (endDate && endDate < startDate) {
    return {
      status: "error",
      message: "Review the contract information.",
      fieldErrors: {
        endDate: "The end date cannot be before the start date.",
      },
    };
  }

  if (startDate < employee.hireDate) {
    return {
      status: "error",
      message: "The contract cannot begin before the employee’s hire date.",
    };
  }

  let sourceContractJobTitle: string | null = null;

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
        jobTitle: true,
      },
    });

    if (!sourceContract) {
      return {
        status: "error",
        message: "The source contract is invalid.",
      };
    }

    sourceContractJobTitle = sourceContract.jobTitle;

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

  let selectedPosition: {
    id: string;
    title: string;
    departmentId: string;
  } | null = null;

  if (positionId) {
    selectedPosition = await prisma.position.findFirst({
      where: {
        id: positionId,
        isActive: true,
        department: {
          organizationId: employee.organizationId,
          isActive: true,
        },
      },
      select: {
        id: true,
        title: true,
        departmentId: true,
      },
    });

    if (!selectedPosition) {
      return {
        status: "error",
        message: "Review the contract information.",
        fieldErrors: {
          positionId: "Select a valid active position.",
        },
      };
    }
  }

  const jobTitle =
    selectedPosition?.title ??
    resolveEmployeePositionTitle({
      assignmentPositionTitle: employee.assignments[0]?.position?.title,
      positionTitle: employee.position?.title,
      contractJobTitle: sourceContractJobTitle,
    });

  if (!jobTitle || jobTitle.length < 2) {
    return {
      status: "error",
      message: "Review the contract information.",
      fieldErrors: {
        positionId:
          "Select a position for this employee before creating a contract.",
        jobTitle:
          "Assign a position to this employee before creating a contract.",
      },
    };
  }

  const workflowSetting = await prisma.domainSetting.findFirst({
    where: {
      organizationId: employee.organizationId,
      settingCode: CONTRACT_WORKFLOW_SETTING_CODE,
    },
    select: { value: true },
  });
  const workflow = parseContractWorkflowSettings(workflowSetting?.value);

  try {
    const contract = await prisma.$transaction(
      async (transaction) => {
        if (!contractNumber) {
          contractNumber = await allocateContractNumber(
            employee.organizationId,
            transaction,
          );
        }

        const created = await transaction.employmentContract.create({
          data: {
            employeeId,
            sourceContractId,
            contractNumber,
            contractType: contractTypeValue as EmploymentContractType,
            changeType: changeTypeValue as ContractChangeType,
            status: "DRAFT",
            startDate: startDate!,
            endDate: endDate!,
            jobTitle,
            baseSalary: baseSalary!,
            currency,
            gratuityEligible,
            gratuityRate: gratuityEligible ? gratuityRate : null,
            gratuityTaxRate: gratuityEligible ? gratuityTaxRate : null,
            isCurrent: false,
            signedDate,
            documentReference,
            notes,
            positionId: selectedPosition?.id ?? employee.positionId,
            departmentId:
              selectedPosition?.departmentId ?? employee.departmentId,
            fte,
            standardHoursPerWeek,
            probationEndDate,
            noticePeriodDays:
              noticePeriodDays !== null && Number.isFinite(noticePeriodDays)
                ? noticePeriodDays
                : null,
            vacationLeaveDaysOverride: vacationLeaveDays,
            sickLeaveDaysOverride: sickLeaveDays,
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

        let finalStatus = created.status;

        if (saveIntent === "submit" || saveIntent === "activate") {
          if (
            workflow.mode === "FINAL_APPROVER_POSITION" &&
            workflow.finalApproverPositionId &&
            saveIntent === "submit"
          ) {
            await transaction.employmentContractApprovalStep.create({
              data: {
                contractId: created.id,
                stepNumber: 1,
                approverPositionId: workflow.finalApproverPositionId,
                status: "PENDING",
              },
            });

            await transaction.employmentContract.update({
              where: { id: created.id },
              data: { status: "PENDING_APPROVAL" },
            });
            finalStatus = "PENDING_APPROVAL";
          } else if (saveIntent === "activate") {
            const activation = await activateEmploymentContractInTransaction(
              {
                contractId: created.id,
                employeeId,
                organizationId: employee.organizationId,
                actorUserId: actor.actor.userId,
                audit: metadata,
                employeeUpdatedAt,
                applyAssignment: true,
              },
              transaction,
            );
            finalStatus = "ACTIVE";

            await transaction.auditEvent.create({
              data: {
                userId: actor.actor.userId,
                moduleKey: "hr",
                action: changeTypeValue === "INITIAL" ? "CREATE" : "AMEND",
                entityType: "EmploymentContract",
                entityId: created.id,
                description: `${changeTypeValue === "INITIAL" ? "Created" : "Added"} and activated employment contract for ${employee.employeeNumber} — ${employee.firstName} ${employee.lastName}.`,
                newValues: {
                  employeeId,
                  sourceContractId,
                  contractNumber,
                  contractType: created.contractType,
                  changeType: created.changeType,
                  status: finalStatus,
                  saveIntent,
                  needsAccessRoleSync: activation.needsAccessRoleSync,
                },
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                clientHostName: metadata.clientHostName,
              },
            });

            return { ...created, status: finalStatus, _needsSync: activation.needsAccessRoleSync };
          } else {
            // Auto-approve path → APPROVED until first signature
            await transaction.employmentContract.update({
              where: { id: created.id },
              data: {
                status: "APPROVED",
                approvedAt: new Date(),
                approvedByUserId: actor.actor.userId,
              },
            });
            finalStatus = "APPROVED";
          }
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
              status: finalStatus,
              saveIntent,
              startDate: created.startDate,
              endDate: created.endDate,
              jobTitle: created.jobTitle,
              baseSalary: created.baseSalary.toString(),
              currency: created.currency,
              isCurrent: false,
              vacationLeaveDays,
              sickLeaveDays,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });

        return { ...created, status: finalStatus, _needsSync: false };
      },
      {
        timeout: 20_000,
      },
    );

    if (contract._needsSync) {
      try {
        await syncAssignedEmployeeAccessRoles(employeeId);
      } catch (syncError) {
        console.error(
          "Contract activated but employee access-role sync failed:",
          syncError,
        );
      }
    }

    if (contract.status === "ACTIVE") {
      try {
        const { syncPayrollReadinessAfterContractActivate } = await import(
          "@/src/modules/hr/services/sync-payroll-readiness-after-activate"
        );
        await syncPayrollReadinessAfterContractActivate({
          employeeId,
          organizationId: employee.organizationId,
          actorUserId: actor.actor.userId,
          contractId: contract.id,
        });
      } catch (payrollError) {
        console.error(
          "Payroll readiness sync failed after create-activate:",
          payrollError,
        );
      }

      try {
        const { notifyContractActivated } = await import(
          "@/src/modules/hr/services/notify-contract-lifecycle"
        );
        const linked = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            user: { select: { id: true } },
          },
        });
        if (linked) {
          await notifyContractActivated({
            contractId: contract.id,
            employeeId,
            employee: {
              employeeNumber: linked.employeeNumber,
              firstName: linked.firstName,
              lastName: linked.lastName,
              userId: linked.user?.id ?? null,
            },
            actorUserId: actor.actor.userId,
          });
        }
      } catch (notifyError) {
        console.error(
          "Employee activate notification failed after create-activate:",
          notifyError,
        );
      }
    }

    revalidatePath("/people");
    revalidatePath(`/people/employees/${employeeId}`);
    revalidatePath(`/people/employees/${employeeId}/contracts`);
    revalidatePath(`/people/employees/${employeeId}/assignments`);
    revalidatePath(`/payroll/employees/${employeeId}`);
    revalidatePath("/people/structure");
    revalidatePath("/people/leave/balances");
    revalidatePath("/people/leave");
    revalidatePath("/contracts");

    if (positionId) {
      revalidatePath(`/people/structure/positions/${positionId}`);
    }

    redirect(`/people/employees/${employeeId}/contracts/${contract.id}`);
  } catch (error: unknown) {
    unstable_rethrow(error);

    console.error("Unable to create employment contract:", error);

    if (error instanceof Error && error.message === "CONTRACT_SEQUENCE_MISSING") {
      return {
        status: "error",
        message:
          "The CONTRACT numbering sequence is not configured for this organization.",
      };
    }

    return {
      status: "error",
      message:
        error instanceof Error && error.message === "INVALID_ALLOWANCE_CATEGORY"
          ? "One of the selected allowance categories is invalid."
          : "The employment contract could not be saved.",
    };
  }
}
