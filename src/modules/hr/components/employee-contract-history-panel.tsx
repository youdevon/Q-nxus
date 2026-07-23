"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  activeStateBadgeVariant,
  employmentContractStatusBadgeVariant,
} from "@/src/config/ui-colors";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import type { EmploymentContractListRecord } from "@/src/modules/hr/data/get-employment-contracts";
import { isPreviousEmploymentContract } from "@/src/modules/hr/lib/previous-employment-contract";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCollectedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return formatDisplayDate(value);
}

function ContractRow({
  contract,
  employeeId,
}: {
  contract: EmploymentContractListRecord;
  employeeId: string;
}) {
  const collectedLabel = formatCollectedAt(contract.collectedAt);

  return (
    <Link
      href={`/people/employees/${employeeId}/contracts/${contract.id}`}
      className="grid gap-5 py-5 hover:bg-muted/20 md:grid-cols-[1fr_11rem_11rem]"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{contract.jobTitle}</p>

          <Badge
            variant={
              contract.isCurrent
                ? activeStateBadgeVariant(true)
                : employmentContractStatusBadgeVariant(contract.status)
            }
          >
            {contract.isCurrent ? "Current" : label(contract.status)}
          </Badge>

          <Badge variant="outline">{label(contract.changeType)}</Badge>

          {collectedLabel ? <Badge variant="secondary">Collected</Badge> : null}
        </div>

        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {contract.contractNumber ?? "No contract number"}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Period</p>
        <p className="mt-1 text-sm font-medium">
          {formatDisplayDate(contract.startDate)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          to{" "}
          {contract.endDate
            ? formatDisplayDate(contract.endDate)
            : "No end date"}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Base salary</p>
        <p className="mt-1 text-sm font-medium">
          {formatMoney(contract.baseSalary, {
            currency: contract.currency,
          })}
        </p>
      </div>
    </Link>
  );
}

export function EmployeeContractHistoryPanel({
  employeeId,
  contracts,
}: {
  employeeId: string;
  contracts: EmploymentContractListRecord[];
}) {
  const [tab, setTab] = useState<"current" | "previous">("current");

  const peers = contracts.map((contract) => ({
    id: contract.id,
    sourceContractId: contract.sourceContractId,
    changeType: contract.changeType,
  }));

  const currentContracts = contracts.filter((contract) => contract.isCurrent);
  const previousContracts = contracts.filter((contract) =>
    isPreviousEmploymentContract(contract, peers),
  );

  const visible = tab === "current" ? currentContracts : previousContracts;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Contracts
        </h2>

        <div
          className="flex gap-1 border-b border-border"
          role="tablist"
          aria-label="Contract history views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "current"}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === "current"
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("current")}
          >
            Current
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "previous"}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === "previous"
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("previous")}
          >
            Previous contracts
            {previousContracts.length > 0
              ? ` (${previousContracts.length})`
              : ""}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {tab === "current"
            ? "No current employment contract."
            : "No previous contracts. Completed terms (expired, terminated, or renewed) appear here. Amendments stay under version history on the current contract."}
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {visible.map((contract) => (
            <ContractRow
              key={contract.id}
              contract={contract}
              employeeId={employeeId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
