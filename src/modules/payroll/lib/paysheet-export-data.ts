import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import type { PayRunPaysheetData } from "@/src/modules/payroll/data/get-pay-run-paysheet";

export type PaysheetNisExportRow = {
  employeeNumber: string;
  employeeName: string;
  classLabel: string;
  weeksInPeriod: number;
  employeeWeekly: number;
  employerWeekly: number;
};

export type PaysheetBankExportRow = {
  employeeNumber: string;
  employeeName: string;
  bankName: string;
  accountNumber: string;
  accountType: string | null;
  splitType: string;
  amount: number;
};

export type PayRunPaysheetWorkbookData = PayRunPaysheetData & {
  nisRows: PaysheetNisExportRow[];
  bankRows: PaysheetBankExportRow[];
};

function splitTypeLabel(kind: string): string {
  switch (kind) {
    case "FIXED":
      return "Fixed amount";
    case "PERCENTAGE":
      return "Percentage";
    case "REMAINDER":
      return "Remainder";
    default:
      return kind;
  }
}

/** Weekly NIS rates from a frozen payslip snapshot. */
export function extractNisWeeklyFromSnapshot(snapshot: unknown): Omit<
  PaysheetNisExportRow,
  "employeeNumber" | "employeeName"
> {
  const parsed = parsePayslipSnapshot(snapshot);
  const nis = parsed?.payslip.nis;

  if (!nis || nis.category === "EXEMPT") {
    return {
      classLabel: "—",
      weeksInPeriod: nis?.weeksInPeriod ?? 0,
      employeeWeekly: 0,
      employerWeekly: 0,
    };
  }

  if (nis.category === "CLASS_Z") {
    return {
      classLabel: "Z",
      weeksInPeriod: nis.weeksInPeriod,
      employeeWeekly: 0,
      employerWeekly: nis.classZEmployerWeekly ?? 0,
    };
  }

  return {
    classLabel: nis.classCode ?? "—",
    weeksInPeriod: nis.weeksInPeriod,
    employeeWeekly: nis.employeeWeekly ?? 0,
    employerWeekly: nis.employerWeekly ?? 0,
  };
}

/** Bank allocation lines from a frozen payslip snapshot. */
export function extractBankRowsFromSnapshot(
  snapshot: unknown,
  identity: { employeeNumber: string; employeeName: string; netPay: number },
): PaysheetBankExportRow[] {
  const parsed = parsePayslipSnapshot(snapshot);
  const paymentMethod = parsed?.payslip.period.paymentMethod ?? "";
  const distribution = parsed?.payslip.bankDistribution ?? [];

  if (distribution.length > 0) {
    return distribution
      .filter((line) => line.amount > 0)
      .map((line) => ({
        employeeNumber: identity.employeeNumber,
        employeeName: identity.employeeName,
        bankName: line.bankName,
        accountNumber: line.accountNumber?.trim() || line.accountNumberMasked,
        accountType: line.accountType?.trim() || null,
        splitType: splitTypeLabel(line.kind),
        amount: line.amount,
      }));
  }

  if (identity.netPay <= 0) {
    return [];
  }

  if (/cash/i.test(paymentMethod)) {
    return [
      {
        employeeNumber: identity.employeeNumber,
        employeeName: identity.employeeName,
        bankName: "Cash",
        accountNumber: "—",
        accountType: null,
        splitType: "Cash",
        amount: identity.netPay,
      },
    ];
  }

  return [
    {
      employeeNumber: identity.employeeNumber,
      employeeName: identity.employeeName,
      bankName: "—",
      accountNumber: "No bank on file",
      accountType: null,
      splitType: "—",
      amount: identity.netPay,
    },
  ];
}

export function buildPaysheetWorkbookData(input: {
  paysheet: PayRunPaysheetData;
  snapshots: Array<{
    employeeNumber: string;
    employeeName: string;
    netPay: number;
    snapshot: unknown;
  }>;
}): PayRunPaysheetWorkbookData {
  const snapshotByEmployeeNumber = new Map(
    input.snapshots.map((row) => [row.employeeNumber, row]),
  );

  const nisRows: PaysheetNisExportRow[] = input.paysheet.rows.map((row) => {
    const slip = snapshotByEmployeeNumber.get(row.employeeNumber);
    const weekly = extractNisWeeklyFromSnapshot(slip?.snapshot);
    return {
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      ...weekly,
    };
  });

  const bankRows: PaysheetBankExportRow[] = input.paysheet.rows.flatMap((row) => {
    const slip = snapshotByEmployeeNumber.get(row.employeeNumber);
    return extractBankRowsFromSnapshot(slip?.snapshot ?? null, {
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      netPay: row.netPay,
    });
  });

  return {
    ...input.paysheet,
    nisRows,
    bankRows,
  };
}
