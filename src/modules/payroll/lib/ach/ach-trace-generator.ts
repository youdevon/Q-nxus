/**
 * Org-scoped configured prefix + sequence generator (persists DomainSetting).
 */

import { prisma } from "@/lib/prisma";
import { SettingDataType, ConfigurationStatus } from "@/generated/prisma/enums";
import {
  ACH_TRACE_SEQUENCE_DOMAIN_CODE,
  type AchExportSettings,
} from "@/src/modules/payroll/lib/ach/ach-settings";
import { AchRecordValidationError } from "@/src/modules/payroll/lib/ach/ach-record-builder";
import {
  assertValidTraceNumber,
  buildConfiguredPrefixTrace,
  odfiTracePrefix,
  type AchTraceNumberGenerator,
} from "@/src/modules/payroll/lib/ach/ach-trace-number";

export type { AchTraceNumberGenerator } from "@/src/modules/payroll/lib/ach/ach-trace-number";
export {
  assertValidTraceNumber,
  buildConfiguredPrefixTrace,
  odfiTracePrefix,
} from "@/src/modules/payroll/lib/ach/ach-trace-number";

async function readSequence(organizationId: string): Promise<number> {
  const row = await prisma.domainSetting.findUnique({
    where: {
      organizationId_settingCode: {
        organizationId,
        settingCode: ACH_TRACE_SEQUENCE_DOMAIN_CODE,
      },
    },
    select: { value: true },
  });
  if (row?.value == null) {
    return 0;
  }
  if (typeof row.value === "number" && Number.isFinite(row.value)) {
    return Math.max(0, Math.trunc(row.value));
  }
  if (
    typeof row.value === "object" &&
    row.value !== null &&
    !Array.isArray(row.value) &&
    typeof (row.value as { next?: unknown }).next === "number"
  ) {
    return Math.max(0, Math.trunc((row.value as { next: number }).next));
  }
  return 0;
}

async function writeSequence(
  organizationId: string,
  next: number,
): Promise<void> {
  await prisma.domainSetting.upsert({
    where: {
      organizationId_settingCode: {
        organizationId,
        settingCode: ACH_TRACE_SEQUENCE_DOMAIN_CODE,
      },
    },
    update: {
      value: { next },
      version: { increment: 1 },
      status: ConfigurationStatus.ACTIVE,
    },
    create: {
      organizationId,
      settingCode: ACH_TRACE_SEQUENCE_DOMAIN_CODE,
      moduleKey: "payroll",
      name: "ACH trace sequence",
      description:
        "Next 7-digit sequence for CONFIGURED_PREFIX_SEQUENCE ACH traces. Not an FCB-published algorithm.",
      dataType: SettingDataType.JSON,
      value: { next },
      status: ConfigurationStatus.ACTIVE,
    },
  });
}

/**
 * Org-scoped configured prefix + sequence generator.
 * Blocks when ODFI routing is missing/invalid.
 */
export function createConfiguredPrefixSequenceGenerator(input: {
  organizationId: string;
  settings: AchExportSettings;
}): AchTraceNumberGenerator {
  const { organizationId, settings } = input;

  if (settings.traceStrategy !== "CONFIGURED_PREFIX_SEQUENCE") {
    throw new AchRecordValidationError(
      `Unsupported ACH trace strategy: ${settings.traceStrategy}. Configure a bank-approved generator before production export.`,
    );
  }

  odfiTracePrefix(settings.odfiRoutingNumber);

  return {
    async peekNext(count: number) {
      const current = await readSequence(organizationId);
      const traces: string[] = [];
      for (let i = 1; i <= count; i += 1) {
        traces.push(
          buildConfiguredPrefixTrace(settings.odfiRoutingNumber, current + i),
        );
      }
      return traces;
    },
    async allocate(count: number) {
      if (count <= 0) {
        return [];
      }
      const current = await readSequence(organizationId);
      const traces: string[] = [];
      for (let i = 1; i <= count; i += 1) {
        const trace = buildConfiguredPrefixTrace(
          settings.odfiRoutingNumber,
          current + i,
        );
        assertValidTraceNumber(trace);
        traces.push(trace);
      }
      await writeSequence(organizationId, current + count);
      return traces;
    },
  };
}

export async function getNextAchTraceSequencePreview(
  organizationId: string,
): Promise<number> {
  return (await readSequence(organizationId)) + 1;
}
