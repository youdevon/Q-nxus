"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type OrganizationReportingLinesFormState = {
  status: "idle" | "error" | "conflict";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function wouldCreateCircularHierarchyInGraph(
  positionId: string,
  reportsToById: Map<string, string | null>,
): boolean {
  const visited = new Set<string>();
  let currentId = reportsToById.get(positionId) ?? null;

  while (currentId) {
    if (currentId === positionId) {
      return true;
    }

    if (visited.has(currentId)) {
      return true;
    }

    visited.add(currentId);
    currentId = reportsToById.get(currentId) ?? null;
  }

  return false;
}

export async function saveOrganizationReportingLines(
  _previousState: OrganizationReportingLinesFormState,
  formData: FormData,
): Promise<OrganizationReportingLinesFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const positionIds = formData.getAll("positionId").flatMap((value) => {
    return typeof value === "string" && value.trim().length > 0
      ? [value.trim()]
      : [];
  });

  if (positionIds.length === 0) {
    return {
      status: "error",
      message: "No positions were submitted for reporting line updates.",
    };
  }

  const uniqueIds = [...new Set(positionIds)];

  if (uniqueIds.length !== positionIds.length) {
    return {
      status: "error",
      message: "Duplicate positions were submitted.",
    };
  }

  const positions = await prisma.position.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
    },
    select: {
      id: true,
      title: true,
      reportsToPositionId: true,
      updatedAt: true,
      department: {
        select: {
          organizationId: true,
        },
      },
      reportsToPosition: {
        select: {
          title: true,
        },
      },
    },
  });

  if (positions.length !== uniqueIds.length) {
    return {
      status: "error",
      message: "One or more positions no longer exist.",
    };
  }

  const organizationIds = new Set(
    positions.map((position) => position.department.organizationId),
  );

  if (organizationIds.size !== 1) {
    return {
      status: "error",
      message: "Reporting lines must belong to a single organization.",
    };
  }

  const organizationId = [...organizationIds][0]!;
  const positionById = new Map(
    positions.map((position) => [position.id, position]),
  );

  const organizationPositions = await prisma.position.findMany({
    where: {
      department: {
        organizationId,
      },
    },
    select: {
      id: true,
      title: true,
      reportsToPositionId: true,
    },
  });

  const organizationPositionIds = new Set(
    organizationPositions.map((position) => position.id),
  );
  const proposedReportsTo = new Map<string, string | null>(
    organizationPositions.map((position) => [
      position.id,
      position.reportsToPositionId,
    ]),
  );

  const changes: {
    positionId: string;
    title: string;
    previousReportsToPositionId: string | null;
    previousReportsToTitle: string | null;
    nextReportsToPositionId: string | null;
    submittedUpdatedAt: string;
  }[] = [];

  for (const positionId of uniqueIds) {
    const position = positionById.get(positionId)!;
    const submittedUpdatedAt = textValue(formData, `updatedAt:${positionId}`);
    const managerValue = textValue(
      formData,
      `reportsToPositionId:${positionId}`,
    );
    const nextReportsToPositionId =
      managerValue.length > 0 ? managerValue : null;

    if (!submittedUpdatedAt) {
      return {
        status: "error",
        message: `Missing concurrency token for ${position.title}.`,
      };
    }

    if (position.updatedAt.toISOString() !== submittedUpdatedAt) {
      return {
        status: "conflict",
        message:
          "One or more positions changed elsewhere. Refresh before saving reporting lines.",
      };
    }

    if (nextReportsToPositionId === positionId) {
      return {
        status: "error",
        message: `${position.title} cannot report to itself.`,
      };
    }

    if (
      nextReportsToPositionId &&
      !organizationPositionIds.has(nextReportsToPositionId)
    ) {
      return {
        status: "error",
        message: `The reporting position selected for ${position.title} is invalid.`,
      };
    }

    proposedReportsTo.set(positionId, nextReportsToPositionId);

    if (nextReportsToPositionId !== position.reportsToPositionId) {
      changes.push({
        positionId,
        title: position.title,
        previousReportsToPositionId: position.reportsToPositionId,
        previousReportsToTitle: position.reportsToPosition?.title ?? null,
        nextReportsToPositionId,
        submittedUpdatedAt,
      });
    }
  }

  for (const positionId of uniqueIds) {
    if (wouldCreateCircularHierarchyInGraph(positionId, proposedReportsTo)) {
      const position = positionById.get(positionId)!;

      return {
        status: "error",
        message: `The reporting line for ${position.title} would create a circular organizational structure.`,
      };
    }
  }

  if (changes.length === 0) {
    redirect("/administration/organization");
  }

  const managerTitles = new Map<string, string>();

  for (const change of changes) {
    if (!change.nextReportsToPositionId) {
      continue;
    }

    const known = positionById.get(change.nextReportsToPositionId);

    if (known) {
      managerTitles.set(change.nextReportsToPositionId, known.title);
      continue;
    }

    const manager = await prisma.position.findUnique({
      where: {
        id: change.nextReportsToPositionId,
      },
      select: {
        title: true,
      },
    });

    if (manager) {
      managerTitles.set(change.nextReportsToPositionId, manager.title);
    }
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      for (const change of changes) {
        const updateResult = await transaction.position.updateMany({
          where: {
            id: change.positionId,
            updatedAt: new Date(change.submittedUpdatedAt),
          },
          data: {
            reportsToPositionId: change.nextReportsToPositionId,
          },
        });

        if (updateResult.count !== 1) {
          throw new Error("CONFLICT");
        }

        await transaction.auditEvent.create({
          data: {
            userId: actor.actor.userId,
            moduleKey: "hr",
            action: "UPDATE",
            entityType: "PositionReporting",
            entityId: change.positionId,
            description: `Updated reporting relationship for ${change.title}.`,
            oldValues: {
              reportsToPositionId: change.previousReportsToPositionId,
              reportsToPositionTitle: change.previousReportsToTitle,
            },
            newValues: {
              reportsToPositionId: change.nextReportsToPositionId,
              reportsToPositionTitle: change.nextReportsToPositionId
                ? (managerTitles.get(change.nextReportsToPositionId) ?? null)
                : null,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            clientHostName: metadata.clientHostName,
          },
        });
      }
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return {
        status: "conflict",
        message:
          "One or more positions changed while being saved. Refresh and try again.",
      };
    }

    console.error("Unable to save organization reporting lines:", error);

    return {
      status: "error",
      message: "The reporting lines could not be updated.",
    };
  }

  revalidatePath("/administration/organization");
  revalidatePath("/administration/organization/reporting");
  revalidatePath("/people/structure");
  revalidatePath("/people/structure/chart");

  for (const change of changes) {
    revalidatePath(`/people/structure/positions/${change.positionId}`);
    revalidatePath(
      `/people/structure/positions/${change.positionId}/reporting`,
    );
  }

  redirect("/administration/organization");
}
