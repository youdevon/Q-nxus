"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PerformanceAppraisalStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type PerformanceAppraisalRatingState = {
  status: "idle" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string>;
};

type SubmittedCriterion = {
  id: string;
  employeeRating: string;
  supervisorRating: string;
  finalRating: string;
  employeeComments: string;
  supervisorComments: string;
  evidence: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseOptionalRating(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : Number.NaN;
}

function parseCriteria(formData: FormData): SubmittedCriterion[] | null {
  const raw = textValue(formData, "criteriaJson");

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as SubmittedCriterion[];
  } catch {
    return null;
  }
}

function maximumForScale(scale: string): number {
  if (scale === "ONE_TO_TEN") {
    return 10;
  }

  if (scale === "PERCENTAGE") {
    return 100;
  }

  return 5;
}

function revalidateAppraisal(employeeId: string, appraisalId: string) {
  revalidatePath(`/people/employees/${employeeId}/appraisals`);

  revalidatePath(`/people/employees/${employeeId}/appraisals/${appraisalId}`);

  revalidatePath(
    `/people/employees/${employeeId}/appraisals/${appraisalId}/edit`,
  );

  revalidatePath(`/people/employees/${employeeId}`);
}

export async function savePerformanceAppraisalRatings(
  _previousState: PerformanceAppraisalRatingState,
  formData: FormData,
): Promise<PerformanceAppraisalRatingState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");
  const appraisalId = textValue(formData, "appraisalId");
  const submittedUpdatedAt = textValue(formData, "updatedAt");

  const employeeComments = nullableText(formData, "employeeComments");

  const supervisorComments = nullableText(formData, "supervisorComments");

  const developmentPlan = nullableText(formData, "developmentPlan");

  const submittedCriteria = parseCriteria(formData);

  if (!submittedCriteria) {
    return {
      status: "error",
      message: "The appraisal rating information could not be read.",
    };
  }

  const appraisal = await prisma.performanceAppraisal.findFirst({
    where: {
      id: appraisalId,
      employeeId,
    },
    include: {
      criteria: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!appraisal) {
    return {
      status: "error",
      message: "The performance appraisal no longer exists.",
    };
  }

  if (
    appraisal.status !== PerformanceAppraisalStatus.DRAFT &&
    appraisal.status !== PerformanceAppraisalStatus.IN_PROGRESS
  ) {
    return {
      status: "error",
      message:
        "Ratings can only be edited while the appraisal is in draft or in progress.",
    };
  }

  if (
    !submittedUpdatedAt ||
    appraisal.updatedAt.toISOString() !== submittedUpdatedAt
  ) {
    return {
      status: "conflict",
      message: "The appraisal changed elsewhere. Refresh before saving.",
    };
  }

  const maximumScore = maximumForScale(appraisal.ratingScale);

  const fieldErrors: Record<string, string> = {};

  const criterionMap = new Map(
    appraisal.criteria.map((criterion) => [criterion.id, criterion]),
  );

  const normalizedCriteria = submittedCriteria.map((submitted, index) => {
    const criterion = criterionMap.get(submitted.id);

    if (!criterion) {
      fieldErrors[`criterion.${index}`] = `Criterion ${index + 1} is invalid.`;

      return null;
    }

    const employeeRating = parseOptionalRating(submitted.employeeRating);

    const supervisorRating = parseOptionalRating(submitted.supervisorRating);

    const finalRating = parseOptionalRating(submitted.finalRating);

    for (const [name, rating] of [
      ["employee", employeeRating],
      ["supervisor", supervisorRating],
      ["final", finalRating],
    ] as const) {
      if (
        rating !== null &&
        (!Number.isFinite(rating) || rating < 0 || rating > maximumScore)
      ) {
        fieldErrors[`criterion.${index}.${name}Rating`] =
          `The ${name} rating for criterion ${index + 1} must be between 0 and ${maximumScore}.`;
      }
    }

    const weightedScore =
      finalRating === null
        ? null
        : (finalRating / maximumScore) * Number(criterion.weight);

    return {
      id: criterion.id,
      employeeRating,
      supervisorRating,
      finalRating,
      weightedScore,
      employeeComments: submitted.employeeComments.trim() || null,
      supervisorComments: submitted.supervisorComments.trim() || null,
      evidence: submitted.evidence.trim() || null,
    };
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the appraisal ratings.",
      fieldErrors,
    };
  }

  const validCriteria = normalizedCriteria.filter(
    (criterion): criterion is NonNullable<typeof criterion> =>
      criterion !== null,
  );

  const overallScore = validCriteria.reduce(
    (total, criterion) => total + (criterion.weightedScore ?? 0),
    0,
  );

  const hasAnyRating = validCriteria.some(
    (criterion) =>
      criterion.employeeRating !== null ||
      criterion.supervisorRating !== null ||
      criterion.finalRating !== null,
  );

  const metadata = await getAuditRequestMetadata(formData);
  const userId = actor.actor.userId;

  try {
    const saved = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.performanceAppraisal.updateMany({
        where: {
          id: appraisalId,
          employeeId,
          updatedAt: appraisal.updatedAt,
          status: {
            in: [
              PerformanceAppraisalStatus.DRAFT,
              PerformanceAppraisalStatus.IN_PROGRESS,
            ],
          },
        },
        data: {
          employeeComments,
          supervisorComments,
          developmentPlan,
          overallScore: new Prisma.Decimal(overallScore.toFixed(2)),
          status: hasAnyRating
            ? PerformanceAppraisalStatus.IN_PROGRESS
            : PerformanceAppraisalStatus.DRAFT,
        },
      });

      if (updateResult.count !== 1) {
        return false;
      }

      for (const criterion of validCriteria) {
        await transaction.performanceAppraisalCriterion.update({
          where: {
            id: criterion.id,
          },
          data: {
            employeeRating:
              criterion.employeeRating === null
                ? null
                : new Prisma.Decimal(criterion.employeeRating),
            supervisorRating:
              criterion.supervisorRating === null
                ? null
                : new Prisma.Decimal(criterion.supervisorRating),
            finalRating:
              criterion.finalRating === null
                ? null
                : new Prisma.Decimal(criterion.finalRating),
            weightedScore:
              criterion.weightedScore === null
                ? null
                : new Prisma.Decimal(criterion.weightedScore.toFixed(2)),
            employeeComments: criterion.employeeComments,
            supervisorComments: criterion.supervisorComments,
            evidence: criterion.evidence,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "PerformanceAppraisal",
          entityId: appraisalId,
          description: `Updated performance appraisal ratings for ${appraisal.employee.employeeNumber} — ${appraisal.employee.firstName} ${appraisal.employee.lastName}.`,
          oldValues: {
            status: appraisal.status,
            overallScore: appraisal.overallScore,
            employeeComments: appraisal.employeeComments,
            supervisorComments: appraisal.supervisorComments,
            developmentPlan: appraisal.developmentPlan,
          },
          newValues: {
            status: hasAnyRating
              ? PerformanceAppraisalStatus.IN_PROGRESS
              : PerformanceAppraisalStatus.DRAFT,
            overallScore: overallScore.toFixed(2),
            employeeComments,
            supervisorComments,
            developmentPlan,
            ratedCriteria: validCriteria.filter(
              (criterion) => criterion.finalRating !== null,
            ).length,
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
        message:
          "The appraisal changed while being saved. Refresh and try again.",
      };
    }

    revalidateAppraisal(employeeId, appraisalId);

    redirect(`/people/employees/${employeeId}/appraisals/${appraisalId}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to save performance appraisal ratings:", error);

    return {
      status: "error",
      message: "The performance appraisal ratings could not be saved.",
    };
  }
}

async function transitionAppraisal(
  formData: FormData,
  options: {
    allowedStatuses: PerformanceAppraisalStatus[];
    nextStatus: PerformanceAppraisalStatus;
    action: string;
    timestampField?:
      | "supervisorReviewedAt"
      | "employeeAcknowledgedAt"
      | "completedAt";
    requireAllFinalRatings?: boolean;
  },
): Promise<void> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const appraisalId = textValue(formData, "appraisalId");

  if (!employeeId || !appraisalId) {
    return;
  }

  const appraisal = await prisma.performanceAppraisal.findFirst({
    where: {
      id: appraisalId,
      employeeId,
    },
    include: {
      criteria: true,
      employee: {
        select: {
          organizationId: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          user: { select: { id: true } },
        },
      },
    },
  });

  if (!appraisal || !options.allowedStatuses.includes(appraisal.status)) {
    return;
  }

  if (
    options.requireAllFinalRatings &&
    appraisal.criteria.some((criterion) => criterion.finalRating === null)
  ) {
    return;
  }

  const metadata = await getAuditRequestMetadata(formData);
  const userId = actor.actor.userId;
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.performanceAppraisal.update({
      where: {
        id: appraisalId,
      },
      data: {
        status: options.nextStatus,
        ...(options.timestampField
          ? {
              [options.timestampField]: now,
            }
          : {}),
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId,
        moduleKey: "hr",
        action: options.action,
        entityType: "PerformanceAppraisal",
        entityId: appraisalId,
        description: `${options.action.toLowerCase()} performance appraisal for ${appraisal.employee.employeeNumber} — ${appraisal.employee.firstName} ${appraisal.employee.lastName}.`,
        oldValues: {
          status: appraisal.status,
        },
        newValues: {
          status: options.nextStatus,
          timestamp: options.timestampField ? now : null,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  revalidateAppraisal(employeeId, appraisalId);

  const employeeLabel = `${appraisal.employee.employeeNumber} — ${appraisal.employee.firstName} ${appraisal.employee.lastName}`;
  if (options.nextStatus === PerformanceAppraisalStatus.SUBMITTED) {
    const { notifyAppraisalSubmitted } = await import(
      "@/src/modules/hr/services/notify-appraisal-events"
    );
    await notifyAppraisalSubmitted({
      organizationId: appraisal.employee.organizationId,
      appraisalId,
      employeeId,
      employeeLabel,
      supervisorUserId: appraisal.supervisorUserId,
      actorUserId: userId,
    });
  } else if (
    options.nextStatus === PerformanceAppraisalStatus.SUPERVISOR_REVIEWED
  ) {
    const { notifyAppraisalReviewed } = await import(
      "@/src/modules/hr/services/notify-appraisal-events"
    );
    await notifyAppraisalReviewed({
      appraisalId,
      employeeId,
      employeeLabel,
      employeeUserId: appraisal.employee.user?.id ?? null,
      actorUserId: userId,
    });
  }
}

export async function submitPerformanceAppraisal(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  await transitionAppraisal(formData, {
    allowedStatuses: [
      PerformanceAppraisalStatus.DRAFT,
      PerformanceAppraisalStatus.IN_PROGRESS,
    ],
    nextStatus: PerformanceAppraisalStatus.SUBMITTED,
    action: "SUBMIT",
    requireAllFinalRatings: true,
  });
}

export async function reviewPerformanceAppraisal(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  await transitionAppraisal(formData, {
    allowedStatuses: [PerformanceAppraisalStatus.SUBMITTED],
    nextStatus: PerformanceAppraisalStatus.SUPERVISOR_REVIEWED,
    action: "REVIEW",
    timestampField: "supervisorReviewedAt",
  });
}

export async function acknowledgePerformanceAppraisal(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  await transitionAppraisal(formData, {
    allowedStatuses: [PerformanceAppraisalStatus.SUPERVISOR_REVIEWED],
    nextStatus: PerformanceAppraisalStatus.EMPLOYEE_ACKNOWLEDGED,
    action: "ACKNOWLEDGE",
    timestampField: "employeeAcknowledgedAt",
  });
}

export async function completePerformanceAppraisal(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  await transitionAppraisal(formData, {
    allowedStatuses: [PerformanceAppraisalStatus.EMPLOYEE_ACKNOWLEDGED],
    nextStatus: PerformanceAppraisalStatus.COMPLETED,
    action: "COMPLETE",
    timestampField: "completedAt",
  });
}

export async function cancelPerformanceAppraisal(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    throw new Error(actor.message);
  }

  await transitionAppraisal(formData, {
    allowedStatuses: [
      PerformanceAppraisalStatus.DRAFT,
      PerformanceAppraisalStatus.IN_PROGRESS,
      PerformanceAppraisalStatus.SUBMITTED,
    ],
    nextStatus: PerformanceAppraisalStatus.CANCELLED,
    action: "CANCEL",
  });
}
