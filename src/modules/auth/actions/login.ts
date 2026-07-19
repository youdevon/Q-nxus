"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UserAccountStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { effectiveUserRoleWhere } from "@/src/modules/auth/lib/effective-user-role";
import { verifyPassword } from "@/src/modules/auth/lib/password";
import {
  aggregatePermissionsFromRoles,
  collectRoleCodes,
  isEmployeeOnlyAccess,
} from "@/src/modules/auth/lib/role-capabilities";
import {
  clearSessionCookie,
  readSessionUserId,
  setSessionCookie,
} from "@/src/modules/auth/lib/session-cookie";

export type LoginFormState = {
  status: "idle" | "error";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function recordAuthAuditEvent(input: {
  formData?: FormData;
  userId?: string | null;
  organizationId?: string | null;
  action: "LOGIN" | "LOGIN_FAILED" | "LOGOUT";
  description: string;
  email?: string | null;
  outcome?: string | null;
}): Promise<void> {
  try {
    const metadata = await getAuditRequestMetadata(input.formData);
    await recordAuditEvent(prisma, {
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      moduleKey: "auth",
      action: input.action,
      entityType: "User",
      entityId: input.userId ?? null,
      description: input.description,
      newValues: {
        ...(input.email ? { email: input.email } : {}),
        ...(input.outcome ? { outcome: input.outcome } : {}),
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    });
  } catch (error) {
    console.error("Auth audit event failed:", error);
  }
}

export async function login(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = textValue(formData, "email").toLowerCase();
  const password = textValue(formData, "password");
  const nextPath = textValue(formData, "next") || "/";

  if (!email || !password) {
    await recordAuthAuditEvent({
      formData,
      action: "LOGIN_FAILED",
      description: "Sign-in attempt missing email or password.",
      email: email || null,
      outcome: "missing_credentials",
    });
    return {
      status: "error",
      message: "Enter your email and password.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      organizationId: true,
      isActive: true,
      status: true,
      passwordHash: true,
      lockedUntil: true,
      failedLoginAttempts: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.passwordHash) {
    await recordAuthAuditEvent({
      formData,
      userId: user?.id ?? null,
      organizationId: user?.organizationId ?? null,
      action: "LOGIN_FAILED",
      description: `Failed sign-in for ${email} (unknown user or no password set).`,
      email,
      outcome: "invalid_credentials",
    });
    return {
      status: "error",
      message: "Invalid email or password.",
    };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordAuthAuditEvent({
      formData,
      userId: user.id,
      organizationId: user.organizationId,
      action: "LOGIN_FAILED",
      description: `Failed sign-in for ${email} (account locked).`,
      email,
      outcome: "locked",
    });
    return {
      status: "error",
      message: "This account is temporarily locked. Try again later.",
    };
  }

  if (
    !user.isActive ||
    user.status === UserAccountStatus.DISABLED ||
    user.status === UserAccountStatus.SUSPENDED ||
    user.status === UserAccountStatus.ARCHIVED
  ) {
    await recordAuthAuditEvent({
      formData,
      userId: user.id,
      organizationId: user.organizationId,
      action: "LOGIN_FAILED",
      description: `Failed sign-in for ${email} (account not allowed).`,
      email,
      outcome: "not_allowed",
    });
    return {
      status: "error",
      message: "This account is not allowed to sign in.",
    };
  }

  const valid = verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockAccount = failedLoginAttempts >= 5;

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginAttempts,
        lockedUntil: lockAccount ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });

    await recordAuthAuditEvent({
      formData,
      userId: user.id,
      organizationId: user.organizationId,
      action: "LOGIN_FAILED",
      description: lockAccount
        ? `Failed sign-in for ${email} (invalid password; account locked).`
        : `Failed sign-in for ${email} (invalid password).`,
      email,
      outcome: lockAccount ? "invalid_password_locked" : "invalid_password",
    });

    return {
      status: "error",
      message: lockAccount
        ? "Too many failed attempts. The account is locked for 15 minutes."
        : "Invalid email or password.",
    };
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
  });

  await setSessionCookie(user.id, {
    mustChangePassword: user.mustChangePassword,
  });

  await recordAuthAuditEvent({
    formData,
    userId: user.id,
    organizationId: user.organizationId,
    action: "LOGIN",
    description: `Signed in as ${email}.`,
    email,
    outcome: "success",
  });

  revalidatePath("/", "layout");

  let safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  // Default landing for self-service-only employees is /me, not the ops dashboard.
  if (safeNext === "/") {
    const assignments = await prisma.userRole.findMany({
      where: {
        userId: user.id,
        ...effectiveUserRoleWhere(),
        role: {
          isActive: true,
        },
      },
      select: {
        role: {
          select: {
            code: true,
            permissions: {
              select: {
                permission: {
                  select: {
                    code: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const grants = assignments.map((item) => ({
      roleCode: item.role.code,
      permissionCodes: item.role.permissions
        .filter((entry) => entry.permission.isActive)
        .map((entry) => entry.permission.code),
    }));

    if (
      isEmployeeOnlyAccess(
        collectRoleCodes(grants),
        aggregatePermissionsFromRoles(grants),
      )
    ) {
      safeNext = "/me";
    }
  }

  if (user.mustChangePassword) {
    redirect(`/account/change-password?next=${encodeURIComponent(safeNext)}`);
  }

  redirect(safeNext);
}

export async function logout() {
  const sessionUserId = await readSessionUserId();
  let email: string | null = null;
  let organizationId: string | null = null;

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { email: true, organizationId: true },
    });
    email = user?.email ?? null;
    organizationId = user?.organizationId ?? null;
  }

  await clearSessionCookie();

  await recordAuthAuditEvent({
    userId: sessionUserId,
    organizationId,
    action: "LOGOUT",
    description: email ? `Signed out (${email}).` : "Signed out.",
    email,
    outcome: "success",
  });

  revalidatePath("/", "layout");
  redirect("/login");
}
