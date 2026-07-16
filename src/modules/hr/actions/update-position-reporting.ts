"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type PositionReportingFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function wouldCreateCircularHierarchy(
  positionId: string,
  proposedManagerId: string,
): Promise<boolean> {
  if (positionId === proposedManagerId) {
    return true;
  }

  const visited = new Set<string>();
  let currentId: string | null = proposedManagerId;

  while (currentId) {
    if (currentId === positionId) {
      return true;
    }

    if (visited.has(currentId)) {
      return true;
    }

    visited.add(currentId);

    const current: {
      reportsToPositionId: string | null;
    } | null = await prisma.position.findUnique({
      where: {
        id: currentId,
      },
      select: {
        reportsToPositionId: true,
      },
    });

    currentId = current?.reportsToPositionId ?? null;
  }

  return false;
}

export async function updatePositionReporting(
  _previousState: PositionReportingFormState,
  formData: FormData,
): Promise<PositionReportingFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const positionId = textValue(formData, "positionId");

  const submittedUpdatedAt = textValue(formData, "updatedAt");

  const managerValue = textValue(formData, "reportsToPositionId");

  const returnTo = textValue(formData, "returnTo");

  const reportsToPositionId = managerValue.length > 0 ? managerValue : null;

  if (!positionId || !submittedUpdatedAt) {
    return {
      status: "error",
      message: "The position reporting information is incomplete.",
    };
  }

  const position = await prisma.position.findUnique({
    where: {
      id: positionId,
    },
    include: {
      department: {
        select: {
          organizationId: true,
        },
      },
      reportsToPosition: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!position) {
    return {
      status: "error",
      message: "The position no longer exists.",
    };
  }

  if (position.updatedAt.toISOString() !== submittedUpdatedAt) {
    return {
      status: "conflict",
      message: "The position changed elsewhere. Refresh before saving.",
    };
  }

  let managerTitle: string | null = null;

  if (reportsToPositionId) {
    const proposedManager = await prisma.position.findUnique({
      where: {
        id: reportsToPositionId,
      },
      include: {
        department: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (
      !proposedManager ||
      proposedManager.department.organizationId !==
        position.department.organizationId
    ) {
      return {
        status: "error",
        message: "The selected reporting position is invalid.",
      };
    }

    const circular = await wouldCreateCircularHierarchy(
      positionId,
      reportsToPositionId,
    );

    if (circular) {
      return {
        status: "error",
        message:
          "This reporting relationship would create a circular organizational structure.",
      };
    }

    managerTitle = proposedManager.title;
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const saved = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.position.updateMany({
        where: {
          id: positionId,
          updatedAt: position.updatedAt,
        },
        data: {
          reportsToPositionId,
        },
      });

      if (updateResult.count !== 1) {
        return false;
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "PositionReporting",
          entityId: positionId,
          description: `Updated reporting relationship for ${position.title}.`,
          oldValues: {
            reportsToPositionId: position.reportsToPositionId,
            reportsToPositionTitle: position.reportsToPosition?.title ?? null,
          },
          newValues: {
            reportsToPositionId,
            reportsToPositionTitle: managerTitle,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return true;
    });

    if (!saved) {
      return {
        status: "conflict",
        message: "The position changed while being saved.",
      };
    }

    revalidatePath("/people/structure");
    revalidatePath("/people/structure/chart");
    revalidatePath(`/people/structure/positions/${positionId}`);
    revalidatePath(`/people/structure/positions/${positionId}/reporting`);
    revalidatePath("/administration/organization");
    revalidatePath("/administration/organization/reporting");

    if (returnTo) {
      redirect(returnTo);
    }

    return {
      status: "success",
      message: "Reporting relationship updated successfully.",
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to update position reporting:", error);

    return {
      status: "error",
      message: "The reporting relationship could not be updated.",
    };
  }
}
