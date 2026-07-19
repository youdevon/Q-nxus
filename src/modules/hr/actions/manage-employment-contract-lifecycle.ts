"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import {
  resolveStoredFileAbsolutePath,
  storeUploadedFile,
} from "@/src/lib/stored-file";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getSessionContext } from "@/src/modules/auth/data/get-session-context";
import {
  bothSignaturesComplete,
  canActivateContract,
  canApproveContract,
  canSignContract,
  canSubmitContract,
} from "@/src/modules/hr/lib/contract-lifecycle";
import { createStoredFileRecord } from "@/src/modules/hr/lib/create-stored-file-record";
import {
  CONTRACT_WORKFLOW_SETTING_CODE,
  parseContractWorkflowSettings,
} from "@/src/modules/hr/lib/contract-workflow-settings";
import { activateEmploymentContractInTransaction } from "@/src/modules/hr/services/activate-employment-contract";
import { syncAssignedEmployeeAccessRoles } from "@/src/modules/hr/services/assign-employee-to-position";

export type ContractLifecycleState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateContractPaths(employeeId: string, contractId: string) {
  revalidatePath("/people");
  revalidatePath(`/people/employees/${employeeId}`);
  revalidatePath(`/people/employees/${employeeId}/contracts`);
  revalidatePath(`/people/employees/${employeeId}/contracts/${contractId}`);
  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/contracts");
  revalidatePath("/me");
  revalidatePath("/me/contracts");
  revalidatePath("/people/leave/balances");
}

async function loadContractForLifecycle(contractId: string) {
  return prisma.employmentContract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      employeeId: true,
      status: true,
      isCurrent: true,
      employeeSignedAt: true,
      orgSignedAt: true,
      approvedAt: true,
      employee: {
        select: {
          id: true,
          organizationId: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          updatedAt: true,
          user: { select: { id: true } },
        },
      },
      approvalSteps: {
        orderBy: { stepNumber: "asc" },
        select: {
          id: true,
          stepNumber: true,
          status: true,
          approverUserId: true,
          approverPositionId: true,
        },
      },
    },
  });
}

export async function submitEmploymentContract(
  _previousState: ContractLifecycleState,
  formData: FormData,
): Promise<ContractLifecycleState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const contractId = textValue(formData, "contractId");
  const contract = await loadContractForLifecycle(contractId);

  if (!contract || !canSubmitContract(contract.status)) {
    return {
      status: "error",
      message: "Only draft contracts can be submitted for approval.",
    };
  }

  const workflowSetting = await prisma.domainSetting.findFirst({
    where: {
      organizationId: contract.employee.organizationId,
      settingCode: CONTRACT_WORKFLOW_SETTING_CODE,
    },
    select: { value: true },
  });
  const workflow = parseContractWorkflowSettings(workflowSetting?.value);
  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      if (
        workflow.mode === "FINAL_APPROVER_POSITION" &&
        workflow.finalApproverPositionId
      ) {
        await transaction.employmentContractApprovalStep.create({
          data: {
            contractId,
            stepNumber: 1,
            approverPositionId: workflow.finalApproverPositionId,
            status: "PENDING",
          },
        });

        await transaction.employmentContract.update({
          where: { id: contractId },
          data: { status: "PENDING_APPROVAL" },
        });
      } else {
        await transaction.employmentContract.update({
          where: { id: contractId },
          data: {
            status: "AWAITING_SIGNATURE",
            approvedAt: new Date(),
            approvedByUserId: actor.actor.userId,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "SUBMIT",
          entityType: "EmploymentContract",
          entityId: contractId,
          description: `Submitted employment contract for ${contract.employee.employeeNumber}.`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    revalidateContractPaths(contract.employeeId, contractId);
    return { status: "success", message: "Contract submitted." };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { status: "error", message: "Unable to submit the contract." };
  }
}

export async function decideEmploymentContract(
  _previousState: ContractLifecycleState,
  formData: FormData,
): Promise<ContractLifecycleState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const contractId = textValue(formData, "contractId");
  const decision = textValue(formData, "decision");
  const comment = textValue(formData, "comment") || null;
  const contract = await loadContractForLifecycle(contractId);

  if (!contract || !canApproveContract(contract.status)) {
    return {
      status: "error",
      message: "This contract is not awaiting approval.",
    };
  }

  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { status: "error", message: "Select approve or reject." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const pendingStep = contract.approvalSteps.find((s) => s.status === "PENDING");

  try {
    await prisma.$transaction(async (transaction) => {
      if (pendingStep) {
        await transaction.employmentContractApprovalStep.update({
          where: { id: pendingStep.id },
          data: {
            status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
            approverUserId: actor.actor.userId,
            decidedAt: new Date(),
            decisionComment: comment,
          },
        });
      }

      if (decision === "REJECT") {
        await transaction.employmentContract.update({
          where: { id: contractId },
          data: { status: "DRAFT" },
        });
      } else {
        await transaction.employmentContract.update({
          where: { id: contractId },
          data: {
            status: "AWAITING_SIGNATURE",
            approvedAt: new Date(),
            approvedByUserId: actor.actor.userId,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: decision === "APPROVE" ? "APPROVE" : "REJECT",
          entityType: "EmploymentContract",
          entityId: contractId,
          description: `${decision === "APPROVE" ? "Approved" : "Rejected"} employment contract for ${contract.employee.employeeNumber}.`,
          newValues: { decision, comment },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    revalidateContractPaths(contract.employeeId, contractId);
    return {
      status: "success",
      message:
        decision === "APPROVE" ? "Contract approved." : "Contract returned to draft.",
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { status: "error", message: "Unable to record the decision." };
  }
}

export async function signEmploymentContract(
  _previousState: ContractLifecycleState,
  formData: FormData,
): Promise<ContractLifecycleState> {
  const party = textValue(formData, "party"); // employee | org
  const contractId = textValue(formData, "contractId");
  const session = await getSessionContext();

  if (!session.user?.isActive) {
    return { status: "error", message: "You must be signed in." };
  }

  const contract = await loadContractForLifecycle(contractId);

  if (!contract || !canSignContract(contract.status)) {
    return {
      status: "error",
      message: "This contract is not awaiting signature.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  if (party === "employee") {
    const isSelf =
      contract.employee.user?.id === session.user.id ||
      session.user.employeeId === contract.employeeId;

    if (!isSelf) {
      const actor = await requireActor("contracts.manage", "people.manage");
      if (!actor.ok) {
        return {
          status: "error",
          message: "Only the employee (or HR) can record employee acceptance.",
        };
      }
    }

    if (contract.employeeSignedAt) {
      return { status: "error", message: "Employee has already accepted." };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.employmentContract.update({
        where: { id: contractId },
        data: {
          employeeSignedAt: new Date(),
          status: "AWAITING_SIGNATURE",
          signedDate: new Date(),
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: session.user!.id,
          moduleKey: "hr",
          action: "SIGN",
          entityType: "EmploymentContract",
          entityId: contractId,
          description: `Employee accepted employment contract for ${contract.employee.employeeNumber}.`,
          newValues: { party: "employee" },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } else if (party === "org") {
    const actor = await requireActor("contracts.manage", "people.manage");
    if (!actor.ok) {
      return { status: "error", message: actor.message };
    }

    if (contract.orgSignedAt) {
      return {
        status: "error",
        message: "Organization has already signed.",
      };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.employmentContract.update({
        where: { id: contractId },
        data: {
          orgSignedAt: new Date(),
          status: "AWAITING_SIGNATURE",
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "SIGN",
          entityType: "EmploymentContract",
          entityId: contractId,
          description: `Organization signed employment contract for ${contract.employee.employeeNumber}.`,
          newValues: { party: "org" },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } else {
    return { status: "error", message: "Select employee or organization." };
  }

  revalidateContractPaths(contract.employeeId, contractId);
  return { status: "success", message: "Signature recorded." };
}

export async function activateEmploymentContract(
  _previousState: ContractLifecycleState,
  formData: FormData,
): Promise<ContractLifecycleState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const contractId = textValue(formData, "contractId");
  const contract = await loadContractForLifecycle(contractId);

  if (!contract || !canActivateContract(contract.status)) {
    return {
      status: "error",
      message: "This contract cannot be activated in its current status.",
    };
  }

  const workflowSetting = await prisma.domainSetting.findFirst({
    where: {
      organizationId: contract.employee.organizationId,
      settingCode: CONTRACT_WORKFLOW_SETTING_CODE,
    },
    select: { value: true },
  });
  const workflow = parseContractWorkflowSettings(workflowSetting?.value);

  if (
    contract.status !== "DRAFT" &&
    !bothSignaturesComplete({
      employeeSignedAt: contract.employeeSignedAt,
      orgSignedAt: contract.orgSignedAt,
      requireDualSignature: workflow.requireDualSignature,
    })
  ) {
    return {
      status: "error",
      message: workflow.requireDualSignature
        ? "Both employee and organization must accept before activation."
        : "A signature is required before activation.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const result = await prisma.$transaction(
      async (transaction) =>
        activateEmploymentContractInTransaction(
          {
            contractId,
            employeeId: contract.employeeId,
            organizationId: contract.employee.organizationId,
            actorUserId: actor.actor.userId,
            audit: metadata,
            employeeUpdatedAt: contract.employee.updatedAt.toISOString(),
            applyAssignment: true,
          },
          transaction,
        ),
      { timeout: 20_000 },
    );

    if (result.needsAccessRoleSync) {
      try {
        await syncAssignedEmployeeAccessRoles(contract.employeeId);
      } catch (syncError) {
        console.error("Access-role sync failed after activate:", syncError);
      }
    }

    revalidateContractPaths(contract.employeeId, contractId);
    return { status: "success", message: "Contract activated." };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { status: "error", message: "Unable to activate the contract." };
  }
}

export async function uploadEmploymentContractDocument(
  _previousState: ContractLifecycleState,
  formData: FormData,
): Promise<ContractLifecycleState> {
  const actor = await requireActor("contracts.manage", "people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const contractId = textValue(formData, "contractId");
  const file = formData.get("document");

  if (!(file instanceof File) || file.size <= 0) {
    return { status: "error", message: "Choose a PDF or document to upload." };
  }

  const contract = await prisma.employmentContract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      employeeId: true,
      documentStorageKey: true,
      employee: {
        select: {
          organizationId: true,
          employeeNumber: true,
          fileFrozenAt: true,
        },
      },
    },
  });

  if (!contract) {
    return { status: "error", message: "Contract not found." };
  }

  if (contract.employee.fileFrozenAt) {
    return {
      status: "error",
      message: "This employee file is frozen for offboarding.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const storageKey = `employee-file/${contract.employeeId}/contracts/${contractId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)}`;

  try {
    const stored = await storeUploadedFile({
      storageKey,
      file,
      resolveAbsolutePath: (key) =>
        resolveStoredFileAbsolutePath(key, "employee-file"),
    });

    const storedFileId = await createStoredFileRecord({
      organizationId: contract.employee.organizationId,
      meta: stored,
      uploadedByUserId: actor.actor.userId,
    });

    await prisma.employmentContract.update({
      where: { id: contractId },
      data: {
        documentStorageKey: stored.storageKey,
        documentFileName: stored.fileName,
        documentMimeType: stored.mimeType,
        documentSize: stored.fileSize,
        storedFileId,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPLOAD",
        entityType: "EmploymentContract",
        entityId: contractId,
        description: `Uploaded contract document for ${contract.employee.employeeNumber}.`,
        newValues: {
          fileName: stored.fileName,
          storageKey: stored.storageKey,
          storedFileId,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidateContractPaths(contract.employeeId, contractId);
    return { status: "success", message: "Document uploaded." };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to upload the contract document.",
    };
  }
}
