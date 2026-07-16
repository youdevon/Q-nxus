"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import {
  hashPassword,
  verifyPassword,
} from "@/src/modules/auth/lib/password"
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user"
import { setSessionCookie } from "@/src/modules/auth/lib/session-cookie"

export type ChangePasswordFormState = {
  status: "idle" | "error" | "success"
  message: string
  fieldErrors?: Record<string, string>
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export async function changePassword(
  _previousState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const user = await requireCurrentUser()

  const currentPassword = textValue(formData, "currentPassword")
  const newPassword = textValue(formData, "newPassword")
  const confirmPassword = textValue(formData, "confirmPassword")
  const nextPath = textValue(formData, "next").trim() || "/"

  const fieldErrors: Record<string, string> = {}

  if (!currentPassword) {
    fieldErrors.currentPassword =
      "Enter your current password."
  }

  if (newPassword.length < 8) {
    fieldErrors.newPassword =
      "New password must be at least 8 characters."
  }

  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword =
      "New password and confirmation do not match."
  }

  if (
    newPassword.length >= 8 &&
    currentPassword &&
    newPassword === currentPassword
  ) {
    fieldErrors.newPassword =
      "Choose a password that is different from your current one."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted password fields.",
      fieldErrors,
    }
  }

  const account = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    select: {
      id: true,
      passwordHash: true,
      mustChangePassword: true,
    },
  })

  if (!account?.passwordHash) {
    return {
      status: "error",
      message: "This account cannot change its password.",
    }
  }

  if (!verifyPassword(currentPassword, account.passwordHash)) {
    return {
      status: "error",
      message: "Current password is incorrect.",
      fieldErrors: {
        currentPassword: "Current password is incorrect.",
      },
    }
  }

  await prisma.user.update({
    where: {
      id: account.id,
    },
    data: {
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })

  await setSessionCookie(account.id, {
    mustChangePassword: false,
  })
  revalidatePath("/", "layout")

  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/"

  redirect(safeNext)
}
