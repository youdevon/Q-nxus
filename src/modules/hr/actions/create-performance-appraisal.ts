"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PerformanceRatingScale, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type PerformanceAppraisalFormState = {
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

export async function createPerformanceAppraisal(
  _previousState: PerformanceAppraisalFormState,
  formData: FormData,
): Promise<PerformanceAppraisalFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const employeeId = textValue(formData, "employeeId");
  const assignmentId = textValue(formData, "assignmentId");
  const supervisorUserId = nullableText(formData, "supervisorUserId");
  const title = textValue(formData, "title");
  const appraisalNumber = nullableText(formData, "appraisalNumber");
  const periodStart = parseDate(textValue(formData, "periodStart"));
  const periodEnd = parseDate(textValue(formData, "periodEnd"));
  const reviewDueDate = parseDate(textValue(formData, "reviewDueDate"));
  const ratingScaleValue = textValue(formData, "ratingScale");

  const fieldErrors: Record<string, string> = {};

  if (!assignmentId) {
    fieldErrors.assignmentId = "Select the assignment being appraised.";
  }

  if (title.length < 2) {
    fieldErrors.title = "Enter an appraisal title.";
  }

  if (!periodStart) {
    fieldErrors.periodStart = "Enter the appraisal period start date.";
  }

  if (!periodEnd) {
    fieldErrors.periodEnd = "Enter the appraisal period end date.";
  }

  if (periodStart && periodEnd && periodEnd < periodStart) {
    fieldErrors.periodEnd =
      "The period end date cannot be before the start date.";
  }

  if (
    !Object.values(PerformanceRatingScale).includes(
      ratingScaleValue as PerformanceRatingScale,
    )
  ) {
    fieldErrors.ratingScale = "Select a valid rating scale.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the appraisal information.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    return {
      status: "error",
      message: "The employee record no longer exists.",
    };
  }

  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      id: assignmentId,
      employeeId,
    },
    include: {
      jobDescription: {
        include: {
          criteria: {
            where: {
              isActive: true,
            },
            orderBy: [
              {
                sortOrder: "asc",
              },
              {
                createdAt: "asc",
              },
            ],
          },
        },
      },
    },
  });

  if (!assignment) {
    return {
      status: "error",
      message: "The selected employee assignment is invalid.",
    };
  }

  if (!assignment.jobDescription) {
    return {
      status: "error",
      message: "The selected assignment does not have a job description.",
    };
  }

  if (assignment.jobDescription.criteria.length === 0) {
    return {
      status: "error",
      message: "The selected job description has no active criteria.",
    };
  }

  if (periodStart! < assignment.startDate) {
    return {
      status: "error",
      message: "The appraisal period cannot begin before the assignment.",
    };
  }

  if (assignment.endDate && periodEnd! > assignment.endDate) {
    return {
      status: "error",
      message:
        "The appraisal period cannot extend beyond the assignment end date.",
    };
  }

  if (supervisorUserId) {
    const supervisor = await prisma.user.findFirst({
      where: {
        id: supervisorUserId,
        organizationId: employee.organizationId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!supervisor) {
      return {
        status: "error",
        message: "The selected supervisor is invalid.",
      };
    }
  }

  const validatedPeriodStart = periodStart!;
  const validatedPeriodEnd = periodEnd!;

  const duplicate = await prisma.performanceAppraisal.findFirst({
    where: {
      employeeId,
      periodStart: validatedPeriodStart,
      periodEnd: validatedPeriodEnd,
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    return {
      status: "error",
      message: "An appraisal already exists for this employee and period.",
    };
  }

  const maximumScore =
    ratingScaleValue === "ONE_TO_TEN"
      ? 10
      : ratingScaleValue === "PERCENTAGE"
        ? 100
        : 5;

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const appraisal = await prisma.$transaction(async (transaction) => {
      const created = await transaction.performanceAppraisal.create({
        data: {
          employeeId,
          assignmentId: assignment.id,
          jobDescriptionId: assignment.jobDescription!.id,
          supervisorUserId,
          appraisalNumber,
          title,
          periodStart: validatedPeriodStart,
          periodEnd: validatedPeriodEnd,
          reviewDueDate,
          status: "DRAFT",
          ratingScale: ratingScaleValue as PerformanceRatingScale,
          maximumScore: new Prisma.Decimal(maximumScore),
          criteria: {
            create: assignment.jobDescription!.criteria.map((criterion) => ({
              sourceCriterionId: criterion.id,
              criterionType: criterion.criterionType,
              title: criterion.title,
              description: criterion.description,
              measurement: criterion.measurement,
              weight: criterion.weight,
              sortOrder: criterion.sortOrder,
            })),
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "PerformanceAppraisal",
          entityId: created.id,
          description: `Created performance appraisal for ${employee.employeeNumber} — ${employee.firstName} ${employee.lastName}.`,
          newValues: {
            employeeId,
            assignmentId: assignment.id,
            jobDescriptionId: assignment.jobDescription!.id,
            supervisorUserId,
            appraisalNumber,
            title,
            periodStart,
            periodEnd,
            reviewDueDate,
            ratingScale: ratingScaleValue,
            maximumScore,
            criterionCount: assignment.jobDescription!.criteria.length,
            status: "DRAFT",
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return created;
    });

    revalidatePath(`/people/employees/${employeeId}/appraisals`);
    revalidatePath(`/people/employees/${employeeId}`);

    redirect(`/people/employees/${employeeId}/appraisals/${appraisal.id}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to create performance appraisal:", error);

    return {
      status: "error",
      message: "The performance appraisal could not be created.",
    };
  }
}
