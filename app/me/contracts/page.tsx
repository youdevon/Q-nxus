import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileSignature } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/src/components/layout/page-shell";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { EmploymentContractLifecyclePanel } from "@/src/modules/hr/components/employment-contract-lifecycle-panel";
import { prisma } from "@/lib/prisma";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { contractStatusLabel } from "@/src/modules/hr/lib/contract-lifecycle";

export const metadata: Metadata = {
  title: "My Contracts",
};

export const dynamic = "force-dynamic";

export default async function MyContractsPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  const employeeId = capabilities.employeeId;

  const contracts = await prisma.employmentContract.findMany({
    where: { employeeId },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    select: {
      id: true,
      contractNumber: true,
      contractType: true,
      status: true,
      startDate: true,
      endDate: true,
      jobTitle: true,
      baseSalary: true,
      currency: true,
      isCurrent: true,
      employeeSignedAt: true,
      orgSignedAt: true,
      documentFileName: true,
      activatedAt: true,
    },
  });

  const awaitingAcceptance = contracts.filter(
    (contract) =>
      (contract.status === "APPROVED" ||
        contract.status === "AWAITING_SIGNATURE") &&
      !contract.employeeSignedAt,
  );

  return (
    <PageShell size="lg">
      <MePageHeader
        title="My contracts"
        description="Review your employment contracts and accept terms awaiting your signature."
      />

      {awaitingAcceptance.length > 0 ? (
        <section className="space-y-4 border-y border-amber-500/40 bg-amber-500/5 py-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Awaiting your acceptance ({awaitingAcceptance.length})
          </h2>
          <ul className="space-y-6">
            {awaitingAcceptance.map((contract) => (
              <li key={contract.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{contract.jobTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {contract.contractNumber ?? "No contract number"} ·{" "}
                      {formatDisplayDate(contract.startDate)} –{" "}
                      {formatDisplayDate(contract.endDate, {
                        fallback: "Open",
                      })}
                    </p>
                    <p className="mt-1 text-sm">
                      {formatMoney(contract.baseSalary.toString(), {
                        currency: contract.currency,
                      })}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {contractStatusLabel(contract.status)}
                  </Badge>
                </div>
                <EmploymentContractLifecyclePanel
                  contractId={contract.id}
                  employeeId={employeeId}
                  status={contract.status}
                  employeeSignedAt={
                    contract.employeeSignedAt?.toISOString() ?? null
                  }
                  orgSignedAt={contract.orgSignedAt?.toISOString() ?? null}
                  documentFileName={contract.documentFileName}
                  canManage={false}
                  isEmployeeSelf
                />
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href={`/people/employees/${employeeId}/contracts/${contract.id}`}
                    />
                  }
                >
                  Open full contract
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No contracts are waiting for your acceptance.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            All contracts
          </h2>
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No employment contracts are on your file yet.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {contracts.map((contract) => (
              <li key={contract.id} className="py-3">
                <Link
                  href={`/people/employees/${employeeId}/contracts/${contract.id}`}
                  className="block hover:underline"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {contract.jobTitle}
                      {contract.isCurrent ? " · Current" : ""}
                    </p>
                    <Badge variant="outline">
                      {contractStatusLabel(contract.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDisplayDate(contract.startDate)} –{" "}
                    {formatDisplayDate(contract.endDate, { fallback: "Open" })}
                    {contract.documentFileName
                      ? ` · ${contract.documentFileName}`
                      : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
