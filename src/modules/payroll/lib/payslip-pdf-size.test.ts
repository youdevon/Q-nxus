import { describe, expect, it } from "vitest";

import {
  PAYSLIP_PDF_LETTER_PORTRAIT_POINTS,
  renderPayslipsPdf,
  type PayslipPdfDocumentInput,
} from "@/src/modules/payroll/lib/payslip-pdf";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

const samplePayslip: PayslipPreview = {
  employee: {
    id: "emp-1",
    employeeNumber: "EMP-00001",
    displayName: "Ada Lovelace",
    nisNumber: "1234567",
    birNumber: "BIR-1",
  },
  period: {
    label: "June 2026",
    asOf: "2026-06-30T12:00:00.000Z",
    payFrequency: "MONTHLY",
    paymentMethod: "BANK_TRANSFER",
  },
  currency: "TTD",
  earnings: [{ label: "Base Salary", amount: 10_000 }],
  baseSalary: 10_000,
  allowancesTotal: 0,
  grossPay: 10_000,
  monthlyTaxableEarnings: 10_000,
  deductions: [
    { label: "NIS (employee)", amount: 500 },
    { label: "PAYE", amount: 800 },
    { label: "Health Surcharge", amount: 33 },
  ],
  totalDeductions: 1_333,
  netPay: 8_667,
  employerContributions: [],
  bankDistribution: null,
  nis: null,
  paye: null,
  health: null,
  readiness: { isReady: true, blockingIssues: [] },
  warnings: [],
  notes: [],
};

function parseMediaBox(
  pdf: Buffer,
): { width: number; height: number } | null {
  const text = pdf.toString("latin1");
  const match = text.match(
    /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/,
  );
  if (!match) {
    return null;
  }
  const x0 = Number(match[1]);
  const y0 = Number(match[2]);
  const x1 = Number(match[3]);
  const y1 = Number(match[4]);
  return {
    width: Math.round((x1 - x0) * 100) / 100,
    height: Math.round((y1 - y0) * 100) / 100,
  };
}

describe("payslip PDF page size", () => {
  it("renders Letter portrait (8.5in × 11in)", async () => {
    const documents: PayslipPdfDocumentInput[] = [
      {
        payslip: samplePayslip,
        meta: {
          organizationName: "Acme Ltd",
          jobTitle: "Engineer",
          departmentName: "Engineering",
        },
        ytd: null,
        isOfficial: true,
      },
    ];

    const pdf = await renderPayslipsPdf(documents);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const box = parseMediaBox(pdf);
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(PAYSLIP_PDF_LETTER_PORTRAIT_POINTS.width, 1);
    expect(box!.height).toBeCloseTo(
      PAYSLIP_PDF_LETTER_PORTRAIT_POINTS.height,
      1,
    );
    expect(box!.height).toBeGreaterThan(box!.width);
  });
});
