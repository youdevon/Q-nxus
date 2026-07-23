import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilePenLine, FileSignature, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { cn } from "@/lib/utils";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import { ContractVersionHistoryTabs } from "@/src/modules/hr/components/contract-version-history-tabs";
import { DeleteEmploymentContractButton } from "@/src/modules/hr/components/delete-employment-contract-button";
import { EmploymentContractLifecyclePanel } from "@/src/modules/hr/components/employment-contract-lifecycle-panel";
import { MarkContractCollectedButton } from "@/src/modules/hr/components/mark-contract-collected-button";
import { ContractGratuityPanel } from "@/src/modules/hr/components/contract-gratuity-panel";
import {
  calculateContractCompensation,
  getEmploymentContractProfile,
} from "@/src/modules/hr/data/get-employment-contracts";
import { getGratuitySettlementForContract } from "@/src/modules/payroll/data/get-gratuity-settlements";
import { resolveEmployeeContractAccess } from "@/src/modules/hr/data/require-people-access";
import { daysUntilExpiry } from "@/src/modules/hr/lib/correspondence-visibility";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

export const metadata: Metadata = {
  title: "Employment Contract",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function Detail({
  labelText,
  value,
  valueClassName,
}: {
  labelText: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{labelText}</p>
      <p
        className={cn(
          "mt-1 whitespace-pre-wrap text-sm font-medium",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}

const CONTRACT_EXPIRY_WARNING_DAYS = 90;
const CONTRACT_EXPIRY_CRITICAL_DAYS = 30;
const CONTINUATION_CHANGE_TYPES = new Set(["RENEWAL", "EXTENSION"]);

function formatDaysRemainingBeforeEnd(days: number): string {
  if (days < 0) {
    const elapsed = Math.abs(days);
    return elapsed === 1
      ? "Expired 1 day ago"
      : `Expired ${elapsed} days ago`;
  }

  if (days === 0) {
    return "Ends today";
  }

  return days === 1 ? "1 day remaining" : `${days} days remaining`;
}

function contractExpiryCountdownClass(days: number): string {
  if (days <= CONTRACT_EXPIRY_CRITICAL_DAYS) {
    return "text-red-600 dark:text-red-400";
  }

  return "text-amber-600 dark:text-amber-400";
}

function formatCollectedDisplay(value: string | null): string {
  if (!value) {
    return "Not collected";
  }

  return value.slice(0, 10);
}

export default async function EmploymentContractPage({
  params,
}: {
  params: Promise<{
    id: string;
    contractId: string;
  }>;
}) {
  const { id, contractId } = await params;
  const access = await resolveEmployeeContractAccess(id);
  const contract = await getEmploymentContractProfile(id, contractId);
  const currentUser = await getCurrentUser();

  if (!contract) {
    notFound();
  }

  const compensation = await calculateContractCompensation(contract);
  const gratuitySettlement = contract.gratuityEligible
    ? await getGratuitySettlementForContract(contractId)
    : null;
  const canManageGratuity = access.capabilities.can("payroll.manage");
  const historyHref = `/people/employees/${id}/contracts`;
  const isCollected = Boolean(contract.collectedAt);
  const isEmployeeSelf = currentUser?.employeeId === id;
  const daysRemaining = contract.endDate
    ? daysUntilExpiry(new Date(`${contract.endDate}T00:00:00.000Z`))
    : null;
  const hasContinuationContract = contract.amendments.some(
    (successor) =>
      CONTINUATION_CHANGE_TYPES.has(successor.changeType) &&
      successor.status !== "CANCELLED",
  );
  const showExpiryCountdown =
    !hasContinuationContract &&
    daysRemaining !== null &&
    daysRemaining <= CONTRACT_EXPIRY_WARNING_DAYS &&
    (daysRemaining >= 0 || contract.isCurrent);

  const headerDescription = access.isSelfService
    ? `Your employment contract · ${contract.employee.employeeNumber}`
    : `Employment contract · ${contract.employee.employeeNumber}`;
  const headerBackLabel = access.isSelfService ? "My contracts" : "Contracts";
  const headerActions = access.canManage ? (
    <div className="flex flex-wrap gap-2">
      {contract.isCurrent && !isCollected ? (
        <MarkContractCollectedButton
          employeeId={id}
          contractId={contract.id}
        />
      ) : null}

      {contract.isCurrent ? (
        <Button
          nativeButton={false}
          variant="outline"
          render={
            <Link
              href={`/people/employees/${id}/contracts/${contract.id}/amend`}
            />
          }
        >
          <FilePenLine />
          Amend
        </Button>
      ) : null}

      {contract.isCurrent ||
      contract.status === "TERMINATED" ||
      contract.status === "EXPIRED" ||
      contract.status === "CANCELLED" ? (
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/people/employees/${id}/contracts/${contract.id}/renew`}
            />
          }
        >
          <RefreshCw />
          Renew
        </Button>
      ) : null}

      <DeleteEmploymentContractButton
        employeeId={id}
        contractId={contract.id}
      />
    </div>
  ) : undefined;

  return (
    <PageShell size="md">
      {access.showPeopleNav ? (
        <PeoplePageHeader
          title={contract.jobTitle}
          description={headerDescription}
          backHref={historyHref}
          backLabel={headerBackLabel}
          actions={headerActions}
        />
      ) : access.isSelfService ? (
        <MePageHeader
          title={contract.jobTitle}
          description={headerDescription}
          backHref={historyHref}
          backLabel={headerBackLabel}
          actions={headerActions}
        />
      ) : (
        <PageHeader
          title={contract.jobTitle}
          description={headerDescription}
          backHref={historyHref}
          backLabel={headerBackLabel}
          actions={headerActions}
        />
      )}

      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <FileSignature className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {contract.jobTitle}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {contract.contractNumber ?? "No contract number"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {contract.employee.firstName}
                {" "}
                {contract.employee.lastName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={activeStateBadgeVariant(contract.isCurrent)}>
              {contract.isCurrent ? "Current" : label(contract.status)}
            </Badge>

            <Badge variant="outline">{label(contract.contractType)}</Badge>

            {isCollected ? (
              <Badge variant="secondary">Collected</Badge>
            ) : (
              <Badge variant="outline">Not collected</Badge>
            )}

            {contract.amendedAfterCollection ? (
              <Badge variant="destructive">Amended after collection</Badge>
            ) : null}
          </div>
        </div>
      </section>

      {contract.amendedAfterCollection ? (
        <div className="border-y border-amber-500/40 bg-amber-500/5 py-3 text-sm text-amber-900 dark:text-amber-200">
          The employee already collected the previous version of this contract.
          This record is an amendment after that collection.
        </div>
      ) : null}

      <EmploymentContractLifecyclePanel
        contractId={contract.id}
        employeeId={id}
        status={contract.status}
        employeeSignedAt={contract.employeeSignedAt}
        orgSignedAt={contract.orgSignedAt}
        documentFileName={contract.documentFileName}
        canManage={access.canManage}
        isEmployeeSelf={isEmployeeSelf}
      />

      <ContractVersionHistoryTabs
        employeeId={id}
        previousVersions={contract.previousVersions}
      />

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Contract information
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail
            labelText="Contract action"
            value={label(contract.changeType)}
          />
          <Detail labelText="Position" value={contract.jobTitle} />
          <Detail
            labelText="Start date"
            value={formatDisplayDate(contract.startDate)}
          />
          <Detail
            labelText="End date"
            value={
              contract.endDate
                ? formatDisplayDate(contract.endDate)
                : "No end date"
            }
          />
          {showExpiryCountdown && daysRemaining !== null ? (
            <Detail
              labelText="Time remaining"
              value={formatDaysRemainingBeforeEnd(daysRemaining)}
              valueClassName={contractExpiryCountdownClass(daysRemaining)}
            />
          ) : null}
          <Detail
            labelText="Signed date"
            value={contract.signedDate ?? "Not recorded"}
          />
          <Detail
            labelText="Collected"
            value={formatCollectedDisplay(contract.collectedAt)}
          />
          <Detail
            labelText="Base salary"
            value={formatMoney(contract.baseSalary, {
              currency: contract.currency,
            })}
          />
          <Detail
            labelText="Document reference"
            value={contract.documentReference ?? "Not recorded"}
          />
          <Detail
            labelText="Notes"
            value={contract.notes ?? "No notes recorded"}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Compensation Summary
        </h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Detail
            labelText="Monthly base salary"
            value={formatMoney(compensation.monthlyBaseSalary, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Monthly recurring allowances"
            value={formatMoney(compensation.monthlyRecurringAllowances, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Monthly gross compensation"
            value={formatMoney(compensation.monthlyGrossCompensation, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Annual gross compensation"
            value={formatMoney(compensation.annualGrossCompensation, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Annual recurring allowances"
            value={formatMoney(compensation.annualRecurringAllowances, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="One-time allowances"
            value={formatMoney(compensation.oneTimeAllowances, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Annual taxable allowances"
            value={formatMoney(compensation.taxableAllowanceAnnualTotal, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Gratuity-eligible annual earnings"
            value={formatMoney(compensation.gratuityEligibleAnnualEarnings, {
              currency: contract.currency,
            })}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Allowances
        </h2>

        {contract.allowances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No allowances are recorded for this contract.
          </p>
        ) : (
          <>
            {access.canManage && contract.isCurrent ? (
              <p className="mb-4 text-xs text-muted-foreground">
                To change amounts or taxability, use{" "}
                <Link
                  href={`/people/employees/${id}/contracts/${contract.id}/amend`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Amend
                </Link>
                .
              </p>
            ) : null}

            <div className="divide-y divide-border/70">
              {contract.allowances.map((allowance) => (
                <div
                  key={allowance.id}
                  className="grid gap-4 py-5 md:grid-cols-[1fr_10rem_10rem_8rem]"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {allowance.categoryName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {allowance.notes || "No additional notes"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="mt-1 text-sm font-medium">
                      {formatMoney(allowance.amount, {
                        currency: contract.currency,
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Frequency</p>
                    <p className="mt-1 text-sm font-medium">
                      {label(allowance.frequency)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Taxable</p>
                    <p className="mt-1 text-sm font-medium">
                      {allowance.isTaxable ? "Yes" : "No"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Gratuity:{" "}
                      {allowance.includedInGratuity ? "Included" : "Excluded"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Gratuity
        </h2>

        <ContractGratuityPanel
          settlement={gratuitySettlement}
          canManage={canManageGratuity}
          employeeId={id}
          contractId={contractId}
          fallback={{
            eligible: contract.gratuityEligible,
            rate: contract.gratuityRate,
            taxRate: contract.gratuityTaxRate,
            contractMonths: compensation.contractMonths,
            estimatedGrossEarnings: compensation.estimatedGrossEarnings,
            estimatedGrossGratuity: compensation.estimatedGrossGratuity,
            estimatedTax: compensation.estimatedTax,
            estimatedNetGratuity: compensation.estimatedNetGratuity,
            annualEligibleEarnings:
              compensation.gratuityEligibleAnnualEarnings,
            currency: contract.currency,
          }}
        />
      </section>
    </PageShell>
  );
}
