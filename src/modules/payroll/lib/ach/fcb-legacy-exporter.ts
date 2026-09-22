import { createHash } from "node:crypto";

import {
  buildFcbLegacyAchRecord,
  formatAchSalaryReference,
  AchRecordValidationError,
} from "@/src/modules/payroll/lib/ach/ach-record-builder";
import type { AchExportSettings } from "@/src/modules/payroll/lib/ach/ach-settings";
import type { AchTraceNumberGenerator } from "@/src/modules/payroll/lib/ach/ach-trace-number";
import {
  assembleAchValidationSummary,
  assertAchExportReady,
  type AchCandidateRow,
  type AchValidationSummary,
} from "@/src/modules/payroll/lib/ach/ach-validation";
import {
  FCB_LEGACY_LINE_ENDING,
  FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
  buildFcbAchSalaryFileName,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";

export type FcbLegacyExportEntry = {
  sequence: number;
  employeeId: string;
  employeeNumber: string;
  transactionCode: "22" | "32";
  routingNumber: string;
  accountNumberMasked: string;
  amount: number;
  salaryReference: string;
  receiverName: string;
  traceNumber: string;
  record: string;
};

export type FcbLegacyExportResult = {
  exportFormat: typeof FCB_TT_LEGACY_NACHA_NO_HEADER_V1;
  fileName: string;
  mimeType: string;
  content: string;
  contentHash: string;
  paymentDate: string;
  detailCount: number;
  controlTotalAmount: number;
  entries: FcbLegacyExportEntry[];
  validation: AchValidationSummary;
};

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * FCB TT Legacy NACHA – No Header V1 exporter.
 * Builds type-6 detail lines only (no 1/5/8/9 records).
 */
export async function exportFcbLegacyNachaNoHeader(input: {
  rows: AchCandidateRow[];
  settings: AchExportSettings;
  paymentDate: Date | string;
  currencyCode?: string;
  traceGenerator: AchTraceNumberGenerator;
  /** When regenerating with frozen traces already on rows, skip allocate. */
  reuseExistingTraces?: boolean;
  /** ACH banks from FinancialInstitution; required for known-bank gate in production. */
  routingRegistry?:
    | ReadonlyMap<string, import("@/src/modules/payroll/lib/ach/ach-routing").AchRoutingParticipant>
    | readonly import("@/src/modules/payroll/lib/ach/ach-participant-types").AchParticipantBank[];
}): Promise<FcbLegacyExportResult> {
  if (input.settings.exportFormat !== FCB_TT_LEGACY_NACHA_NO_HEADER_V1) {
    throw new AchRecordValidationError(
      `Exporter does not support format ${input.settings.exportFormat}.`,
    );
  }

  const included = input.rows.filter((row) => !row.excluded);
  const needsAllocate =
    !input.reuseExistingTraces ||
    included.some((row) => !row.traceNumber);

  let rowsWithTraces = input.rows;
  if (needsAllocate) {
    const traces = await input.traceGenerator.allocate(included.length);
    let idx = 0;
    rowsWithTraces = input.rows.map((row) => {
      if (row.excluded) {
        return row;
      }
      if (input.reuseExistingTraces && row.traceNumber) {
        return row;
      }
      const traceNumber = traces[idx]!;
      idx += 1;
      return { ...row, traceNumber };
    });
  }

  const validation = assembleAchValidationSummary({
    rows: rowsWithTraces,
    settings: input.settings,
    paymentDate: input.paymentDate,
    currencyCode: input.currencyCode,
    routingRegistry: input.routingRegistry,
  });
  assertAchExportReady(validation);

  const salaryReference = formatAchSalaryReference(
    input.paymentDate,
    input.settings.entryDescription,
  );

  const entries: FcbLegacyExportEntry[] = [];
  const lines: string[] = [];

  for (const row of validation.rows) {
    if (row.excluded || !row.ok) {
      continue;
    }
    if (!row.transactionCode || !row.traceNumber || !row.accountNumber) {
      throw new AchRecordValidationError(
        `Employee ${row.employeeNumber} is missing required ACH fields after validation.`,
      );
    }
    const routing = row.routingNumber!;
    const record = buildFcbLegacyAchRecord({
      transactionCode: row.transactionCode,
      routingNumber: routing,
      accountNumber: row.accountNumber,
      amount: row.amount,
      individualId: salaryReference,
      receiverName: row.beneficiaryName?.trim() || row.employeeName,
      discretionaryData: input.settings.discretionaryData,
      addendaIndicator: "0",
      traceNumber: row.traceNumber,
      employeeLabel: row.employeeName,
      routingRegistry: input.routingRegistry,
    });
    lines.push(record);
    entries.push({
      sequence: row.sequence,
      employeeId: row.employeeId,
      employeeNumber: row.employeeNumber,
      transactionCode: row.transactionCode,
      routingNumber: routing,
      accountNumberMasked: row.accountNumberMasked,
      amount: row.amount,
      salaryReference,
      receiverName: row.receiverNameFormatted.trimEnd(),
      traceNumber: row.traceNumber,
      record,
    });
  }

  const content = lines.map((line) => `${line}${FCB_LEGACY_LINE_ENDING}`).join("");
  const paymentIso =
    typeof input.paymentDate === "string"
      ? input.paymentDate.slice(0, 10)
      : input.paymentDate.toISOString().slice(0, 10);

  return {
    exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
    fileName: buildFcbAchSalaryFileName(input.paymentDate),
    mimeType: "text/plain; charset=utf-8",
    content,
    contentHash: hashContent(content),
    paymentDate: paymentIso,
    detailCount: entries.length,
    controlTotalAmount: validation.totalAmount,
    entries,
    validation,
  };
}
