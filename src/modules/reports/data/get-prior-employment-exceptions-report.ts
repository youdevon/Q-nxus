import { prisma } from "@/lib/prisma";
import type { PreviousEmploymentStatusCode } from "@/src/modules/payroll/lib/tax-year-period-paye";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type PriorEmploymentExceptionReason =
  | "UNVERIFIED_RECORDS"
  | "INCOMPLETE_PREVIOUS"
  | "UNKNOWN_STATUS_REVIEW";

export type PriorEmploymentExceptionRow = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
  taxYear: number;
  previousEmploymentStatus: PreviousEmploymentStatusCode;
  recordCount: number;
  verifiedCount: number;
  reasons: PriorEmploymentExceptionReason[];
  detail: string;
};

export type PriorEmploymentExceptionsReport = {
  taxYear: number;
  rows: PriorEmploymentExceptionRow[];
};

/** Employees with unverified or incomplete prior YTD for the current tax year. */
export async function getPriorEmploymentExceptionsReport(): Promise<PriorEmploymentExceptionsReport> {
  const taxYear = taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));
  const taxYearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] },
      payrollProfile: { isNot: null },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      contracts: {
        where: { isCurrent: true, status: "ACTIVE" },
        take: 1,
        select: { startDate: true },
      },
      taxProfiles: {
        where: { taxYear },
        take: 1,
        select: { previousEmploymentStatus: true },
      },
      priorEmploymentYtds: {
        where: {
          taxYear,
          status: "ACTIVE",
        },
        select: { verified: true },
      },
    },
  });

  const rows: PriorEmploymentExceptionRow[] = [];

  for (const employee of employees) {
    const records = employee.priorEmploymentYtds;
    const recordCount = records.length;
    const verifiedCount = records.filter((row) => row.verified).length;
    const previousEmploymentStatus: PreviousEmploymentStatusCode =
      employee.taxProfiles[0]?.previousEmploymentStatus ??
      "UNKNOWN_PREVIOUS_INCOME";
    const reasons: PriorEmploymentExceptionReason[] = [];
    const detailParts: string[] = [];

    if (recordCount > 0 && verifiedCount < recordCount) {
      reasons.push("UNVERIFIED_RECORDS");
      detailParts.push(
        `${recordCount - verifiedCount} of ${recordCount} prior-employer record${recordCount === 1 ? "" : "s"} unverified`,
      );
    }

    if (
      previousEmploymentStatus === "PREVIOUS_EMPLOYMENT" &&
      (recordCount === 0 || verifiedCount < recordCount)
    ) {
      reasons.push("INCOMPLETE_PREVIOUS");
      detailParts.push(
        recordCount === 0
          ? "Previous employment declared but no prior-employer YTD records on file"
          : "Previous employment declared with incomplete verified prior YTD",
      );
    }

    const currentContract = employee.contracts[0];
    const joinedInTaxYear =
      currentContract != null && currentContract.startDate >= taxYearStart;

    // Mid-year + NO_PREVIOUS_EMPLOYMENT is intentionally not an exception.
    if (
      joinedInTaxYear &&
      previousEmploymentStatus === "UNKNOWN_PREVIOUS_INCOME"
    ) {
      reasons.push("UNKNOWN_STATUS_REVIEW");
      detailParts.push(
        "Mid-year joiner with unknown previous-employment status — do not assume prior income is zero",
      );
    }

    if (reasons.length === 0) {
      continue;
    }

    rows.push({
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
      departmentName: employee.department?.name ?? null,
      taxYear,
      previousEmploymentStatus,
      recordCount,
      verifiedCount,
      reasons,
      detail: detailParts.join("; "),
    });
  }

  return { taxYear, rows };
}
