import type { Metadata } from "next"
import Link from "next/link"
import {
  CalendarRange,
  CircleDollarSign,
  Clock3,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { PeopleNav } from "@/src/modules/hr/components/people-nav"
import { getContractLeaveBalances } from "@/src/modules/hr/data/get-contract-leave-balances"

export const metadata: Metadata = {
  title: "Leave Balances",
}

export const dynamic = "force-dynamic"

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
  }).format(new Date(value))
}

function formatQuantity(value: string): string {
  const number = Number(value)

  return new Intl.NumberFormat("en-TT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number)
}

export default async function LeaveBalancesPage() {
  const balances = await getContractLeaveBalances()

  const employeeCount = new Set(
    balances.map((balance) => balance.employeeId),
  ).size

  const contractCount = new Set(
    balances.map((balance) => balance.contractId),
  ).size

  const totalAvailable = balances.reduce(
    (total, balance) =>
      total + Number(balance.availableBalance),
    0,
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="Leave Balances"
        description="Employee leave entitlements and usage shown by employment contract period."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/people/leave/types" />
            }
          >
            Leave types
          </Button>
        }
      />

      <section className="grid gap-8 border-y border-border py-5 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserRound className="size-4" />
            Employees
          </div>

          <p className="mt-1 text-2xl font-semibold">
            {employeeCount}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarRange className="size-4" />
            Contract cycles
          </div>

          <p className="mt-1 text-2xl font-semibold">
            {contractCount}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleDollarSign className="size-4" />
            Available leave
          </div>

          <p className="mt-1 text-2xl font-semibold">
            {formatQuantity(String(totalAvailable))}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Clock3 className="size-4 text-muted-foreground" />

          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Contract leave cycles
          </h2>
        </div>

        {balances.length === 0 ? (
          <div className="border-y border-border py-12 text-center">
            <p className="text-sm font-medium">
              No leave balances found
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Generate balances from current employment
              contracts first.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-3 font-medium">
                    Employee
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Contract period
                  </th>
                  <th className="px-3 py-3 font-medium">
                    Leave type
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Entitlement
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Reserved
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Taken
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Available
                  </th>
                </tr>
              </thead>

              <tbody>
                {balances.map((balance) => (
                  <tr
                    key={balance.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-4">
                      <Link
                        href={`/people/employees/${balance.employeeId}`}
                        className="font-medium hover:underline"
                      >
                        {balance.employeeName}
                      </Link>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {balance.employeeNumber}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      <p className="font-medium">
                        {formatDate(balance.cycleStart)}
                        {" — "}
                        {formatDate(balance.cycleEnd)}
                      </p>

                      {balance.contractNumber && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {balance.contractNumber}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <span>{balance.leaveTypeName}</span>

                        <Badge variant="outline">
                          {balance.leaveTypeCode}
                        </Badge>
                      </div>
                    </td>

                    <td className="px-3 py-4 text-right">
                      {formatQuantity(
                        balance.entitlement,
                      )}
                    </td>

                    <td className="px-3 py-4 text-right">
                      {formatQuantity(balance.reserved)}
                    </td>

                    <td className="px-3 py-4 text-right">
                      {formatQuantity(balance.taken)}
                    </td>

                    <td className="px-3 py-4 text-right font-semibold">
                      {formatQuantity(
                        balance.availableBalance,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
