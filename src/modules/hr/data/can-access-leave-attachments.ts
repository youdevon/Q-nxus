import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";

/**
 * Owner, assigned approver (supervisor), or leave.manage may access
 * leave request attachments.
 */
export async function canAccessLeaveRequestAttachments(
  leaveRequestId: string,
): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user?.isActive) {
    return false;
  }

  const request = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    select: {
      employeeId: true,
      createdByUserId: true,
      approvalSteps: {
        select: {
          approverUserId: true,
        },
      },
    },
  });

  if (!request) {
    return false;
  }

  const capabilities = await getUserCapabilities();
  const canManageLeave = capabilities?.can("leave.manage") ?? false;

  return (
    canManageLeave ||
    request.employeeId === user.employeeId ||
    request.createdByUserId === user.id ||
    request.approvalSteps.some((step) => step.approverUserId === user.id)
  );
}
