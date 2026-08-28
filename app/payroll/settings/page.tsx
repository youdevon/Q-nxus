import type { Metadata } from "next";
import Link from "next/link";
import { Gift, HeartPulse, Landmark, Shield, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import { PayrollNav } from "@/src/modules/payroll/components/payroll-nav";
import { getCurrentNisClasses, getNisClassVersions } from "@/src/modules/payroll/data/get-nis-classes";
import { getCurrentPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import { getCurrentHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { getCurrentGratuityPolicy } from "@/src/modules/payroll/data/get-gratuity-policy";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import {
  computeHealthSurcharge,
  toHealthConfigInput,
} from "@/src/modules/payroll/lib/health-surcharge";
import {
  computeNisContribution,
  toNisClassInputs,
} from "@/src/modules/payroll/lib/nis-contribution";
import {
  computePayeContribution,
  toPayeConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";

export const metadata: Metadata = {
  title: "Payroll Settings",
};

export const dynamic = "force-dynamic";

export default async function PayrollSettingsPage() {
  const capabilities = await requirePayrollViewAccess();
  const canManage = capabilities.can("payroll.manage");

  const [nisVersions, currentNisClasses, payeConfig, healthConfig, gratuityPolicy] =
    await Promise.all([
      getNisClassVersions(),
      getCurrentNisClasses(),
      getCurrentPayeTaxConfig(),
      getCurrentHealthSurchargeConfig(),
      getCurrentGratuityPolicy(),
    ]);

  const currentNisVersion =
    nisVersions.find((version) => version.isCurrent) ?? null;
  const nisPreview = computeNisContribution({
    monthlySalary: 30_000,
    classes: toNisClassInputs(currentNisClasses),
    weeksInPeriod: 4,
  });
  const payePreview =
    payeConfig != null
      ? computePayeContribution({
          monthlyTaxableEarnings: 30_000,
          config: toPayeConfigInput(payeConfig),
          employeeNisWeekly: nisPreview.employeeWeekly,
        })
      : null;
  const healthPreview =
    healthConfig != null
      ? computeHealthSurcharge({
          config: toHealthConfigInput(healthConfig),
          monthlyEarnings: 30_000,
        })
      : null;

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Payroll Settings"
        description="Central Trinidad & Tobago statutory configuration — NIS earnings classes, PAYE, Health Surcharge, and gratuity."
        backHref="/payroll"
        backLabel="Payroll"
      />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <SectionHeading>NIS earnings classes</SectionHeading>
            {currentNisVersion?.isCurrent ? (
              <Badge variant="success">In effect</Badge>
            ) : null}
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings/nis" />}
          >
            {canManage ? "Manage classes" : "View classes"}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Fixed weekly employee/employer amounts by class (not a flat % of
          salary). Employee = ⅓, employer = ⅔ of the class contribution.
        </p>

        {currentNisVersion && currentNisClasses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Current schedule</p>
              <p className="mt-1 text-sm font-medium">
                {currentNisVersion.versionLabel ??
                  currentNisVersion.effectiveFrom}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Classes</p>
              <p className="mt-1 text-2xl font-semibold">
                {currentNisClasses.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Example — TTD 30,000/mo (4 Mondays)
              </p>
              <p className="mt-1 text-sm font-medium">
                Class {nisPreview.classCode}: employee{" "}
                {formatMoney(nisPreview.employeeMonthly, { currency: "TTD" })}
                /mo
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No NIS earnings classes configured.
          </p>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            <SectionHeading>PAYE (income tax)</SectionHeading>
            {payeConfig?.isCurrent ? (
              <Badge variant="success">In effect</Badge>
            ) : null}
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings/paye" />}
          >
            {canManage ? "Manage PAYE" : "View PAYE"}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Calculated on estimated annual taxable income after personal allowance
          and approved deductions — not a flat 25% of monthly salary.
        </p>

        {payeConfig && payePreview ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Personal allowance</p>
              <p className="mt-1 text-sm font-medium">
                {formatMoney(payeConfig.personalAllowanceAnnual, {
                  currency: "TTD",
                })}
                /yr
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Brackets</p>
              <p className="mt-1 text-sm font-medium">
                {payeConfig.brackets
                  .map((bracket) => `${Number(bracket.ratePercent)}%`)
                  .join(" / ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Example — TTD 30,000 + NIS
              </p>
              <p className="mt-1 text-sm font-medium">
                {formatMoney(payePreview.monthlyPaye, { currency: "TTD" })}/mo
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No PAYE configuration yet.
          </p>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="size-4 text-muted-foreground" />
            <SectionHeading>Health Surcharge</SectionHeading>
            {healthConfig?.isCurrent ? (
              <Badge variant="success">In effect</Badge>
            ) : null}
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings/health" />}
          >
            {canManage ? "Manage Health" : "View Health"}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Fixed weekly amounts by earnings tier, deducted separately from PAYE
          and NIS. Exempt under 16, age 60+, or pension-only income.
        </p>

        {healthConfig && healthPreview ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Weekly rates</p>
              <p className="mt-1 text-sm font-medium">
                {formatMoney(healthConfig.higherWeeklyAmount)} /{" "}
                {formatMoney(healthConfig.lowerWeeklyAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Thresholds</p>
              <p className="mt-1 text-sm font-medium">
                &gt; {formatMoney(healthConfig.monthlyEarningsThreshold)}/mo
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Example — TTD 30,000/mo
              </p>
              <p className="mt-1 text-sm font-medium">
                {formatMoney(healthPreview.averageMonthlyAmount, {
                  currency: "TTD",
                })}
                /mo avg
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Health Surcharge configuration yet.
          </p>
        )}
      </section>
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-muted-foreground" />
            <SectionHeading>Gratuity</SectionHeading>
            {gratuityPolicy?.isCurrent ? (
              <Badge variant="success">In effect</Badge>
            ) : null}
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings/gratuity" />}
          >
            {canManage ? "Manage gratuity" : "View gratuity"}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Contract-end gratuity formula and tax bands used for settlement
          estimates, approval, and pay-run scheduling.
        </p>

        {gratuityPolicy ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Default rate</p>
              <p className="mt-1 text-sm font-medium">
                {Number(gratuityPolicy.defaultRatePercent)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tax mode</p>
              <p className="mt-1 text-sm font-medium">
                {gratuityPolicy.taxMode.replaceAll("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Formula</p>
              <p className="mt-1 text-sm font-medium">
                {gratuityPolicy.formulaKind.replaceAll("_", " ")}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No gratuity policy yet — TT defaults apply until configured.
          </p>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            <SectionHeading>Financial institutions</SectionHeading>
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings/institutions" />}
          >
            {canManage ? "Manage institutions" : "View institutions"}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Bank directory for employee payroll destinations. ACH routing codes
          stay blank until confirmed (REQUIRES_CONFIRMATION).
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            <SectionHeading>Bank export profiles</SectionHeading>
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings/export-profiles" />}
          >
            {canManage ? "Manage export profiles" : "View export profiles"}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Manual register, First Citizens manual-entry worksheet, and generic CSV
          adapters. First Citizens import-file download stays disabled until the
          bank confirms Default Transactions layout.{" "}
          <Link
            href="/payroll/payment-instructions/import"
            className="underline underline-offset-2"
          >
            Import payment instructions
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <SectionHeading>Recurring components</SectionHeading>
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/payroll/settings/components" />}
          >
            {canManage || capabilities.can("payroll.setup")
              ? "Manage components"
              : "View components"}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Organization masters for loans, garnishments, pension installments,
          voluntary deductions, and recurring earnings. Assign on each
          employee&apos;s payroll setup page; balances decrease when a regular
          pay run is posted.
        </p>
      </section>
    </PageShell>
  );
}
