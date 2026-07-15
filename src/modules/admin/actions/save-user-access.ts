"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { UserAccountStatus } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export type UserAccessFormState = {
  status: "idle" | "success" | "error" | "conflict"
  message: string
  errors?: Record<string, string>
}

const validStatuses = new Set<string>(
  Object.values(UserAccountStatus),
)

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function saveUserAccess(
  _previousState: UserAccessFormState,
  formData: FormData,
): Promise<UserAccessFormState> {
  const id = textValue(formData, "id")
  const submittedVersion = Number(textValue(formData, "version"))

  const firstName = textValue(formData, "firstName")
  const lastName = textValue(formData, "lastName")
  const email = textValue(formData, "email").toLowerCase()
  const status = textValue(formData, "status")
  const isActive = formData.get("isActive") === "on"

  const errors: Record<string, string> = {}

  if (!id) {
    errors.id = "The user could not be identified."
  }

  if (!Number.isInteger(submittedVersion) || submittedVersion < 1) {
    errors.version = "The user record version is invalid."
  }

  if (!firstName) {
    errors.firstName = "First name is required."
  }

  if (!lastName) {
    errors.lastName = "Last name is required."
  }

  if (!email) {
    errors.email = "Email address is required."
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address."
  }

  if (!validStatuses.has(status)) {
    errors.status = "Select a valid account status."
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      errors,
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
      const current = await transaction.user.findUnique({
        where: {
          id,
        },
      })

      if (!current) {
        return {
          outcome: "missing" as const,
        }
      }

      if (current.version !== submittedVersion) {
        return {
          outcome: "conflict" as const,
        }
      }

      const duplicateEmail = await transaction.user.findFirst({
        where: {
          email,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      })

      if (duplicateEmail) {
        return {
          outcome: "duplicate-email" as const,
        }
      }

      const updateResult = await transaction.user.updateMany({
        where: {
          id,
          version: submittedVersion,
        },
        data: {
          firstName,
          lastName,
          email,
          status: status as UserAccountStatus,
          isActive,
          lockedUntil:
            status === UserAccountStatus.LOCKED
              ? current.lockedUntil
              : null,
          failedLoginAttempts:
            status === UserAccountStatus.ACTIVE
              ? 0
              : current.failedLoginAttempts,
          archivedAt:
            status === UserAccountStatus.ARCHIVED
              ? current.archivedAt ?? new Date()
              : null,
          version: {
            increment: 1,
          },
        },
      })

      if (updateResult.count !== 1) {
        return {
          outcome: "conflict" as const,
        }
      }

      const updated = await transaction.user.findUniqueOrThrow({
        where: {
          id,
        },
      })

      const administrator = await transaction.user.findUnique({
        where: {
          email: "admin@q-nxus.local",
        },
        select: {
          id: true,
        },
      })

      await transaction.auditEvent.create({
        data: {
          userId: administrator?.id ?? null,
          moduleKey: "identity",
          action: "UPDATE",
          entityType: "User",
          entityId: updated.id,
          description: `Updated user account for ${updated.firstName} ${updated.lastName}.`,
          oldValues: {
            firstName: current.firstName,
            lastName: current.lastName,
            email: current.email,
            status: current.status,
            isActive: current.isActive,
            failedLoginAttempts: current.failedLoginAttempts,
            lockedUntil: current.lockedUntil,
            version: current.version,
          },
          newValues: {
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
            status: updated.status,
            isActive: updated.isActive,
            failedLoginAttempts: updated.failedLoginAttempts,
            lockedUntil: updated.lockedUntil,
            version: updated.version,
          },
          ipAddress,
          userAgent,
        },
      })

      return {
        outcome: "updated" as const,
      }
    })

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The user account no longer exists.",
      }
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "This user account was updated elsewhere. Refresh the page before saving again.",
      }
    }

    if (result.outcome === "duplicate-email") {
      return {
        status: "error",
        message: "That email address is already in use.",
        errors: {
          email: "Enter a different email address.",
        },
      }
    }

    revalidatePath("/administration/access")
    revalidatePath(`/administration/access/users/${id}`)

    return {
      status: "success",
      message: "User account saved successfully.",
    }
  } catch (error: unknown) {
    console.error("Unable to save user account:", error)

    return {
      status: "error",
      message:
        "The user account could not be saved. Check the server log and try again.",
    }
  }
}
