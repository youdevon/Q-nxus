import { Buffer as NodeBuffer } from "node:buffer";
import { describe, expect, it } from "vitest";

import { buildPayRunPaysheetXlsx } from "./paysheet-xlsx-export";
import type { PayRunPaysheetWorkbookData } from "@/src/modules/payroll/data/get-pay-run-paysheet";

const sampleWorkbook: PayRunPaysheetWorkbookData = {
  payRunId: "run-1",
  runNumber: "PAY-000002",
  status: "POSTED",
  statusLabel: "Posted",
  runKind: "REGULAR",
  currency: "TTD",
  organizationName: "Acme Ltd",
  periodName: "August 2026",
  periodKey: "2026-08",
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
  isPreview: false,
  includedCount: 1,
  excludedCount: 0,
  rows: [
    {
      employeeNumber: "11",
      employeeName: "Joan Paulson-Wilson",
      departmentName: "Admin",
      jobTitle: "Director",
      baseSalary: 25000,
      allowancesTotal: 0,
      grossPay: 25000,
      paye: 4847,
      nisEmployee: 0,
      healthSurcharge: 0,
      otherDeductions: 0,
      totalDeductions: 4847,
      netPay: 20153,
      nisEmployer: 127.15,
      nisPayment: 127.15,
      status: "POSTED",
      isExcluded: false,
      exclusionReason: null,
    },
  ],
  excludedRows: [],
  totals: {
    baseSalary: 25000,
    allowancesTotal: 0,
    grossPay: 25000,
    paye: 4847,
    nisEmployee: 0,
    healthSurcharge: 0,
    otherDeductions: 0,
    totalDeductions: 4847,
    netPay: 20153,
    nisEmployer: 127.15,
    nisPayment: 127.15,
  },
  nisRows: [
    {
      employeeNumber: "11",
      employeeName: "Joan Paulson-Wilson",
      classLabel: "Z",
      weeksInPeriod: 5,
      employeeWeekly: 0,
      employerWeekly: 25.43,
    },
  ],
  bankRows: [
    {
      employeeNumber: "11",
      employeeName: "Joan Paulson-Wilson",
      bankName: "Republic Bank",
      accountNumber: "****1234",
      accountType: "SAVINGS",
      splitType: "Remainder",
      amount: 20153,
    },
  ],
};

describe("buildPayRunPaysheetXlsx", () => {
  it("builds a four-sheet workbook with formulas and sheet protection", async () => {
    const buffer = await buildPayRunPaysheetXlsx(sampleWorkbook);
    expect(buffer.byteLength).toBeGreaterThan(1000);

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as NodeBuffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Paysheet",
      "NIS contributions",
      "Bank disbursement",
      "Excluded employees",
    ]);

    const paysheet = workbook.getWorksheet("Paysheet");
    expect(paysheet?.pageSetup.printTitlesRow).toMatch(/^1:\d+$/);
    expect(paysheet?.sheetProtection).toBeTruthy();

    const nisSheet = workbook.getWorksheet("NIS contributions");
    expect(nisSheet).toBeDefined();

    let foundPaymentFormula = false;
    nisSheet!.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.formula === "string" && cell.formula.includes("+")) {
          foundPaymentFormula = true;
        }
      });
    });
    expect(foundPaymentFormula).toBe(true);

    const excludedSheet = workbook.getWorksheet("Excluded employees");
    let emptyMessage = false;
    excludedSheet?.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value === "No employees were excluded from this pay run.") {
          emptyMessage = true;
        }
      });
    });
    expect(emptyMessage).toBe(true);
  });

  it("adds a preview banner and print header for draft runs", async () => {
    const buffer = await buildPayRunPaysheetXlsx({
      ...sampleWorkbook,
      status: "DRAFT",
      statusLabel: "Draft",
      isPreview: true,
    });

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as NodeBuffer);

    const paysheet = workbook.getWorksheet("Paysheet");
    expect(paysheet?.getRow(1).getCell(1).value).toBe(
      "DRAFT / PREVIEW — NOT POSTED",
    );
    expect(paysheet?.headerFooter.oddHeader).toContain("DRAFT / PREVIEW");
  });

  it("lists excluded employees on the excluded sheet", async () => {
    const buffer = await buildPayRunPaysheetXlsx({
      ...sampleWorkbook,
      excludedCount: 1,
      excludedRows: [
        {
          employeeNumber: "99",
          employeeName: "Temp Worker",
          departmentName: "Ops",
          jobTitle: "Clerk",
          baseSalary: 0,
          allowancesTotal: 0,
          grossPay: 0,
          paye: 0,
          nisEmployee: 0,
          healthSurcharge: 0,
          otherDeductions: 0,
          totalDeductions: 0,
          netPay: 0,
          nisEmployer: 0,
          nisPayment: 0,
          status: "EXCLUDED",
          isExcluded: true,
          exclusionReason: "No active contract",
        },
      ],
    });

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as NodeBuffer);

    const excludedSheet = workbook.getWorksheet("Excluded employees");
    let found = false;
    excludedSheet?.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value === "No active contract") {
          found = true;
        }
      });
    });
    expect(found).toBe(true);
  });
});
