import { describe, expect, it } from "vitest";

import {
  AchRecordValidationError,
  buildFcbLegacyAchRecord,
  detectAchReceiverNameWarnings,
  formatAchAccountNumber,
  formatAchAmountCents,
  formatAchReceiverName,
  formatAchSalaryReference,
  normalizeAchRoutingNumber,
} from "@/src/modules/payroll/lib/ach/ach-record-builder";
import { parseFcbLegacyAchRecord } from "@/src/modules/payroll/lib/ach/ach-record-parser";
import {
  DEFAULT_ACH_EXPORT_SETTINGS,
  parseAchExportSettings,
} from "@/src/modules/payroll/lib/ach/ach-settings";
import {
  assertValidTraceNumber,
  buildConfiguredPrefixTrace,
  odfiTracePrefix,
} from "@/src/modules/payroll/lib/ach/ach-trace-number";
import { resolveAchCreditTransactionCode } from "@/src/modules/payroll/lib/ach/ach-transaction-code";
import {
  assembleAchValidationSummary,
  type AchCandidateRow,
} from "@/src/modules/payroll/lib/ach/ach-validation";
import { exportFcbLegacyNachaNoHeader } from "@/src/modules/payroll/lib/ach/fcb-legacy-exporter";
import {
  FCB_LEGACY_LINE_ENDING,
  FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
  buildFcbAchSalaryFileName,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";

const ODFI = "010100013";

function baseRow(
  overrides: Partial<AchCandidateRow> = {},
): AchCandidateRow {
  return {
    sequence: 1,
    employeeId: "emp-1",
    employeeNumber: "1001",
    employeeName: "Kirt Baynes",
    bankName: "Scotiabank",
    routingNumber: "010100026",
    accountNumber: "211054007990",
    accountNumberMasked: "••••7990",
    accountType: "SAVINGS",
    paymentType: "Savings Credit",
    beneficiaryName: "Kirt Baynes",
    amount: 49.25,
    currencyCode: "TTD",
    ...overrides,
  };
}

describe("fcb-legacy-format", () => {
  it("builds FCB_ACH_SALARY_YYYYMMDD.txt", () => {
    expect(buildFcbAchSalaryFileName("2026-08-31")).toBe(
      "FCB_ACH_SALARY_20260831.txt",
    );
  });
});

describe("routing numbers", () => {
  it("accepts FCB / Scotia / RBC / RBL style 9-digit ABAs including leading zeros", () => {
    expect(normalizeAchRoutingNumber("010100013")).toBe("010100013");
    expect(normalizeAchRoutingNumber("010100026")).toBe("010100026");
    expect(normalizeAchRoutingNumber("010100039")).toBe("010100039");
    expect(normalizeAchRoutingNumber("010100042")).toBe("010100042");
  });

  it("rejects bad lengths", () => {
    expect(normalizeAchRoutingNumber("10100013")).toBeNull();
    expect(normalizeAchRoutingNumber("0101000139")).toBeNull();
    expect(normalizeAchRoutingNumber("")).toBeNull();
  });
});

describe("account numbers", () => {
  it("right-pads short accounts and preserves leading zeros", () => {
    expect(formatAchAccountNumber("2977062")).toBe("2977062          ");
    expect(formatAchAccountNumber("0001234567")).toBe("0001234567       ");
    expect(formatAchAccountNumber("12345678901234567")).toHaveLength(17);
  });

  it("rejects accounts longer than 17 digits", () => {
    expect(() => formatAchAccountNumber("123456789012345678")).toThrow(
      AchRecordValidationError,
    );
  });
});

describe("amounts", () => {
  it("formats cents from money examples", () => {
    expect(formatAchAmountCents(49.25)).toBe("0000004925");
    expect(formatAchAmountCents(7878.75)).toBe("0000787875");
    expect(formatAchAmountCents(14492)).toBe("0001449200");
  });

  it("rejects non-positive and overflow amounts", () => {
    expect(formatAchAmountCents(0)).toBeNull();
    expect(formatAchAmountCents(-1)).toBeNull();
  });
});

describe("receiver names", () => {
  it("formats short, 22-char, long, hyphen, apostrophe, and lower→upper", () => {
    expect(formatAchReceiverName("Kirt Baynes")).toBe(
      "KIRT  BAYNES          ",
    );
    expect(formatAchReceiverName("Natalie Maxwell-Regis")).toBe(
      "NATALIE  MAXWELL-REGIS",
    );
    expect(formatAchReceiverName("O'Brien Smith")).toBe(
      "O'BRIEN  SMITH        ",
    );
    expect(formatAchReceiverName("akeisha noray - hector").length).toBe(22);
  });

  it("warns on unsupported characters", () => {
    const warnings = detectAchReceiverNameWarnings("José García");
    expect(warnings.some((w) => /non-ASCII/i.test(w))).toBe(true);
  });
});

describe("salary reference", () => {
  it("is exactly 15 characters", () => {
    expect(formatAchSalaryReference("2026-08-31")).toBe("SALARY 20260831");
    expect(formatAchSalaryReference("2026-08-31").length).toBe(15);
  });
});

describe("transaction codes", () => {
  it("maps savings/chequing and honours force override", () => {
    expect(
      resolveAchCreditTransactionCode({
        accountType: "SAVINGS",
        settings: DEFAULT_ACH_EXPORT_SETTINGS,
      }),
    ).toBe("32");
    expect(
      resolveAchCreditTransactionCode({
        accountType: "CHEQUING",
        settings: DEFAULT_ACH_EXPORT_SETTINGS,
      }),
    ).toBe("22");
    expect(
      resolveAchCreditTransactionCode({
        accountType: "UNKNOWN",
        settings: DEFAULT_ACH_EXPORT_SETTINGS,
      }),
    ).toBeNull();
    expect(
      resolveAchCreditTransactionCode({
        accountType: "UNKNOWN",
        settings: {
          ...DEFAULT_ACH_EXPORT_SETTINGS,
          transactionCodePolicy: "FORCE_LEGACY_CODE",
          legacyTransactionCode: "32",
        },
      }),
    ).toBe("32");
  });
});

describe("trace numbers", () => {
  it("builds configured prefix + sequence traces", () => {
    expect(odfiTracePrefix(ODFI)).toBe("01010001");
    expect(buildConfiguredPrefixTrace(ODFI, 1)).toBe("010100010000001");
    expect(buildConfiguredPrefixTrace(ODFI, 42)).toBe("010100010000042");
  });

  it("validates length and numeric-only", () => {
    expect(() => assertValidTraceNumber("010100010000001")).not.toThrow();
    expect(() => assertValidTraceNumber("01010001000001")).toThrow();
    expect(() => assertValidTraceNumber("01010001ABCDEFG")).toThrow();
  });
});

describe("record builder + parser round-trip", () => {
  it("builds a 94-char type-6 and parses it back", () => {
    const record = buildFcbLegacyAchRecord({
      transactionCode: "32",
      routingNumber: "010100026",
      accountNumber: "211054007990",
      amount: 49.25,
      individualId: "SALARY 20260831",
      receiverName: "Kirt Baynes",
      traceNumber: "010100010000001",
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

    const parsed = parseFcbLegacyAchRecord(record);
    expect(parsed.transactionCode).toBe("32");
    expect(parsed.routingNumber).toBe("010100026");
    expect(parsed.accountNumber).toBe("211054007990");
    expect(parsed.amountDecimal).toBe(49.25);
    expect(parsed.identification).toBe("SALARY 20260831");
    expect(parsed.receiverName).toBe("KIRT  BAYNES");
    expect(parsed.traceNumber).toBe("010100010000001");
  });
});

describe("EasyPay fixed-position regression (trace ≠ payroll period)", () => {
  const EASYPAY_KIRT =
    "632010100026211054007990     0000004925SALARY 20260831KIRT  BAYNES            0023997975202608";

  it("parses the confirmed EasyPay sample by exact positions", () => {
    expect(EASYPAY_KIRT).toHaveLength(94);

    // Zero-based slices ↔ ACH 1-based positions (documented in fcb-legacy-format).
    expect(EASYPAY_KIRT.substring(0, 1)).toBe("6"); // pos 1
    expect(EASYPAY_KIRT.substring(1, 3)).toBe("32"); // pos 2–3
    expect(EASYPAY_KIRT.substring(3, 12)).toBe("010100026"); // pos 4–12
    expect(EASYPAY_KIRT.substring(12, 29)).toBe("211054007990     "); // pos 13–29
    expect(EASYPAY_KIRT.substring(29, 39)).toBe("0000004925"); // pos 30–39
    expect(EASYPAY_KIRT.substring(39, 54)).toBe("SALARY 20260831"); // pos 40–54
    expect(EASYPAY_KIRT.substring(54, 76)).toBe("KIRT  BAYNES          "); // pos 55–76
    expect(EASYPAY_KIRT.substring(76, 78)).toBe("  "); // pos 77–78
    expect(EASYPAY_KIRT.substring(78, 79)).toBe("0"); // pos 79
    expect(EASYPAY_KIRT.substring(79, 94)).toBe("023997975202608"); // pos 80–94

    const parsed = parseFcbLegacyAchRecord(EASYPAY_KIRT);
    expect(parsed.amountInCents).toBe("0000004925");
    expect(parsed.achIndividualIdentification).toBe("SALARY 20260831");
    expect(parsed.payrollPaymentDate).toBe("2026-08-31");
    expect(parsed.achTraceNumber).toBe("023997975202608");
    expect(parsed.traceNumber).toBe("023997975202608");

    // CRITICAL: do not interpret trailing digits of the trace as YYYYMM.
    expect(parsed.achTraceNumber.endsWith("202608")).toBe(true);
    expect(parsed.payrollPaymentDate).not.toBe("2026-08-01");
    expect(parsed.payrollPaymentDate).toBe("2026-08-31"); // from SALARY field only
  });

  it("rebuilds the EasyPay sample from discrete fields", () => {
    const record = buildFcbLegacyAchRecord({
      transactionCode: "32",
      routingNumber: "010100026",
      accountNumber: "211054007990",
      amount: 49.25,
      individualId: "SALARY 20260831",
      receiverName: "Kirt Baynes",
      discretionaryData: "  ",
      addendaIndicator: "0",
      traceNumber: "023997975202608",
      employeeLabel: "KIRT BAYNES",
    });
    expect(record).toBe(EASYPAY_KIRT);
  });

  it("keeps payment date in SALARY field while traces vary across employees", () => {
    const samples = [
      {
        line: EASYPAY_KIRT,
        trace: "023997975202608",
      },
      {
        // Synthetic sibling: same SALARY date, different opaque trace ending
        // (mirrors EasyPay variance such as …0028998954202608 / …0023998336420260).
        line: buildFcbLegacyAchRecord({
          transactionCode: "32",
          routingNumber: "010100013",
          accountNumber: "2977062",
          amount: 7878.75,
          individualId: "SALARY 20260831",
          receiverName: "Akeil Andrews",
          traceNumber: "028998954202608",
          employeeLabel: "AKEIL ANDREWS",
        }),
        trace: "028998954202608",
      },
      {
        line: buildFcbLegacyAchRecord({
          transactionCode: "22",
          routingNumber: "010100039",
          accountNumber: "0001234567",
          amount: 100,
          individualId: "SALARY 20260831",
          receiverName: "Sample Three",
          // EasyPay-style opaque traces (15 digits). Sample tails like
          // `0` + `023998336420260` were sometimes misread as including addenda.
          traceNumber: "023998336420260",
          employeeLabel: "SAMPLE THREE",
        }),
        trace: "023998336420260",
      },
    ];

    for (const sample of samples) {
      expect(sample.line).toHaveLength(94);
      const parsed = parseFcbLegacyAchRecord(sample.line);
      expect(parsed.achIndividualIdentification).toBe("SALARY 20260831");
      expect(parsed.payrollPaymentDate).toBe("2026-08-31");
      expect(parsed.achTraceNumber).toBe(sample.trace);
      // Trace is not a source of period — only the whole 15 digits matter.
      expect(parsed.achTraceNumber).toHaveLength(15);
    }
  });

  it("names the employee when record length validation fails", () => {
    expect(() =>
      buildFcbLegacyAchRecord({
        transactionCode: "32",
        routingNumber: "010100026",
        accountNumber: "211054007990",
        amount: 49.25,
        individualId: "SALARY 20260831",
        receiverName: "Kirt Baynes",
        traceNumber: "123", // too short
        employeeLabel: "KIRT BAYNES",
      }),
    ).toThrow(/ACH record validation failed for KIRT BAYNES/);
  });
});

describe("validation + exporter", () => {
  it("blocks silent omission when a row fails validation", () => {
    const summary = assembleAchValidationSummary({
      rows: [
        baseRow(),
        baseRow({
          sequence: 2,
          employeeId: "emp-2",
          employeeNumber: "1002",
          routingNumber: "123",
          amount: 10,
        }),
      ],
      settings: { ...DEFAULT_ACH_EXPORT_SETTINGS, allowExportWithWarnings: true },
      paymentDate: "2026-08-31",
    });
    expect(summary.errorCount).toBe(1);
    expect(summary.blockingErrors.length).toBeGreaterThan(0);
  });

  it("blocks control total mismatch path via empty included set", () => {
    const summary = assembleAchValidationSummary({
      rows: [baseRow({ excluded: true })],
      settings: DEFAULT_ACH_EXPORT_SETTINGS,
      paymentDate: "2026-08-31",
    });
    expect(summary.blockingErrors.join(" ")).toMatch(/No employees/);
  });

  it("exports CRLF file with no BOM/headers and all lines 94", async () => {
    const settings = parseAchExportSettings({
      ...DEFAULT_ACH_EXPORT_SETTINGS,
      enabled: true,
      allowExportWithWarnings: true,
    });
    const exported = await exportFcbLegacyNachaNoHeader({
      rows: [
        baseRow({ sequence: 1, traceNumber: "010100010000001" }),
        baseRow({
          sequence: 2,
          employeeId: "emp-2",
          employeeNumber: "1002",
          employeeName: "Akeil Andrews",
          beneficiaryName: "Akeil Andrews",
          routingNumber: "010100013",
          accountNumber: "2977062",
          amount: 7878.75,
          traceNumber: "010100010000002",
        }),
      ],
      settings: {
        ...settings,
        exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
      },
      paymentDate: "2026-08-31",
      currencyCode: "TTD",
      traceGenerator: {
        peekNext: async () => [],
        allocate: async () => [],
      },
      reuseExistingTraces: true,
    });

    expect(exported.fileName).toBe("FCB_ACH_SALARY_20260831.txt");
    expect(exported.content.startsWith("\uFEFF")).toBe(false);
    expect(exported.content.includes(FCB_LEGACY_LINE_ENDING)).toBe(true);
    const lines = exported.content.split(FCB_LEGACY_LINE_ENDING).filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.length === 94)).toBe(true);
    expect(exported.controlTotalAmount).toBe(7928);

    for (const line of lines) {
      const parsed = parseFcbLegacyAchRecord(line);
      expect(parsed.recordType).toBe("6");
    }
  });

  it("round-trips anonymised sample layout fields", async () => {
    const settings = {
      ...DEFAULT_ACH_EXPORT_SETTINGS,
      allowExportWithWarnings: true,
    };
    const exported = await exportFcbLegacyNachaNoHeader({
      rows: [
        baseRow({
          employeeName: "Sample One",
          beneficiaryName: "Sample One",
          routingNumber: "010100903",
          accountNumber: "200002659431",
          amount: 14492,
          accountType: "SAVINGS",
          traceNumber: "010100010000019",
        }),
      ],
      settings,
      paymentDate: "2026-08-31",
      traceGenerator: {
        peekNext: async () => [],
        allocate: async () => [],
      },
      reuseExistingTraces: true,
    });
    const line = exported.content.split(FCB_LEGACY_LINE_ENDING)[0]!;
    const parsed = parseFcbLegacyAchRecord(line);
    expect(parsed.routingNumber).toBe("010100903");
    expect(parsed.accountNumber).toBe("200002659431");
    expect(parsed.amountDecimal).toBe(14492);
    expect(parsed.identification).toBe("SALARY 20260831");
  });
});
