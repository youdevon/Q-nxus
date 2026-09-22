import { describe, expect, it } from "vitest";

import {
  FirstCitizensImportAdapter,
  buildFirstCitizensNachaType6File,
  buildNachaType6Record,
  formatNachaIndividualId,
  formatNachaIndividualName,
  resolveNachaCreditTransactionCode,
} from "./first-citizens-export";

describe("NACHA type-6 formatting", () => {
  it("formats individual names like live FCB samples", () => {
    expect(formatNachaIndividualName("Kirt Baynes")).toBe(
      "KIRT  BAYNES          ",
    );
    expect(formatNachaIndividualName("Natalie Maxwell-Regis")).toBe(
      "NATALIE  MAXWELL-REGIS",
    );
    expect(formatNachaIndividualName("Akeisha Noray - Hector")).toBe(
      "AKEISHA  NORAY - HECTO",
    );
    expect(formatNachaIndividualName("Kirt Baynes").length).toBe(22);
  });

  it("builds SALARY + pay-date individual IDs", () => {
    expect(formatNachaIndividualId("Salary", "2026-08-31")).toBe(
      "SALARY 20260831",
    );
    expect(formatNachaIndividualId("Salary", "2026-08-31").length).toBe(15);
  });

  it("maps savings/chequing to transaction codes 32/22", () => {
    expect(
      resolveNachaCreditTransactionCode("Savings Credit", "SAVINGS"),
    ).toBe("32");
    expect(
      resolveNachaCreditTransactionCode("Checking Credit", "CHEQUING"),
    ).toBe("22");
  });

  it("builds a 94-character type-6 record matching the sample layout", () => {
    const record = buildNachaType6Record({
      transactionCode: "32",
      abaNumber: "010100026",
      accountNumber: "211054007990",
      amount: 49.25,
      individualId: "SALARY 20260831",
      individualName: "Kirt Baynes",
      sequence: 1,
      odfiRoutingNumber: "010100013",
    });

    expect(record).toHaveLength(94);
    expect(record.slice(0, 3)).toBe("632");
    expect(record.slice(3, 12)).toBe("010100026");
    expect(record.slice(12, 29)).toBe("211054007990     ");
    expect(record.slice(29, 39)).toBe("0000004925");
    expect(record.slice(39, 54)).toBe("SALARY 20260831");
    expect(record.slice(54, 76)).toBe("KIRT  BAYNES          ");
    expect(record.slice(76, 79)).toBe("  0");
    expect(record.slice(79, 94)).toBe("010100010000001");
  });
});

describe("First Citizens NACHA file export", () => {
  it("emits CRLF type-6 lines and FCB_ACH_SALARY filename", () => {
    const built = buildFirstCitizensNachaType6File({
      effectivePaymentDate: "2026-08-31",
      fileDate: "2026-08-27",
      config: {
        companyAchId: "265001",
        entryDescription: "Salary",
        odfiRoutingNumber: "010100013",
      },
      details: [
        {
          sequence: 1,
          employeeNumber: "23997975",
          employeeName: "Kirt Baynes",
          bankName: "Scotiabank",
          accountNumber: "211054007990",
          accountNumberMasked: "••••7990",
          amount: 49.25,
          currencyCode: "TTD",
          allocationKind: "PRIMARY_REMAINDER",
          abaNumber: "010100026",
          accountType: "SAVINGS",
          paymentType: "Savings Credit",
        },
        {
          sequence: 2,
          employeeNumber: "28998954",
          employeeName: "Akeil Andrews",
          bankName: "First Citizens",
          accountNumber: "2977062",
          accountNumberMasked: "••••7062",
          amount: 7878.75,
          currencyCode: "TTD",
          allocationKind: "PRIMARY_REMAINDER",
          abaNumber: "010100013",
          accountType: "SAVINGS",
          paymentType: "Savings Credit",
        },
      ],
    });

    expect(built.fileName).toBe("FCB_ACH_SALARY_20260831.txt");
    expect(built.detailCount).toBe(2);
    expect(built.controlTotalAmount).toBe(7928);
    expect(built.content.endsWith("\r\n")).toBe(true);
    const lines = built.content.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.length === 94)).toBe(true);
    expect(lines[0]?.startsWith("632010100026")).toBe(true);
    expect(lines[1]?.startsWith("632010100013")).toBe(true);
  });

  it("generates through the import adapter when enabled", () => {
    const adapter = new FirstCitizensImportAdapter();
    const input = {
      batchNumber: "ACH-1",
      runNumber: "PAY-1",
      currencyCode: "TTD",
      effectivePaymentDate: "2026-08-31",
      configurationJson: {
        companyAchId: "265001",
        entryDescription: "Salary",
        importFileDisabled: false,
        odfiRoutingNumber: "010100013",
      },
      details: [
        {
          sequence: 1,
          employeeNumber: "19",
          employeeName: "Devon Dumas",
          bankName: "First Citizens",
          accountNumber: "200002659431",
          accountNumberMasked: "••••9431",
          amount: 14492,
          currencyCode: "TTD",
          allocationKind: "PRIMARY_REMAINDER",
          abaNumber: "010100903",
          accountType: "SAVINGS",
          paymentType: "Savings Credit",
        },
      ],
    };

    const validation = adapter.validate(input);
    expect(validation.ok).toBe(true);
    const generated = adapter.generate(input);
    expect(generated.mimeType).toContain("text/plain");
    expect(generated.fileName).toBe("FCB_ACH_SALARY_20260831.txt");
    expect(generated.content).toContain("632010100903");
  });

  it("does not block legacy no-header export on the old Default Transactions kill switch", () => {
    const adapter = new FirstCitizensImportAdapter();
    const validation = adapter.validate({
      batchNumber: "ACH-1",
      runNumber: "PAY-1",
      currencyCode: "TTD",
      effectivePaymentDate: "2026-08-31",
      configurationJson: {
        companyAchId: "265001",
        importFileDisabled: true,
        importDisabledReason: "Paused for bank testing",
        entryDescription: "Salary",
      },
      details: [
        {
          sequence: 1,
          employeeNumber: "19",
          employeeName: "Devon Dumas",
          bankName: "First Citizens",
          accountNumber: "200002659431",
          accountNumberMasked: "••••9431",
          amount: 14492,
          currencyCode: "TTD",
          allocationKind: "PRIMARY_REMAINDER",
          abaNumber: "010100903",
          accountType: "SAVINGS",
          paymentType: "Savings Credit",
        },
      ],
    });
    expect(validation.ok).toBe(true);
  });
});
