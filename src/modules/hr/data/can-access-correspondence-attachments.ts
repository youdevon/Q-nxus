import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { resolveEmployeeSupervisor } from "@/src/modules/hr/data/resolve-employee-supervisor";
import {
  isEmployeeVisibleCorrespondence,
  isManagerVisibleCorrespondence,
  isRestrictedCategory,
} from "@/src/modules/hr/lib/correspondence-visibility";

export type CorrespondenceAttachmentAccess = {
  allowed: boolean;
  correspondence?: {
    id: string;
    category: string;
    employeeId: string;
    title: string;
  };
};

/**
 * HR with people.manage may access any correspondence attachment.
 * The owning employee may access only when the letter is employee-visible
 * and issued or acknowledged. Supervisors may access managerVisible items.
 */
export async function resolveCorrespondenceAttachmentAccess(
  correspondenceId: string,
): Promise<CorrespondenceAttachmentAccess> {
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return { allowed: false };
  }

  const correspondence = await prisma.employeeCorrespondence.findUnique({
    where: { id: correspondenceId },
    select: {
      id: true,
      employeeId: true,
      category: true,
      title: true,
      status: true,
      employeeVisible: true,
      managerVisible: true,
    },
  });

  if (!correspondence) {
    return { allowed: false };
  }

  const capabilities = await getUserCapabilities();

  if (capabilities?.can("people.manage")) {
    return { allowed: true, correspondence };
  }

  if (
    capabilities?.can("people.profile.view_own") &&
    correspondence.employeeId === user.employeeId &&
    isEmployeeVisibleCorrespondence(correspondence)
  ) {
    return { allowed: true, correspondence };
  }

  if (capabilities?.employeeId) {
    const supervisor = await resolveEmployeeSupervisor(correspondence.employeeId);

    if (
      supervisor?.supervisorEmployeeId === capabilities.employeeId &&
      isManagerVisibleCorrespondence(correspondence)
    ) {
      return { allowed: true, correspondence };
    }
  }

  return { allowed: false };
}

/** @deprecated Use resolveCorrespondenceAttachmentAccess */
export async function canAccessCorrespondenceAttachments(
  correspondenceId: string,
): Promise<boolean> {
  const result = await resolveCorrespondenceAttachmentAccess(correspondenceId);
  return result.allowed;
}

export function shouldAuditCorrespondenceAttachmentAccess(
  category: string,
): boolean {
  return isRestrictedCategory(category as never);
}
