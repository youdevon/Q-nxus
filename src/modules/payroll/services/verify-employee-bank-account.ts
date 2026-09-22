import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { maskAccountNumber } from "@/src/modules/payroll/lib/payslip-preview";

export type VerifyBankAccountResult =
  | { ok: true; accountId: string; verificationStatus: string }
  | { ok: false; error: string };

/**
 * Mark an employee payment destination verified (maker-checker-friendly).
 * Never logs or returns the full account number.
 */
export async function verifyEmployeeBankAccount(input: {
  accountId: string;
  actorUserId: string;
  method?: string;
  audit?: AuditRequestMetadata;
}): Promise<VerifyBankAccountResult> {
  const account = await prisma.employeeBankAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      organizationId: true,
      employeeId: true,
      accountNumberLastFour: true,
      isActive: true,
      verificationStatus: true,
      isVerified: true,
    },
  });

  if (!account || !account.isActive) {
    return { ok: false, error: "Active payment instruction not found." };
  }

  const updated = await prisma.employeeBankAccount.update({
    where: { id: account.id },
    data: {
      isVerified: true,
      verificationStatus: "VERIFIED",
      verificationMethod: input.method ?? "MANUAL_REVIEW",
      verifiedAt: new Date(),
      verifiedByUserId: input.actorUserId,
    },
    select: { id: true, verificationStatus: true },
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: account.organizationId,
    moduleKey: "payroll",
    action: "VERIFY_PAYMENT_INSTRUCTION",
    entityType: "EmployeeBankAccount",
    entityId: account.id,
    description: `Verified payment instruction ending in ${account.accountNumberLastFour}.`,
    oldValues: {
      verificationStatus: account.verificationStatus,
      isVerified: account.isVerified,
      accountNumberMasked: maskAccountNumber(`••••${account.accountNumberLastFour}`),
    },
    newValues: {
      verificationStatus: updated.verificationStatus,
      isVerified: true,
      accountNumberMasked: `••••${account.accountNumberLastFour}`,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return {
    ok: true,
    accountId: updated.id,
    verificationStatus: updated.verificationStatus,
  };
}

export async function deactivateEmployeeBankAccount(input: {
  accountId: string;
  actorUserId: string;
  changeReason?: string | null;
  audit?: AuditRequestMetadata;
}): Promise<VerifyBankAccountResult> {
  const account = await prisma.employeeBankAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      organizationId: true,
      accountNumberLastFour: true,
      isActive: true,
      verificationStatus: true,
    },
  });

  if (!account) {
    return { ok: false, error: "Payment instruction not found." };
  }
  if (!account.isActive) {
    return {
      ok: true,
      accountId: account.id,
      verificationStatus: account.verificationStatus,
    };
  }

  const asOf = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.employeePayrollAllocation.updateMany({
      where: { employeeBankAccountId: account.id, isActive: true },
      data: { isActive: false, effectiveTo: asOf },
    });
    await tx.employeeBankAccount.update({
      where: { id: account.id },
      data: {
        isActive: false,
        isPrimary: false,
        isPayrollEnabled: false,
        effectiveTo: asOf,
        archivedAt: asOf,
        changeReason: input.changeReason ?? "Deactivated by authorized user",
      },
    });
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: account.organizationId,
    moduleKey: "payroll",
    action: "DEACTIVATE_PAYMENT_INSTRUCTION",
    entityType: "EmployeeBankAccount",
    entityId: account.id,
    description: `Deactivated payment instruction ending in ${account.accountNumberLastFour}.`,
    newValues: {
      isActive: false,
      accountNumberMasked: `••••${account.accountNumberLastFour}`,
      changeReason: input.changeReason ?? "Deactivated by authorized user",
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return {
    ok: true,
    accountId: account.id,
    verificationStatus: account.verificationStatus,
  };
}
