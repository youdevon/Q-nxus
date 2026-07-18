"use server";

import { unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { deleteNotificationsForUsers } from "@/src/modules/admin/lib/delete-user-notifications";
import {
  DEFAULT_ADMINISTRATOR_EMAIL,
  mergeProtectedUserIds,
} from "@/src/modules/admin/lib/protected-administrator";
import {
  requireActor,
  type UserCapabilities,
} from "@/src/modules/auth/data/get-user-capabilities";
import { resolveLeaveAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-leave-attachment";
import { resolveCorrespondenceAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-correspondence-attachment";
import { resolveEmployeeFileAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-employee-file-attachment";
import { resolveAchExportAbsolutePath } from "@/src/modules/payroll/services/ach-payment-batch";

export type ClearDemoDataFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const CONFIRMATION_TOKEN = "RESET";

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireSystemAdminActor(): Promise<
  | { ok: true; actor: UserCapabilities }
  | { ok: false; message: string }
> {
  if (process.env.ALLOW_DEMO_DATA_RESET !== "true") {
    return {
      ok: false,
      message:
        "Demo data reset is disabled. Set ALLOW_DEMO_DATA_RESET=true on the server to enable this action.",
    };
  }

  const actorResult = await requireActor();

  if (!actorResult.ok) {
    return {
      ok: false,
      message: actorResult.message,
    };
  }

  if (!actorResult.actor.isSystemAdmin) {
    return {
      ok: false,
      message:
        "Only system administrators can clear demo data. HR and payroll clerks are not permitted.",
    };
  }

  return {
    ok: true,
    actor: actorResult.actor,
  };
}

async function resolveOrganizationId(): Promise<string | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  return organization?.id ?? null;
}

async function findProtectedUserIds(
  organizationId: string,
  actorUserId: string,
): Promise<string[]> {
  const protectedUsers = await prisma.user.findMany({
    where: {
      organizationId,
      OR: [
        { id: actorUserId },
        { email: DEFAULT_ADMINISTRATOR_EMAIL },
        {
          roles: {
            some: {
              status: "ACTIVE",
              role: {
                code: "SYSTEM_ADMINISTRATOR",
                isActive: true,
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  return mergeProtectedUserIds(protectedUsers.map((user) => user.id));
}

async function bestEffortDeleteLeaveFiles(storageKeys: string[]) {
  for (const storageKey of storageKeys) {
    try {
      await unlink(resolveLeaveAttachmentAbsolutePath(storageKey));
    } catch {
      // Best-effort cleanup; DB rows are already gone.
    }
  }
}

async function bestEffortDeleteCorrespondenceFiles(storageKeys: string[]) {
  for (const storageKey of storageKeys) {
    try {
      await unlink(resolveCorrespondenceAttachmentAbsolutePath(storageKey));
    } catch {
      // Best-effort cleanup; DB rows are already gone.
    }
  }
}

async function bestEffortDeleteEmployeeFileKeys(storageKeys: string[]) {
  for (const storageKey of storageKeys) {
    try {
      await unlink(resolveEmployeeFileAttachmentAbsolutePath(storageKey));
    } catch {
      // Best-effort cleanup; DB rows are already gone.
    }
  }
}

async function bestEffortDeleteAchFiles(storageKeys: string[]) {
  for (const storageKey of storageKeys) {
    try {
      await unlink(resolveAchExportAbsolutePath(storageKey));
    } catch {
      // Best-effort cleanup; DB rows are already gone.
    }
  }
}

function revalidateDemoDataPaths() {
  revalidatePath("/administration/settings");
  revalidatePath("/administration/access");
  revalidatePath("/administration/organization");
  revalidatePath("/administration/audit");
  revalidatePath("/administration/numbering-sequences");
  revalidatePath("/people");
  revalidatePath("/people/structure");
  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  revalidatePath("/people/leave");
  revalidatePath("/me/payslip");
  revalidatePath("/me/payslips");
}

/**
 * Clear pay runs (dev / demo reset).
 *
 * Deletes: all pay runs (payslips, line items, payment prep/ACH batches),
 * payroll periods, and resets the PAY_RUN numbering sequence so the next run
 * starts at 1 again.
 *
 * Preserves: employees, payroll profiles/bank setup, statutory configs,
 * allowance categories, and other numbering sequences.
 */
export async function clearPayRuns(
  _previousState: ClearDemoDataFormState,
  formData: FormData,
): Promise<ClearDemoDataFormState> {
  const actorResult = await requireSystemAdminActor();

  if (!actorResult.ok) {
    return {
      status: "error",
      message: actorResult.message,
    };
  }

  if (textValue(formData, "confirmation") !== CONFIRMATION_TOKEN) {
    return {
      status: "error",
      message: `Type ${CONFIRMATION_TOKEN} to confirm this irreversible action.`,
    };
  }

  const organizationId = await resolveOrganizationId();

  if (!organizationId) {
    return {
      status: "error",
      message: "No organization is configured.",
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(
      async (transaction) => {
        const payRunCountBefore = await transaction.payRun.count({
          where: { organizationId },
        });
        const periodCountBefore = await transaction.payrollPeriod.count({
          where: { organizationId },
        });

        // ACH batch details Restrict payment allocations — remove batches first
        // so pay-run cascade can delete payments/allocations cleanly.
        const achBatches = await transaction.achPaymentBatch.findMany({
          where: { organizationId, fileStorageKey: { not: null } },
          select: { fileStorageKey: true },
        });
        const achStorageKeys = achBatches
          .map((item) => item.fileStorageKey)
          .filter((key): key is string => Boolean(key));

        const deletedAchBatches = await transaction.achPaymentBatch.deleteMany({
          where: { organizationId },
        });

        await transaction.payRun.updateMany({
          where: { organizationId },
          data: { sourcePayRunId: null },
        });

        const deletedPayRuns = await transaction.payRun.deleteMany({
          where: { organizationId },
        });
        const deletedPeriods = await transaction.payrollPeriod.deleteMany({
          where: { organizationId },
        });

        const payRunSequence = await transaction.numberingSequence.findFirst({
          where: {
            organizationId,
            sequenceCode: "PAY_RUN",
          },
          select: {
            id: true,
            currentNumber: true,
          },
        });

        let sequencePrevious: string | null = null;
        let sequenceReset = false;

        if (payRunSequence) {
          sequencePrevious = payRunSequence.currentNumber.toString();
          await transaction.numberingSequence.update({
            where: { id: payRunSequence.id },
            data: {
              currentNumber: BigInt(0),
              lastResetAt: new Date(),
              version: { increment: 1 },
            },
          });
          sequenceReset = true;
        }

        await transaction.auditEvent.create({
          data: {
            userId: actorResult.actor.userId,
            organizationId,
            moduleKey: "administration",
            action: "RESET",
            entityType: "DemoData",
            entityId: organizationId,
            description:
              "Cleared pay runs and payroll periods; reset PAY_RUN numbering sequence.",
            oldValues: {
              payRunCount: payRunCountBefore,
              payrollPeriodCount: periodCountBefore,
              payRunSequenceCurrentNumber: sequencePrevious,
            },
            newValues: {
              payRunsRemaining: 0,
              payrollPeriodsRemaining: 0,
              achBatchesDeleted: deletedAchBatches.count,
              payRunsDeleted: deletedPayRuns.count,
              payrollPeriodsDeleted: deletedPeriods.count,
              payRunSequenceReset: sequenceReset,
              payRunSequenceCurrentNumber: sequenceReset ? "0" : null,
            },
            ipAddress,
            userAgent,
            clientHostName,
          },
        });

        return {
          payRunsDeleted: deletedPayRuns.count,
          periodsDeleted: deletedPeriods.count,
          achBatchesDeleted: deletedAchBatches.count,
          sequenceReset,
          achStorageKeys,
        };
      },
      {
        timeout: 120_000,
      },
    );

    await bestEffortDeleteAchFiles(result.achStorageKeys);

    revalidateDemoDataPaths();

    const sequenceMessage = result.sequenceReset
      ? " PAY_RUN numbering sequence reset (next run starts at 1)."
      : " PAY_RUN numbering sequence was not found — configure it under Numbering sequences.";

    return {
      status: "success",
      message: `Cleared ${result.payRunsDeleted} pay run(s), ${result.periodsDeleted} payroll period(s), and ${result.achBatchesDeleted} ACH batch(es).${sequenceMessage}`,
    };
  } catch (error: unknown) {
    console.error("Unable to clear pay runs:", error);
    return {
      status: "error",
      message:
        "Pay runs could not be cleared. Check the server log and try again.",
    };
  }
}

/**
 * Clear employees & users (demo reset).
 *
 * Deletes: employees and dependent HR/payroll/leave data (contracts, salaries,
 * payroll profiles/bank accounts, pay runs/periods/payslips, leave requests/
 * balances/attachments, assignments, appraisals), plus non-protected user
 * accounts.
 *
 * Preserves: the acting system administrator, the default administrator
 * (admin@q-nxus.local), and any other users with an active
 * SYSTEM_ADMINISTRATOR role (including their role grants); organization
 * identity; roles/permissions; leave types; allowance categories; statutory
 * configs; numbering sequences; departments/positions; domain settings.
 *
 * Also removes in-app notifications for cleared user accounts.
 */
export async function clearEmployeesAndUsers(
  _previousState: ClearDemoDataFormState,
  formData: FormData,
): Promise<ClearDemoDataFormState> {
  const actorResult = await requireSystemAdminActor();

  if (!actorResult.ok) {
    return {
      status: "error",
      message: actorResult.message,
    };
  }

  if (textValue(formData, "confirmation") !== CONFIRMATION_TOKEN) {
    return {
      status: "error",
      message: `Type ${CONFIRMATION_TOKEN} to confirm this irreversible action.`,
    };
  }

  const organizationId = await resolveOrganizationId();

  if (!organizationId) {
    return {
      status: "error",
      message: "No organization is configured.",
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const protectedUserIds = await findProtectedUserIds(
      organizationId,
      actorResult.actor.userId,
    );

    if (protectedUserIds.length === 0) {
      return {
        status: "error",
        message:
          "Refusing to clear users: no protected system administrator account was found.",
      };
    }

    const result = await prisma.$transaction(
      async (transaction) => {
        const employees = await transaction.employee.findMany({
          where: { organizationId },
          select: { id: true },
        });
        const employeeIds = employees.map((employee) => employee.id);

        const attachments = await transaction.leaveAttachment.findMany({
          where: {
            leaveRequest: {
              organizationId,
            },
          },
          select: {
            storageKey: true,
          },
        });

        const correspondenceAttachments =
          await transaction.employeeCorrespondenceAttachment.findMany({
            where: {
              correspondence: {
                organizationId,
              },
            },
            select: {
              storageKey: true,
            },
          });

        const [credentialFiles, trainingFiles, qualificationFiles, checklistFiles] =
          await Promise.all([
            transaction.employeeCredential.findMany({
              where: { organizationId, storageKey: { not: null } },
              select: { storageKey: true },
            }),
            transaction.employeeTrainingRecord.findMany({
              where: { organizationId, storageKey: { not: null } },
              select: { storageKey: true },
            }),
            transaction.employeeQualificationDocument.findMany({
              where: { organizationId, storageKey: { not: null } },
              select: { storageKey: true },
            }),
            transaction.employeeFileChecklistItem.findMany({
              where: { organizationId, storageKey: { not: null } },
              select: { storageKey: true },
            }),
          ]);

        const employeeFileStorageKeys = [
          ...credentialFiles,
          ...trainingFiles,
          ...qualificationFiles,
          ...checklistFiles,
        ]
          .map((item) => item.storageKey)
          .filter((key): key is string => Boolean(key));

        const achBatches = await transaction.achPaymentBatch.findMany({
          where: { organizationId, fileStorageKey: { not: null } },
          select: { fileStorageKey: true },
        });
        const achStorageKeys = achBatches
          .map((item) => item.fileStorageKey)
          .filter((key): key is string => Boolean(key));

        const userCountBefore = await transaction.user.count({
          where: { organizationId },
        });

        await transaction.payRun.updateMany({
          where: { organizationId },
          data: { sourcePayRunId: null },
        });
        const deletedPayRuns = await transaction.payRun.deleteMany({
          where: { organizationId },
        });
        const deletedPeriods = await transaction.payrollPeriod.deleteMany({
          where: { organizationId },
        });

        if (employeeIds.length > 0) {
          await transaction.payrollProfile.deleteMany({
            where: { employeeId: { in: employeeIds } },
          });

          // Leave requests reference contracts with Restrict — delete first.
          await transaction.leaveRequest.deleteMany({
            where: { organizationId },
          });

          await transaction.leaveBalanceTransaction.deleteMany({
            where: { employeeId: { in: employeeIds } },
          });
          await transaction.employeeLeaveBalance.deleteMany({
            where: { employeeId: { in: employeeIds } },
          });

          // Appraisals reference assignments with Restrict — delete first.
          await transaction.performanceAppraisal.deleteMany({
            where: { employeeId: { in: employeeIds } },
          });

          await transaction.employeeAssignment.deleteMany({
            where: { employeeId: { in: employeeIds } },
          });

          await transaction.employmentContract.updateMany({
            where: { employeeId: { in: employeeIds } },
            data: { sourceContractId: null },
          });
          await transaction.employmentContract.deleteMany({
            where: { employeeId: { in: employeeIds } },
          });

          await transaction.user.updateMany({
            where: {
              id: { in: protectedUserIds },
              employeeId: { not: null },
            },
            data: { employeeId: null },
          });

          await transaction.employee.deleteMany({
            where: { organizationId },
          });
        } else {
          await transaction.leaveRequest.deleteMany({
            where: { organizationId },
          });
        }

        const usersToDelete = await transaction.user.findMany({
          where: {
            organizationId,
            id: { notIn: protectedUserIds },
          },
          select: {
            id: true,
          },
        });
        const userIdsToDelete = usersToDelete.map((user) => user.id);

        const deletedNotifications = await deleteNotificationsForUsers(
          transaction,
          userIdsToDelete,
        );

        const deletedUsers = await transaction.user.deleteMany({
          where: {
            id: { in: userIdsToDelete },
          },
        });

        await transaction.auditEvent.create({
          data: {
            userId: actorResult.actor.userId,
            moduleKey: "administration",
            action: "RESET",
            entityType: "DemoData",
            entityId: organizationId,
            description:
              "Cleared demo employees and non-administrator user accounts.",
            oldValues: {
              employeeCount: employeeIds.length,
              userCount: userCountBefore,
              payRunCount: deletedPayRuns.count,
              payrollPeriodCount: deletedPeriods.count,
            },
            newValues: {
              employeesRemaining: 0,
              usersDeleted: deletedUsers.count,
              protectedUsersKept: protectedUserIds.length,
              notificationRecipientsDeleted:
                deletedNotifications.recipientsDeleted,
              orphanedNotificationsDeleted:
                deletedNotifications.orphanedNotificationsDeleted,
              leaveAttachmentFilesQueued: attachments.length,
              correspondenceAttachmentFilesQueued:
                correspondenceAttachments.length,
            },
            ipAddress,
            userAgent,
            clientHostName,
          },
        });

        return {
          employeeCount: employeeIds.length,
          usersDeleted: deletedUsers.count,
          protectedUsersKept: protectedUserIds.length,
          storageKeys: attachments.map((item) => item.storageKey),
          correspondenceStorageKeys: correspondenceAttachments.map(
            (item) => item.storageKey,
          ),
          employeeFileStorageKeys,
          achStorageKeys,
        };
      },
      {
        timeout: 120_000,
      },
    );

    await bestEffortDeleteLeaveFiles(result.storageKeys);
    await bestEffortDeleteCorrespondenceFiles(
      result.correspondenceStorageKeys,
    );
    await bestEffortDeleteEmployeeFileKeys(result.employeeFileStorageKeys);
    await bestEffortDeleteAchFiles(result.achStorageKeys);

    revalidateDemoDataPaths();

    return {
      status: "success",
      message: `Cleared ${result.employeeCount} employee(s) and ${result.usersDeleted} user account(s). Notifications for removed users were deleted. Kept ${result.protectedUsersKept} system administrator account(s), including the default administrator. Departments and org configuration were preserved.`,
    };
  } catch (error: unknown) {
    console.error("Unable to clear employees and users:", error);
    return {
      status: "error",
      message:
        "Employees and users could not be cleared. Check the server log and try again.",
    };
  }
}

/**
 * Clear departments and positions (org structure).
 *
 * Guard: fails if any employees still exist (they may reference departments/
 * positions). Run Clear employees & users first.
 *
 * Deletes: departments, positions (reporting lines), and position job
 * descriptions/criteria.
 *
 * Preserves: organization identity, roles/permissions, leave types, allowance
 * categories, statutory configs, numbering sequences, domain settings, users.
 */
export async function clearDepartments(
  _previousState: ClearDemoDataFormState,
  formData: FormData,
): Promise<ClearDemoDataFormState> {
  const actorResult = await requireSystemAdminActor();

  if (!actorResult.ok) {
    return {
      status: "error",
      message: actorResult.message,
    };
  }

  if (textValue(formData, "confirmation") !== CONFIRMATION_TOKEN) {
    return {
      status: "error",
      message: `Type ${CONFIRMATION_TOKEN} to confirm this irreversible action.`,
    };
  }

  const organizationId = await resolveOrganizationId();

  if (!organizationId) {
    return {
      status: "error",
      message: "No organization is configured.",
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(
      async (transaction) => {
        const employeeCount = await transaction.employee.count({
          where: { organizationId },
        });

        if (employeeCount > 0) {
          return {
            outcome: "employees-remain" as const,
            employeeCount,
          };
        }

        const assignmentCount = await transaction.employeeAssignment.count({
          where: {
            department: {
              organizationId,
            },
          },
        });

        if (assignmentCount > 0) {
          return {
            outcome: "assignments-remain" as const,
            assignmentCount,
          };
        }

        const departments = await transaction.department.findMany({
          where: { organizationId },
          select: {
            id: true,
            positions: {
              select: { id: true },
            },
          },
        });

        const positionIds = departments.flatMap((department) =>
          department.positions.map((position) => position.id),
        );

        if (positionIds.length > 0) {
          // Appraisals / assignments should already be gone; clear job
          // descriptions that would Restrict position deletion.
          await transaction.positionJobDescription.deleteMany({
            where: { positionId: { in: positionIds } },
          });

          await transaction.position.updateMany({
            where: { id: { in: positionIds } },
            data: { reportsToPositionId: null },
          });

          await transaction.position.deleteMany({
            where: { id: { in: positionIds } },
          });
        }

        const deletedDepartments = await transaction.department.deleteMany({
          where: { organizationId },
        });

        await transaction.auditEvent.create({
          data: {
            userId: actorResult.actor.userId,
            moduleKey: "administration",
            action: "RESET",
            entityType: "DemoData",
            entityId: organizationId,
            description:
              "Cleared demo departments, positions, and job descriptions.",
            oldValues: {
              departmentCount: departments.length,
              positionCount: positionIds.length,
            },
            newValues: {
              departmentsRemaining: 0,
              positionsRemaining: 0,
            },
            ipAddress,
            userAgent,
            clientHostName,
          },
        });

        return {
          outcome: "ok" as const,
          departmentCount: deletedDepartments.count,
          positionCount: positionIds.length,
        };
      },
      {
        timeout: 60_000,
      },
    );

    if (result.outcome === "employees-remain") {
      return {
        status: "error",
        message: `${result.employeeCount} employee(s) still reference the organization structure. Run “Clear employees & users” first, then clear departments.`,
      };
    }

    if (result.outcome === "assignments-remain") {
      return {
        status: "error",
        message: `${result.assignmentCount} assignment(s) still reference departments. Run “Clear employees & users” first, then clear departments.`,
      };
    }

    revalidateDemoDataPaths();

    return {
      status: "success",
      message: `Cleared ${result.departmentCount} department(s) and ${result.positionCount} position(s). Organization identity and configuration were preserved.`,
    };
  } catch (error: unknown) {
    console.error("Unable to clear departments:", error);
    return {
      status: "error",
      message:
        "Departments could not be cleared. Check the server log and try again.",
    };
  }
}
