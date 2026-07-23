import { describe, expect, it } from "vitest";

import {
  FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS,
  FirstCitizensImportDisabledAdapter,
  FirstCitizensManualWorksheetAdapter,
  buildFirstCitizensManualCsv,
  mapDetailToFirstCitizensEntry,
  parseFirstCitizensConfiguration,
} from "./first-citizens-export";
import {
  previewPaymentInstructionImport,
  rowsFromDelimitedMatrix,
} from "./payment-instruction-import";
import {
  validatePaymentInstructionAllocation,
  type PaymentInstructionLike,
} from "./payment-instructions";
import { buildPaymentReadinessSummary } from "./payment-readiness";
import { resolveBankExportAdapter } from "./bank-export-adapter";

function instruction(
  partial: Partial<PaymentInstructionLike> & Pick<PaymentInstructionLike, "id">,
): PaymentInstructionLike {
  return {
    employeeId: "e1",
    accountHolderName: "Test",
    financialInstitutionId: null,
    bankName: "First Citizens",
    routingNumber: "FCB",
    branchCode: null,
    branchName: null,
    accountNumberLastFour: "1234",
    accountType: "SAVINGS",
    allocationMethod: "REMAINING",
    allocationValue: null,
    priority: 0,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    isActive: true,
    verificationStatus: "VERIFIED",
    isVerified: true,
    dataSource: "MANUAL",
    changeReason: null,
    ...partial,
  };
}

describe("payment instruction allocation", () => {
  it("supports one employee with one remaining account", () => {
    const result = validatePaymentInstructionAllocation(
      [instruction({ id: "a1", accountNumberLastFour: "1111" })],
      1000,
    );
    expect(result.ok).toBe(true);
    expect(result.remainderAmount).toBe(1000);
  });

  it("supports fixed plus remaining balance", () => {
    const result = validatePaymentInstructionAllocation(
      [
        instruction({
          id: "a1",
          allocationMethod: "FIXED",
          allocationValue: 250,
          accountNumberLastFour: "1111",
          priority: 0,
        }),
        instruction({
          id: "a2",
          allocationMethod: "REMAINING",
          accountNumberLastFour: "2222",
          priority: 1,
        }),
      ],
      1000.5,
    );
    expect(result.ok).toBe(true);
    expect(result.remainderAmount).toBe(750.5);
    expect(result.totalAllocated).toBe(1000.5);
  });

  it("supports multiple percentage allocations with remainder absorbing rounding", () => {
    const result = validatePaymentInstructionAllocation(
      [
        instruction({
          id: "a1",
          allocationMethod: "PERCENTAGE",
          allocationValue: 33.33,
          accountNumberLastFour: "1111",
          priority: 0,
        }),
        instruction({
          id: "a2",
          allocationMethod: "PERCENTAGE",
          allocationValue: 33.33,
          accountNumberLastFour: "2222",
          priority: 1,
        }),
        instruction({
          id: "a3",
          allocationMethod: "REMAINING",
          accountNumberLastFour: "3333",
          priority: 2,
        }),
      ],
      100,
    );
    expect(result.ok).toBe(true);
    expect(result.totalAllocated).toBe(100);
  });

  it("blocks missing instructions and expired rows", () => {
    const missing = validatePaymentInstructionAllocation([], 100);
    expect(missing.ok).toBe(false);

    const expired = validatePaymentInstructionAllocation(
      [
        instruction({
          id: "a1",
          effectiveTo: new Date("2020-01-01"),
        }),
      ],
      100,
      new Date("2026-01-01"),
    );
    expect(expired.ok).toBe(false);
  });

  it("blocks duplicate destination accounts", () => {
    const result = validatePaymentInstructionAllocation(
      [
        instruction({
          id: "a1",
          allocationMethod: "FIXED",
          allocationValue: 10,
          accountNumberLastFour: "9999",
          routingNumber: "ABA1",
        }),
        instruction({
          id: "a2",
          allocationMethod: "REMAINING",
          accountNumberLastFour: "9999",
          routingNumber: "ABA1",
        }),
      ],
      100,
    );
    expect(result.ok).toBe(false);
    expect(result.blockingErrors.some((msg) => /Duplicate/.test(msg))).toBe(
      true,
    );
  });
});

describe("payment readiness", () => {
  it("blocks batch total mismatch", () => {
    const summary = buildPaymentReadinessSummary({
      payRunReference: "PAY-1",
      employeeCount: 1,
      paymentEntryCount: 1,
      payrollNetTotal: 100,
      achBatchTotal: 99.5,
    });
    expect(summary.readyForApproval).toBe(false);
    expect(summary.difference).toBe(-0.5);
  });
});

describe("First Citizens manual worksheet", () => {
  it("emits template column order", () => {
    const config = parseFirstCitizensConfiguration({});
    const entry = mapDetailToFirstCitizensEntry(
      {
        sequence: 1,
        employeeNumber: "19",
        employeeName: "Jane Doe",
        bankName: "First Citizens",
        accountNumber: "123456789",
        accountNumberMasked: "••••6789",
        amount: 100,
        currencyCode: "TTD",
        allocationKind: "REMAINDER",
        beneficiaryName: "Jane Doe",
      },
      config,
      { accountType: "SAVINGS", purposeCode: "COMPENSATION OF EMPLOYEES" },
    );
    const csv = buildFirstCitizensManualCsv([entry]);
    const header = csv.split("\n")[0] ?? "";
    for (const column of FIRST_CITIZENS_MANUAL_ENTRY_COLUMNS) {
      expect(header).toContain(column);
    }
    expect(header.indexOf("Individual Name")).toBeLessThan(
      header.indexOf("Addenda"),
    );
    expect(csv).toContain("Jane Doe");
    expect(csv).toContain("Savings Credit");
  });

  it("validates consistent purpose codes via adapter", () => {
    const adapter = new FirstCitizensManualWorksheetAdapter();
    const result = adapter.validate({
      batchNumber: "ACH-1",
      runNumber: "PAY-1",
      currencyCode: "TTD",
      configurationJson: {},
      details: [
        {
          sequence: 1,
          employeeNumber: "1",
          employeeName: "A",
          bankName: "FCB",
          accountNumber: "1111",
          accountNumberMasked: "••••1111",
          amount: 10,
          currencyCode: "TTD",
          allocationKind: "REMAINDER",
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("disables First Citizens import file generation", () => {
    const adapter = new FirstCitizensImportDisabledAdapter();
    const validation = adapter.validate({
      batchNumber: "ACH-1",
      runNumber: "PAY-1",
      currencyCode: "TTD",
      configurationJson: {},
      details: [],
    });
    expect(validation.ok).toBe(false);
    expect(() =>
      adapter.generate({
        batchNumber: "ACH-1",
        runNumber: "PAY-1",
        currencyCode: "TTD",
        configurationJson: {},
        details: [],
      }),
    ).toThrow(/disabled/i);

    const resolved = resolveBankExportAdapter("FIRST_CITIZENS_IMPORT");
    expect(resolved.kind).toBe("FIRST_CITIZENS_IMPORT");
  });
});

describe("payment instruction import preview", () => {
  it("validates columns, duplicates, and CREATE_ONLY overwrite protection", () => {
    const matrix = [
      [
        "Employee Number",
        "Account Holder Name",
        "Financial Institution",
        "ABA/Routing Number",
        "Branch/Transit",
        "Account Number",
        "Account Type",
        "Allocation Method",
        "Allocation Value",
        "Priority",
        "Effective Start Date",
        "Effective End Date",
        "Verification Status",
      ],
      [
        "19",
        "Devon Dumas",
        "First Citizens",
        "FCB",
        "",
        "1234567890",
        "Savings",
        "Remaining",
        "",
        "0",
        "2026-01-01",
        "",
        "VERIFIED",
      ],
      [
        "19",
        "Devon Dumas",
        "First Citizens",
        "FCB",
        "",
        "1234567890",
        "Savings",
        "Remaining",
        "",
        "0",
        "2026-01-01",
        "",
        "VERIFIED",
      ],
    ];
    const mapped = rowsFromDelimitedMatrix(matrix);
    expect(mapped.headersOk).toBe(true);
    if (!mapped.headersOk) {
      return;
    }
    const preview = previewPaymentInstructionImport({
      rows: mapped.rows,
      mode: "CREATE_ONLY",
      knownEmployeeNumbers: new Set(["19"]),
      existingActiveKeys: new Set(["19|1234567890"]),
    });
    expect(preview.ok).toBe(false);
    expect(
      preview.issues.some((issue) => issue.code === "ACTIVE_EXISTS"),
    ).toBe(true);
    expect(
      preview.issues.some((issue) => issue.code === "DUPLICATE_IN_FILE"),
    ).toBe(true);
  });
});
