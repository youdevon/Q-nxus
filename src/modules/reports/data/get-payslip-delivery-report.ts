import { prisma } from "@/lib/prisma";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";

export type PayslipDeliveryIssue =
  | "UNRELEASED"
  | "EMAIL_PENDING"
  | "EMAIL_FAILED";

export type PayslipDeliveryRow = {
  payslipId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  runNumber: string;
  periodKey: string;
  issue: PayslipDeliveryIssue;
  emailDeliveryStatus: string | null;
  releasedAt: string | null;
  postedAt: string | null;
};

export type PayslipDeliveryReport = {
  rows: PayslipDeliveryRow[];
  summary: {
    unreleased: number;
    emailPending: number;
    emailFailed: number;
  };
};

/** Posted payslips with delivery gaps (unreleased, unsent, or failed email). */
export async function getPayslipDeliveryReport(input?: {
  actorUserId?: string | null;
}): Promise<PayslipDeliveryReport> {
  const organizationId = (
    await resolvePayrollOrganization({ actorUserId: input?.actorUserId })
  ).id;

  const payslips = await prisma.payslip.findMany({
    where: {
      organizationId,
      status: "POSTED",
      OR: [
        { releasedAt: null },
        { emailDeliveryStatus: "PENDING" },
        { emailDeliveryStatus: "FAILED" },
      ],
    },
    orderBy: [
      { payRun: { postedAt: "desc" } },
      { employeeName: "asc" },
    ],
    select: {
      id: true,
      employeeId: true,
      employeeNumber: true,
      employeeName: true,
      releasedAt: true,
      emailDeliveryStatus: true,
      payRun: {
        select: {
          runNumber: true,
          postedAt: true,
        },
      },
      payrollPeriod: {
        select: { periodKey: true },
      },
    },
  });

  const rows: PayslipDeliveryRow[] = [];
  const summary = { unreleased: 0, emailPending: 0, emailFailed: 0 };

  for (const slip of payslips) {
    let issue: PayslipDeliveryIssue;

    if (slip.releasedAt == null) {
      issue = "UNRELEASED";
      summary.unreleased += 1;
    } else if (slip.emailDeliveryStatus === "FAILED") {
      issue = "EMAIL_FAILED";
      summary.emailFailed += 1;
    } else {
      issue = "EMAIL_PENDING";
      summary.emailPending += 1;
    }

    rows.push({
      payslipId: slip.id,
      employeeId: slip.employeeId,
      employeeNumber: slip.employeeNumber,
      employeeName: slip.employeeName,
      runNumber: slip.payRun.runNumber,
      periodKey: slip.payrollPeriod.periodKey,
      issue,
      emailDeliveryStatus: slip.emailDeliveryStatus,
      releasedAt: slip.releasedAt?.toISOString() ?? null,
      postedAt: slip.payRun.postedAt?.toISOString() ?? null,
    });
  }

  return { rows, summary };
}
