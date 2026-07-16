import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  FileSignature,
  Plus,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { formatMoney } from "@/src/lib/format"
import { PeopleNav } from "@/src/modules/hr/components/people-nav"
import { getEmployeeContractHistory } from "@/src/modules/hr/data/get-employment-contracts"

export const metadata: Metadata = {
  title: "Employment Contracts",
}

export const dynamic = "force-dynamic"

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export default async function EmployeeContractsPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const history = await getEmployeeContractHistory(id)

  if (!history) {
    notFound()
  }

  const currentContract = history.contracts.find(
    (contract) => contract.isCurrent,
  )

  return (
    <PageShell size="lg">
      <PeopleNav />

      <PageHeader
        title="Employment Contracts"
        description={`${history.employee.firstName} ${history.employee.lastName} · ${history.employee.employeeNumber}`}
        actions={
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={`/people/employees/${history.employee.id}`}
                />
              }
            >
              <ArrowLeft />
              Employee profile
            </Button>

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
          </>
        }
      />

      <section className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Contract records
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {history.contracts.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Current contract
          </p>
          <p className="mt-1 text-sm font-medium">
            {currentContract?.jobTitle ?? "None"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Current end date
          </p>
          <p className="mt-1 text-sm font-medium">
            {currentContract?.endDate ?? "No end date"}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Contract history
          </h2>
        </div>

        {history.contracts.length === 0 ? (
          <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
            No employment contracts have been recorded.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {history.contracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/people/employees/${history.employee.id}/contracts/${contract.id}`}
                className="grid gap-5 py-5 hover:bg-muted/20 md:grid-cols-[1fr_11rem_11rem]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {contract.jobTitle}
                    </p>

                    <Badge
                      variant={
                        contract.isCurrent
                          ? "default"
                          : "secondary"
                      }
                    >
                      {contract.isCurrent
                        ? "Current"
                        : label(contract.status)}
                    </Badge>

                    <Badge variant="outline">
                      {label(contract.changeType)}
                    </Badge>
                  </div>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {contract.contractNumber ??
                      "No contract number"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Period
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {contract.startDate}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    to {contract.endDate ?? "No end date"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Base salary
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {formatMoney(contract.baseSalary, {
                      currency: contract.currency,
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}
