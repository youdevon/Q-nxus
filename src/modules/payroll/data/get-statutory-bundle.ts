import { getHealthSurchargeConfigAsOf } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { getNisClassesAsOf } from "@/src/modules/payroll/data/get-nis-classes";
import { getPayeTaxConfigAsOf } from "@/src/modules/payroll/data/get-paye-tax-config";
import type { HealthSurchargeConfigRecord } from "@/src/modules/payroll/lib/health-surcharge";
import type { NisEarningsClassRecord } from "@/src/modules/payroll/lib/nis-contribution";
import type { PayeTaxConfigRecord } from "@/src/modules/payroll/lib/paye-contribution";
import type { PayslipStatutorySnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

/**
 * Period-dated statutory schedules for one payroll calculation.
 * Historical posted slips must keep their snapshot; this bundle is for live calc.
 */
export type StatutoryConfigBundle = {
  asOf: string;
  taxYear: number;
  paye: PayeTaxConfigRecord | null;
  nisClasses: NisEarningsClassRecord[];
  health: HealthSurchargeConfigRecord | null;
};

export async function resolveStatutoryConfigBundle(
  asOf: Date | string,
): Promise<StatutoryConfigBundle> {
  const asOfKey = toStatutoryAsOfKey(asOf);
  const [paye, nisClasses, health] = await Promise.all([
    getPayeTaxConfigAsOf(asOfKey),
    getNisClassesAsOf(asOfKey),
    getHealthSurchargeConfigAsOf(asOfKey),
  ]);

  return {
    asOf: asOfKey,
    taxYear: paye?.taxYear ?? taxYearFromAsOfKey(asOfKey),
    paye,
    nisClasses,
    health,
  };
}

export function toPayslipStatutorySnapshot(
  bundle: StatutoryConfigBundle,
): PayslipStatutorySnapshot {
  return {
    asOf: bundle.asOf,
    taxYear: bundle.taxYear,
    countryCode: bundle.paye?.countryCode ?? "TT",
    currencyCode: bundle.paye?.currencyCode ?? "TTD",
    payeConfigId: bundle.paye?.id ?? null,
    payeVersionLabel: bundle.paye?.versionLabel ?? null,
    payeEffectiveFrom: bundle.paye?.effectiveFrom ?? null,
    payeTaxYear: bundle.paye?.taxYear ?? null,
    payeSourceReference: bundle.paye?.sourceReference ?? null,
    healthConfigId: bundle.health?.id ?? null,
    healthVersionLabel: bundle.health?.versionLabel ?? null,
    healthEffectiveFrom: bundle.health?.effectiveFrom ?? null,
    nisVersionLabel: bundle.nisClasses[0]?.versionLabel ?? null,
    nisEffectiveFrom: bundle.nisClasses[0]?.effectiveFrom ?? null,
    nisClassCount: bundle.nisClasses.length,
  };
}
