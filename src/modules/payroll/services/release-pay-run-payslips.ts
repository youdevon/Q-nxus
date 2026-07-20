import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { queueEmail } from "@/src/modules/notifications/services/email-queue";
import {
  buildPayslipSecureUrl,
  canReleasePayRunPayslips,
  isPayslipEligibleForRelease,
} from "@/src/modules/payroll/lib/payslip-release";

export type ReleasePayRunPayslipsResult = {
  released: number;
  queued: number;
  skipped: number;
  alreadyReleased: number;
};

type ReleasePayslipRow = {
  id: string;
  status: string;
  releasedAt: Date | null;
  employeeName: string;
  employee: {
    firstName: string;
    lastName: string;
    workEmail: string | null;
    personalEmail: string | null;
    user: { id: string; email: string } | null;
  };
};

function resolveRecipientEmail(slip: ReleasePayslipRow): string | null {
  return (
    slip.employee.workEmail ??
    slip.employee.personalEmail ??
    slip.employee.user?.email ??
    null
  );
}

function employeeDisplayName(slip: ReleasePayslipRow): string {
  return (
    `${slip.employee.firstName} ${slip.employee.lastName}`.trim() ||
    slip.employeeName
  );
}

/**
 * Mark posted payslips released for self-service and queue secure-link emails.
 */
export async function releasePayRunPayslipsCore(input: {
  payRunId: string;
  actorUserId: string;
  metadata: AuditRequestMetadata;
  baseUrl?: string | null;
}): Promise<ReleasePayRunPayslipsResult> {
  const payRun = await prisma.payRun.findUnique({
    where: { id: input.payRunId },
    include: {
      payrollPeriod: { select: { name: true } },
      payslips: {
        where: { status: "POSTED" },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              workEmail: true,
              personalEmail: true,
              user: { select: { id: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!payRun || !canReleasePayRunPayslips(payRun.status)) {
    throw new Error("Payslips can only be released for posted pay runs.");
  }

  const eligible = payRun.payslips.filter((slip) =>
    isPayslipEligibleForRelease(slip),
  );
  const alreadyReleased = payRun.payslips.length - eligible.length;

  if (eligible.length === 0) {
    return {
      released: 0,
      queued: 0,
      skipped: 0,
      alreadyReleased,
    };
  }

  const releasedAt = new Date();
  let queued = 0;
  let skipped = 0;

  for (const slip of eligible) {
    const email = resolveRecipientEmail(slip);
    const deliveryStatus = email ? "PENDING" : "SKIPPED";

    await prisma.payslip.update({
      where: { id: slip.id },
      data: {
        releasedAt,
        releasedById: input.actorUserId,
        emailDeliveryStatus: deliveryStatus,
      },
    });

    if (!email) {
      skipped += 1;
      continue;
    }

    const employeeName = employeeDisplayName(slip);
    const url = buildPayslipSecureUrl(slip.id, input.baseUrl);

    await queueEmail({
      templateKey: "payroll.payslip.released",
      moduleKey: "payroll",
      relatedType: "Payslip",
      relatedId: slip.id,
      recipientUserId: slip.employee.user?.id ?? null,
      recipientEmail: email,
      recipientName: employeeName,
      subject: `Payslip available: ${payRun.payrollPeriod.name}`,
      textBody: `Your payslip for ${payRun.payrollPeriod.name} is available: ${url}`,
      htmlBody: `<p>Your payslip for ${payRun.payrollPeriod.name} is available.</p><p><a href="${url}">View your payslip</a></p>`,
    });
    queued += 1;
  }

  await prisma.auditEvent.create({
    data: {
      userId: input.actorUserId,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "PayRun",
      entityId: payRun.id,
      description: `Released ${eligible.length} payslip${eligible.length === 1 ? "" : "s"} for ${payRun.runNumber} (${queued} emailed, ${skipped} skipped).`,
      newValues: {
        released: eligible.length,
        queued,
        skipped,
        alreadyReleased,
      },
      ipAddress: input.metadata.ipAddress,
      userAgent: input.metadata.userAgent,
      clientHostName: input.metadata.clientHostName,
    },
  });

  return {
    released: eligible.length,
    queued,
    skipped,
    alreadyReleased,
  };
}
