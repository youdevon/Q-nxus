"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user"

function textValue(
  formData: FormData,
  key: string,
): string {
  const value = formData.get(key)

  return typeof value === "string"
    ? value.trim()
    : ""
}

async function resolveCurrentUserId(): Promise<
  string | null
> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

function safeInternalUrl(
  value: string,
): string | null {
  if (!value.startsWith("/")) {
    return null
  }

  if (value.startsWith("//")) {
    return null
  }

  return value
}

export async function markNotificationRead(
  formData: FormData,
): Promise<void> {
  const notificationId = textValue(
    formData,
    "recipientId",
  )

  const requestedUrl = textValue(
    formData,
    "actionUrl",
  )

  const userId = await resolveCurrentUserId()

  if (!userId || !notificationId) {
    return
  }

  await prisma.notificationRecipient.updateMany({
    where: {
      userId,
      notificationId,
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  })

  revalidatePath("/notifications")

  const actionUrl = safeInternalUrl(requestedUrl)

  if (actionUrl) {
    redirect(actionUrl)
  }
}

export async function markNotificationUnread(
  formData: FormData,
): Promise<void> {
  const notificationId = textValue(
    formData,
    "recipientId",
  )

  const userId = await resolveCurrentUserId()

  if (!userId || !notificationId) {
    return
  }

  await prisma.notificationRecipient.updateMany({
    where: {
      userId,
      notificationId,
    },
    data: {
      status: "UNREAD",
      readAt: null,
    },
  })

  revalidatePath("/notifications")
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await resolveCurrentUserId()

  if (!userId) {
    return
  }

  await prisma.notificationRecipient.updateMany({
    where: {
      userId,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  })

  revalidatePath("/notifications")
}
