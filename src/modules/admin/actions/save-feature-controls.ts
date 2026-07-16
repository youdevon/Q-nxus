"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { ConfigurationStatus } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities"

export type FeatureControlsFormState = {
  status: "idle" | "success" | "error" | "conflict"
  message: string
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function saveFeatureControls(
  _previousState: FeatureControlsFormState,
  formData: FormData,
): Promise<FeatureControlsFormState> {
  const actor = await requireActor("administration.view")

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    }
  }

  const featureIds = formData
    .getAll("featureIds")
    .filter((value): value is string => typeof value === "string")

  if (featureIds.length === 0) {
    return {
      status: "error",
      message: "No feature-control records were submitted.",
    }
  }

  try {
    const requestHeaders = await headers()
    const ipAddress =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip") ??
      null
    const userAgent = requestHeaders.get("user-agent")

    const result = await prisma.$transaction(async (transaction) => {
      for (const featureId of featureIds) {
        const submittedUpdatedAt = textValue(
          formData,
          `updatedAt:${featureId}`,
        )

        const current = await transaction.featureControl.findUnique({
          where: {
            id: featureId,
          },
        })

        if (!current) {
          return {
            outcome: "missing" as const,
            featureId,
          }
        }

        if (
          !submittedUpdatedAt ||
          current.updatedAt.toISOString() !== submittedUpdatedAt
        ) {
          return {
            outcome: "conflict" as const,
            featureId,
          }
        }

        const isEnabled =
          formData.get(`enabled:${featureId}`) === "on"

        const statusValue = textValue(
          formData,
          `status:${featureId}`,
        )

        const effectiveFrom =
          parseDate(
            textValue(formData, `effectiveFrom:${featureId}`),
          ) ?? current.effectiveFrom

        const effectiveUntil = parseDate(
          textValue(formData, `effectiveUntil:${featureId}`),
        )

        const reason =
          textValue(formData, `reason:${featureId}`) || null

        if (
          effectiveUntil &&
          effectiveUntil < effectiveFrom
        ) {
          return {
            outcome: "invalid-date" as const,
            featureId,
          }
        }

        if (
          !Object.values(ConfigurationStatus).includes(
            statusValue as ConfigurationStatus,
          )
        ) {
          return {
            outcome: "invalid-status" as const,
            featureId,
          }
        }

        const updateResult =
          await transaction.featureControl.updateMany({
            where: {
              id: featureId,
              updatedAt: current.updatedAt,
            },
            data: {
              isEnabled,
              status: statusValue as ConfigurationStatus,
              effectiveFrom,
              effectiveUntil,
              reason,
            },
          })

        if (updateResult.count !== 1) {
          return {
            outcome: "conflict" as const,
            featureId,
          }
        }

        const updated =
          await transaction.featureControl.findUniqueOrThrow({
            where: {
              id: featureId,
            },
          })

        const changed =
          current.isEnabled !== updated.isEnabled ||
          current.status !== updated.status ||
          current.effectiveFrom.getTime() !==
            updated.effectiveFrom.getTime() ||
          current.effectiveUntil?.getTime() !==
            updated.effectiveUntil?.getTime() ||
          current.reason !== updated.reason

        if (changed) {
          await transaction.auditEvent.create({
            data: {
              userId: actor.actor.userId,
              moduleKey: "administration",
              action: "UPDATE",
              entityType: "FeatureControl",
              entityId: updated.id,
              description: `Updated feature control ${updated.featureCode}.`,
              oldValues: {
                featureCode: current.featureCode,
                isEnabled: current.isEnabled,
                status: current.status,
                effectiveFrom: current.effectiveFrom,
                effectiveUntil: current.effectiveUntil,
                reason: current.reason,
              },
              newValues: {
                featureCode: updated.featureCode,
                isEnabled: updated.isEnabled,
                status: updated.status,
                effectiveFrom: updated.effectiveFrom,
                effectiveUntil: updated.effectiveUntil,
                reason: updated.reason,
              },
              ipAddress,
              userAgent,
            },
          })
        }
      }

      return {
        outcome: "updated" as const,
      }
    })

    if (result.outcome === "missing") {
      return {
        status: "error",
        message:
          "A feature-control record no longer exists. Refresh the page.",
      }
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "A feature control was updated elsewhere. Refresh the page before saving again.",
      }
    }

    if (result.outcome === "invalid-date") {
      return {
        status: "error",
        message:
          "An effective-until date cannot be before its effective-from date.",
      }
    }

    if (result.outcome === "invalid-status") {
      return {
        status: "error",
        message: "An invalid feature-control status was submitted.",
      }
    }

    revalidatePath("/")
    revalidatePath("/administration")
    revalidatePath("/administration/features")

    return {
      status: "success",
      message: "Feature controls saved successfully.",
    }
  } catch (error: unknown) {
    console.error("Unable to save feature controls:", error)

    return {
      status: "error",
      message:
        "Feature controls could not be saved. Check the server log and try again.",
    }
  }
}
