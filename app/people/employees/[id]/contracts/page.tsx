import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { EmployeeContractHistoryPanel } from "@/src/modules/hr/components/employee-contract-history-panel";
import { PeopleNav } from "@/src/modules/hr/components/people-nav";
import { getEmployeeContractHistory } from "@/src/modules/hr/data/get-employment-contracts";
import { resolveEmployeeContractAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Employment Contracts",
};

export const dynamic = "force-dynamic";

export default async function EmployeeContractsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  const access = await resolveEmployeeContractAccess(id);
  const history = await getEmployeeContractHistory(id);

  if (!history) {
    notFound();
  }

  const currentContract = history.contracts.find(
    (contract) => contract.isCurrent,
  );
  const previousCount = history.contracts.filter(
    (contract) => !contract.isCurrent,
  ).length;
  const profileHref = access.isSelfService
    ? "/me"
    : `/people/employees/${history.employee.id}`;

  return (
    <PageShell size="lg">
      {access.showPeopleNav ? <PeopleNav /> : null}

      <PageHeader
        title={access.isSelfService ? "My Contracts" : "Employment Contracts"}
        description={
          access.isSelfService
            ? `Your employment contracts · ${history.employee.employeeNumber}`
            : `${history.employee.firstName} ${history.employee.lastName} · ${history.employee.employeeNumber}`
        }
        backHref={profileHref}
        backLabel={access.isSelfService ? "My profile" : "Employee"}
        actions={
          access.canManage ? (
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/people/employees/${history.employee.id}/contracts/new`}
                />
              }
            >
              <Plus />
              New contract
            </Button>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Current contract</p>
          <p className="mt-1 text-sm font-medium">
            {currentContract?.jobTitle ?? "None"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Current end date</p>
          <p className="mt-1 text-sm font-medium">
            {currentContract?.endDate ?? "No end date"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Previous versions</p>
          <p className="mt-1 text-2xl font-semibold">{previousCount}</p>
        </div>
      </section>

      <EmployeeContractHistoryPanel
        employeeId={history.employee.id}
        contracts={history.contracts}
      />
    </PageShell>
  );
}
