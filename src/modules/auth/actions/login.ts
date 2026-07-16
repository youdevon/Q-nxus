"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { UserAccountStatus } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/src/modules/auth/lib/password"
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/src/modules/auth/lib/session-cookie"

export type LoginFormState = {
  status: "idle" | "error"
  message: string
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function login(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = textValue(formData, "email").toLowerCase()
  const password = textValue(formData, "password")
  const nextPath = textValue(formData, "next") || "/"

  if (!email || !password) {
    return {
      status: "error",
      message: "Enter your email and password.",
    }
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      status: true,
      passwordHash: true,
      lockedUntil: true,
      failedLoginAttempts: true,
      mustChangePassword: true,
    },
  })

  if (!user || !user.passwordHash) {
    return {
      status: "error",
      message: "Invalid email or password.",
    }
  }

  if (
    user.lockedUntil &&
    user.lockedUntil.getTime() > Date.now()
  ) {
    return {
      status: "error",
      message:
        "This account is temporarily locked. Try again later.",
    }
  }

  if (
    !user.isActive ||
    user.status === UserAccountStatus.DISABLED ||
    user.status === UserAccountStatus.SUSPENDED ||
    user.status === UserAccountStatus.ARCHIVED
  ) {
    return {
      status: "error",
      message: "This account is not allowed to sign in.",
    }
  }

  const valid = verifyPassword(password, user.passwordHash)

  if (!valid) {
    const failedLoginAttempts = user.failedLoginAttempts + 1
    const lockAccount = failedLoginAttempts >= 5

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginAttempts,
        lockedUntil: lockAccount
          ? new Date(Date.now() + 15 * 60 * 1000)
          : null,
      },
    })

    return {
      status: "error",
      message: lockAccount
        ? "Too many failed attempts. The account is locked for 15 minutes."
        : "Invalid email or password.",
    }
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      status: UserAccountStatus.ACTIVE,
    },
  })

  await setSessionCookie(user.id, {
    mustChangePassword: user.mustChangePassword,
  })

  revalidatePath("/", "layout")

  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/"

  if (user.mustChangePassword) {
    redirect(
      `/account/change-password?next=${encodeURIComponent(safeNext)}`,
    )
  }

  redirect(safeNext)
}

export async function logout() {
  await clearSessionCookie()
  revalidatePath("/", "layout")
  redirect("/login")
}
