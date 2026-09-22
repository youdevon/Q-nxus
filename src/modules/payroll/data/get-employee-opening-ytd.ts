import { prisma } from "@/lib/prisma";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

/**
 * Current-employer opening YTD (system go-live / migration balances).
 * NOT prior-employer income — same employer, pre-Q-NXUS posted periods.
 */

export type EmployeeOpeningYtdRecord = {
  id: string;
  employeeId: string;
  taxYear: number;
  asOfDate: string;
  taxableIncomeYtd: string;
  payeDeductedYtd: string;
  nisEmployeeYtd: string | null;
  healthSurchargeYtd: string | null;
  verified: boolean;
  notes: string | null;
};

export type EmployeeOpeningYtdAmounts = {
  taxableIncomeYtd: number;
  payeDeductedYtd: number;
  nisEmployeeYtd: number;
  healthSurchargeYtd: number;
  verified: boolean;
  asOfDate: string | null;
};

function mapRow(row: {
  id: string;
  employeeId: string;
  taxYear: number;
  asOfDate: Date;
  taxableIncomeYtd: { toString(): string };
  payeDeductedYtd: { toString(): string };
  nisEmployeeYtd: { toString(): string } | null;
  healthSurchargeYtd: { toString(): string } | null;
  verified: boolean;
  notes: string | null;
}): EmployeeOpeningYtdRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    taxYear: row.taxYear,
    asOfDate: row.asOfDate.toISOString().slice(0, 10),
    taxableIncomeYtd: row.taxableIncomeYtd.toString(),
    payeDeductedYtd: row.payeDeductedYtd.toString(),
    nisEmployeeYtd: row.nisEmployeeYtd?.toString() ?? null,
    healthSurchargeYtd: row.healthSurchargeYtd?.toString() ?? null,
    verified: row.verified,
    notes: row.notes,
  };
}

export async function getEmployeeOpeningYtd(
  employeeId: string,
  taxYear?: number,
): Promise<EmployeeOpeningYtdRecord | null> {
  const year =
    taxYear ?? taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));

  const row = await prisma.employeeOpeningYtdBalance.findUnique({
    where: {
      employeeId_taxYear: {
        employeeId,
        taxYear: year,
      },
    },
  });

  return row ? mapRow(row) : null;
}

/**
 * Verified opening amounts only — unverified balances stay out of calc.
 */
export async function getVerifiedEmployeeOpeningYtdAmounts(
  employeeId: string,
  taxYear: number,
): Promise<EmployeeOpeningYtdAmounts> {
  const row = await prisma.employeeOpeningYtdBalance.findUnique({
    where: {
      employeeId_taxYear: {
        employeeId,
        taxYear,
      },
    },
    select: {
      asOfDate: true,
      taxableIncomeYtd: true,
      payeDeductedYtd: true,
      nisEmployeeYtd: true,
      healthSurchargeYtd: true,
      verified: true,
    },
  });

  if (!row || !row.verified) {
    return {
      taxableIncomeYtd: 0,
      payeDeductedYtd: 0,
      nisEmployeeYtd: 0,
      healthSurchargeYtd: 0,
      verified: false,
      asOfDate: null,
    };
  }

  return {
    taxableIncomeYtd: Number(row.taxableIncomeYtd.toString()),
    payeDeductedYtd: Number(row.payeDeductedYtd.toString()),
    nisEmployeeYtd:
      row.nisEmployeeYtd != null ? Number(row.nisEmployeeYtd.toString()) : 0,
    healthSurchargeYtd:
      row.healthSurchargeYtd != null
        ? Number(row.healthSurchargeYtd.toString())
        : 0,
    verified: true,
    asOfDate: row.asOfDate.toISOString().slice(0, 10),
  };
}
