/**
 * Sync First Citizens bank-export profiles + open ACH batches to Business Online
 * ACH form defaults (Payroll / Salary / Checking Credit / period discretionary data).
 *
 * Usage: npx tsx --env-file=.env scripts/sync-fcb-ach-compliance.ts
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FIRST_CITIZENS_CONFIGURATION,
  normalizeFirstCitizensConfiguration,
  parseFirstCitizensConfiguration,
  resolveFirstCitizensBatchHeader,
} from "@/src/modules/payroll/lib/first-citizens-export";
import {
  firstCitizensPaymentType,
  normalizeFirstCitizensPaymentTypeLabel,
} from "@/src/modules/payroll/lib/payment-instructions";

async function main() {
  const profiles = await prisma.bankExportProfile.findMany({
    where: {
      adapterKind: {
        in: ["FIRST_CITIZENS_MANUAL_WORKSHEET", "FIRST_CITIZENS_IMPORT"],
      },
    },
  });

  let profilesUpdated = 0;
  for (const profile of profiles) {
    const normalized = normalizeFirstCitizensConfiguration(
      parseFirstCitizensConfiguration(profile.configurationJson),
    );
    const nextConfig =
      profile.adapterKind === "FIRST_CITIZENS_IMPORT"
        ? {
            ...normalized,
            exportFormat: "IMPORT_DISABLED",
            importFileDisabled: true,
            importDisabledReason:
              normalized.importDisabledReason ??
              DEFAULT_FIRST_CITIZENS_CONFIGURATION.importDisabledReason,
          }
        : normalized;

    await prisma.bankExportProfile.update({
      where: { id: profile.id },
      data: { configurationJson: nextConfig },
    });
    profilesUpdated += 1;
    console.log(`Updated profile ${profile.code} (${profile.id})`);
  }

  const openBatches = await prisma.achPaymentBatch.findMany({
    where: {
      status: {
        in: [
          "DRAFT",
          "VALIDATION_FAILED",
          "PENDING_APPROVAL",
          "READY_FOR_APPROVAL",
          "APPROVED",
        ],
      },
      bankExportProfile: {
        adapterKind: {
          in: ["FIRST_CITIZENS_MANUAL_WORKSHEET", "FIRST_CITIZENS_IMPORT"],
        },
      },
    },
    include: {
      bankExportProfile: true,
      payRun: {
        select: {
          payrollPeriod: {
            select: { name: true, periodKey: true, periodEnd: true },
          },
        },
      },
      details: {
        include: {
          payrollPaymentAllocation: { select: { accountType: true } },
        },
      },
    },
  });

  let batchesUpdated = 0;
  let detailsUpdated = 0;

  for (const batch of openBatches) {
    const config = parseFirstCitizensConfiguration(
      batch.bankExportProfile.configurationJson,
    );
    const header = resolveFirstCitizensBatchHeader(config, {
      periodName: batch.payRun.payrollPeriod.name,
      periodKey: batch.payRun.payrollPeriod.periodKey,
      periodEnd: batch.payRun.payrollPeriod.periodEnd,
    });

    const globalAddenda = batch.globalAddenda?.trim() || header.globalAddenda;
    const entryDescription =
      batch.entryDescription?.trim() || header.entryDescription;
    const discretionaryData =
      batch.discretionaryData?.trim() || header.discretionaryData;
    const purposeCode = batch.purposeCode?.trim() || header.purposeCode;
    const transactionType =
      batch.transactionType?.trim() || header.transactionType;

    await prisma.achPaymentBatch.update({
      where: { id: batch.id },
      data: {
        globalAddenda,
        entryDescription,
        discretionaryData,
        purposeCode,
        transactionType,
      },
    });
    batchesUpdated += 1;

    for (const detail of batch.details) {
      const paymentType =
        normalizeFirstCitizensPaymentTypeLabel(detail.paymentType) ??
        firstCitizensPaymentType(
          detail.payrollPaymentAllocation.accountType ?? "SAVINGS",
        );
      const addenda = detail.addenda?.trim() || globalAddenda;
      const detailPurpose = detail.purposeCode?.trim() || purposeCode;

      if (
        paymentType !== detail.paymentType ||
        addenda !== detail.addenda ||
        detailPurpose !== detail.purposeCode
      ) {
        await prisma.achPaymentBatchDetail.update({
          where: { id: detail.id },
          data: {
            paymentType,
            addenda,
            purposeCode: detailPurpose,
          },
        });
        detailsUpdated += 1;
      }
    }

    console.log(`Updated batch ${batch.batchNumber} (${batch.id})`);
  }

  console.log(
    JSON.stringify(
      {
        profilesUpdated,
        batchesUpdated,
        detailsUpdated,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
