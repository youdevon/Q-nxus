import { prisma } from "@/lib/prisma";
import {
  aggregatePriorEmploymentYtd,
  type PriorEmploymentYtdTotals,
} from "@/src/modules/payroll/lib/prior-employment-ytd";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type PriorEmploymentDocumentRecord = {
  id: string;
  documentType: string;
  label: string | null;
  storedFileId: string;
  fileName: string;
  createdAt: string;
};

export type PriorEmploymentYtdRecord = {
  id: string;
  taxYear: number;
  employerName: string;
  employerBirNumber: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  asOfDate: string;
  currencyCode: string;
  taxableIncomeEntryMode: "DIRECT" | "WORKSHEET";
  grossEarningsYtd: string | null;
  nonTaxableAllowancesYtd: string | null;
  taxableIncomeYtd: string;
  payeDeductedYtd: string;
  nisEmployeeYtd: string | null;
  nisEmployerYtd: string | null;
  healthSurchargeYtd: string | null;
  otherApprovedDeductionsYtd: string | null;
  status: string;
  verified: boolean;
  verifiedAt: string | null;
  notes: string | null;
  documents: PriorEmploymentDocumentRecord[];
  updatedAt: string;
};

function mapRecord(row: {
  id: string;
  taxYear: number;
  employerName: string;
  employerBirNumber: string | null;
  employmentStartDate: Date | null;
  employmentEndDate: Date | null;
  asOfDate: Date;
  currencyCode: string;
  taxableIncomeEntryMode: "DIRECT" | "WORKSHEET";
  grossEarningsYtd: { toString(): string } | null;
  nonTaxableAllowancesYtd: { toString(): string } | null;
  taxableIncomeYtd: { toString(): string };
  payeDeductedYtd: { toString(): string };
  nisEmployeeYtd: { toString(): string } | null;
  nisEmployerYtd: { toString(): string } | null;
  healthSurchargeYtd: { toString(): string } | null;
  otherApprovedDeductionsYtd: { toString(): string } | null;
  status: string;
  verified: boolean;
  verifiedAt: Date | null;
  notes: string | null;
  updatedAt: Date;
  documents: Array<{
    id: string;
    documentType: string;
    label: string | null;
    storedFileId: string;
    createdAt: Date;
    storedFile: { fileName: string };
  }>;
}): PriorEmploymentYtdRecord {
  return {
    id: row.id,
    taxYear: row.taxYear,
    employerName: row.employerName,
    employerBirNumber: row.employerBirNumber,
    employmentStartDate: row.employmentStartDate
      ? row.employmentStartDate.toISOString().slice(0, 10)
      : null,
    employmentEndDate: row.employmentEndDate
      ? row.employmentEndDate.toISOString().slice(0, 10)
      : null,
    asOfDate: row.asOfDate.toISOString().slice(0, 10),
    currencyCode: row.currencyCode,
    taxableIncomeEntryMode: row.taxableIncomeEntryMode,
    grossEarningsYtd: row.grossEarningsYtd?.toString() ?? null,
    nonTaxableAllowancesYtd: row.nonTaxableAllowancesYtd?.toString() ?? null,
    taxableIncomeYtd: row.taxableIncomeYtd.toString(),
    payeDeductedYtd: row.payeDeductedYtd.toString(),
    nisEmployeeYtd: row.nisEmployeeYtd?.toString() ?? null,
    nisEmployerYtd: row.nisEmployerYtd?.toString() ?? null,
    healthSurchargeYtd: row.healthSurchargeYtd?.toString() ?? null,
    otherApprovedDeductionsYtd:
      row.otherApprovedDeductionsYtd?.toString() ?? null,
    status: row.status,
    verified: row.verified,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
    documents: row.documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      label: doc.label,
      storedFileId: doc.storedFileId,
      fileName: doc.storedFile.fileName,
      createdAt: doc.createdAt.toISOString(),
    })),
  };
}

export async function getEmployeePriorEmploymentYtds(
  employeeId: string,
  taxYear?: number,
  options?: {
    /** Include supporting documents (default true). Calc/YTD can skip. */
    includeDocuments?: boolean;
  },
): Promise<{
  taxYear: number;
  records: PriorEmploymentYtdRecord[];
  totals: PriorEmploymentYtdTotals;
  /** Verified ACTIVE only — use for payslip / pay-run PAYE inputs. */
  verifiedTotals: PriorEmploymentYtdTotals;
}> {
  const year =
    taxYear ?? taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));
  const includeDocuments = options?.includeDocuments !== false;

  const rows = await prisma.employeePriorEmploymentYtd.findMany({
    where: {
      employeeId,
      taxYear: year,
      status: { in: ["ACTIVE", "DRAFT"] },
    },
    orderBy: [{ asOfDate: "desc" }, { createdAt: "desc" }],
    include: includeDocuments
      ? {
          documents: {
            orderBy: { createdAt: "asc" },
            include: {
              storedFile: {
                select: { fileName: true },
              },
            },
          },
        }
      : undefined,
  });

  const activeForTotals = rows.filter((row) => row.status === "ACTIVE");
  const amountRows = activeForTotals.map((row) => ({
    taxableIncomeYtd: Number(row.taxableIncomeYtd.toString()),
    payeDeductedYtd: Number(row.payeDeductedYtd.toString()),
    nisEmployeeYtd:
      row.nisEmployeeYtd != null ? Number(row.nisEmployeeYtd.toString()) : 0,
    nisEmployerYtd:
      row.nisEmployerYtd != null ? Number(row.nisEmployerYtd.toString()) : 0,
    healthSurchargeYtd:
      row.healthSurchargeYtd != null
        ? Number(row.healthSurchargeYtd.toString())
        : 0,
    otherApprovedDeductionsYtd:
      row.otherApprovedDeductionsYtd != null
        ? Number(row.otherApprovedDeductionsYtd.toString())
        : 0,
    verified: row.verified,
  }));
  const totals = aggregatePriorEmploymentYtd(amountRows);
  const verifiedTotals = aggregatePriorEmploymentYtd(amountRows, {
    verifiedOnly: true,
  });

  return {
    taxYear: year,
    records: rows.map((row) =>
      mapRecord({
        ...row,
        documents: includeDocuments
          ? (
              row as typeof row & {
                documents: Array<{
                  id: string;
                  documentType: string;
                  label: string | null;
                  storedFileId: string;
                  createdAt: Date;
                  storedFile: { fileName: string };
                }>;
              }
            ).documents
          : [],
      }),
    ),
    totals,
    verifiedTotals,
  };
}

/** Totals-only prior YTD — no documents, ACTIVE only (calc / breakdown). */
export async function getEmployeePriorEmploymentTotals(
  employeeId: string,
  taxYear: number,
  options?: { verifiedOnly?: boolean },
): Promise<PriorEmploymentYtdTotals> {
  const rows = await prisma.employeePriorEmploymentYtd.findMany({
    where: {
      employeeId,
      taxYear,
      status: "ACTIVE",
      ...(options?.verifiedOnly ? { verified: true } : {}),
    },
    select: {
      taxableIncomeYtd: true,
      payeDeductedYtd: true,
      nisEmployeeYtd: true,
      nisEmployerYtd: true,
      healthSurchargeYtd: true,
      otherApprovedDeductionsYtd: true,
      verified: true,
    },
  });

  return aggregatePriorEmploymentYtd(
    rows.map((row) => ({
      taxableIncomeYtd: Number(row.taxableIncomeYtd.toString()),
      payeDeductedYtd: Number(row.payeDeductedYtd.toString()),
      nisEmployeeYtd:
        row.nisEmployeeYtd != null
          ? Number(row.nisEmployeeYtd.toString())
          : 0,
      nisEmployerYtd:
        row.nisEmployerYtd != null
          ? Number(row.nisEmployerYtd.toString())
          : 0,
      healthSurchargeYtd:
        row.healthSurchargeYtd != null
          ? Number(row.healthSurchargeYtd.toString())
          : 0,
      otherApprovedDeductionsYtd:
        row.otherApprovedDeductionsYtd != null
          ? Number(row.otherApprovedDeductionsYtd.toString())
          : 0,
      verified: row.verified,
    })),
  );
}

/**
 * Verified ACTIVE prior YTD only — used by payslip / pay-run calc.
 * Unverified rows remain on file for preview but do not enter withholding.
 */
export async function getEmployeeVerifiedPriorEmploymentTotals(
  employeeId: string,
  taxYear: number,
): Promise<PriorEmploymentYtdTotals> {
  return getEmployeePriorEmploymentTotals(employeeId, taxYear, {
    verifiedOnly: true,
  });
}
