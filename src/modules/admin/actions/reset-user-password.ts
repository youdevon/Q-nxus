"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { hashPassword } from "@/src/modules/auth/lib/password";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type ResetUserPasswordFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function resetUserPassword(
  _previousState: ResetUserPasswordFormState,
  formData: FormData,
): Promise<ResetUserPasswordFormState> {
  const actor = await requireActor(
    "administration.manage",
    "identity.user.update",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const userId = textValue(formData, "userId").trim();
  const newPassword = textValue(formData, "newPassword");
  const confirmPassword = textValue(formData, "confirmPassword");
  const mustChangePassword = formData.get("mustChangePassword") === "on";

  const fieldErrors: Record<string, string> = {};

  if (!userId) {
    fieldErrors.userId = "The user could not be identified.";
  }

  if (userId && userId === actor.actor.userId) {
    return {
      status: "error",
      message:
        "Use Change password in your account menu to update your own password.",
    };
  }

  if (newPassword.length < 8) {
    fieldErrors.newPassword = "New password must be at least 8 characters.";
  }

  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "New password and confirmation do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted password fields.",
      fieldErrors,
    };
  }

  const target = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      mustChangePassword: true,
    },
  });

  if (!target) {
    return {
      status: "error",
      message: "That user account could not be found.",
    };
  }

  const { ipAddress, userAgent, clientHostName } =
    await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: {
        id: target.id,
      },
      data: {
        passwordHash: hashPassword(newPassword),
        mustChangePassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
        version: {
          increment: 1,
        },
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "identity",
        action: "UPDATE",
        entityType: "User",
        entityId: target.id,
        description: `Reset password for ${target.firstName} ${target.lastName} (${target.email}).`,
        oldValues: {
          mustChangePassword: target.mustChangePassword,
          passwordChanged: false,
        },
        newValues: {
          mustChangePassword,
          passwordChanged: true,
          forceChangeOnNextLogin: mustChangePassword,
        },
        ipAddress,
        userAgent,
        clientHostName,
      },
    });
  });

  revalidatePath(`/administration/access/users/${target.id}`);
  revalidatePath(`/administration/access/users/${target.id}/edit`);
  revalidatePath("/administration/access");

  return {
    status: "success",
    message: mustChangePassword
      ? `Password updated. ${target.firstName} must change it on next sign-in.`
      : `Password updated for ${target.firstName} ${target.lastName}.`,
  };
}
