import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  FilePenLine,
  FileSignature,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/src/components/layout/page-header"
import { formatMoney } from "@/src/lib/format"
import { PeopleNav } from "@/src/modules/hr/components/people-nav"
import {
  calculateContractCompensation,
  getEmploymentContractProfile,
} from "@/src/modules/hr/data/get-employment-contracts"

export const metadata: Metadata = {
  title: "Employment Contract",
}

export const dynamic = "force-dynamic"

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function Detail({
  labelText,
  value,
}: {
  labelText: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {labelText}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium">
        {value}
      </p>
    </div>
  )
}

export default async function EmploymentContractPage({
  params,
}: {
  params: Promise<{
    id: string
    contractId: string
  }>
}) {
  const { id, contractId } = await params
  const contract = await getEmploymentContractProfile(
    id,
    contractId,
  )

  if (!contract) {
    notFound()
  }

  const compensation =
    calculateContractCompensation(contract)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title={contract.jobTitle}
        description={`Employment contract · ${contract.employee.employeeNumber}`}
        actions={
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={`/people/employees/${id}/contracts`}
                />
              }
            >
              <ArrowLeft />
              Contract history
            </Button>

            {contract.isCurrent && (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/people/employees/${id}/contracts/${contract.id}/amend`}
                  />
                }
              >
                <FilePenLine />
                Renew or amend
              </Button>
            )}
          </div>
        }
      />

      <section className="border-y border-border py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <FileSignature className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                {contract.jobTitle}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {contract.contractNumber ??
                  "No contract number"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {contract.employee.firstName}{" "}
                {contract.employee.lastName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
              {label(contract.contractType)}
            </Badge>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Contract information
        </h2>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            labelText="Contract action"
            value={label(contract.changeType)}
          />
          <Detail
            labelText="Job title"
            value={contract.jobTitle}
          />
          <Detail
            labelText="Start date"
            value={contract.startDate}
          />
          <Detail
            labelText="End date"
            value={contract.endDate ?? "No end date"}
          />
          <Detail
            labelText="Signed date"
            value={contract.signedDate ?? "Not recorded"}
          />
          <Detail
            labelText="Base salary"
            value={formatMoney(contract.baseSalary, {
              currency: contract.currency,
            })}
          />
          <Detail
            labelText="Document reference"
            value={
              contract.documentReference ?? "Not recorded"
            }
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

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2 lg:grid-cols-4">
          <Detail
            labelText="Monthly base salary"
            value={formatMoney(compensation.monthlyBaseSalary, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Monthly recurring allowances"
            value={formatMoney(
              compensation.monthlyRecurringAllowances,
              { currency: contract.currency },
            )}
          />

          <Detail
            labelText="Monthly gross compensation"
            value={formatMoney(
              compensation.monthlyGrossCompensation,
              { currency: contract.currency },
            )}
          />

          <Detail
            labelText="Annual gross compensation"
            value={formatMoney(
              compensation.annualGrossCompensation,
              { currency: contract.currency },
            )}
          />

          <Detail
            labelText="Annual recurring allowances"
            value={formatMoney(
              compensation.annualRecurringAllowances,
              { currency: contract.currency },
            )}
          />

          <Detail
            labelText="One-time allowances"
            value={formatMoney(compensation.oneTimeAllowances, {
              currency: contract.currency,
            })}
          />

          <Detail
            labelText="Annual taxable allowances"
            value={formatMoney(
              compensation.taxableAllowanceAnnualTotal,
              { currency: contract.currency },
            )}
          />

          <Detail
            labelText="Gratuity-eligible annual earnings"
            value={formatMoney(
              compensation.gratuityEligibleAnnualEarnings,
              { currency: contract.currency },
            )}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Allowances
        </h2>

        {contract.allowances.length === 0 ? (
          <p className="border-y border-border py-6 text-sm text-muted-foreground">
            No allowances are recorded for this contract.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
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
                  <p className="text-xs text-muted-foreground">
                    Amount
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {formatMoney(allowance.amount, {
                      currency: contract.currency,
                    })}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Frequency
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {label(allowance.frequency)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Taxable
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {allowance.isTaxable ? "Yes" : "No"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Gratuity:{" "}
                    {allowance.includedInGratuity
                      ? "Included"
                      : "Excluded"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Gratuity
        </h2>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-3">
          <Detail
            labelText="Eligible"
            value={
              contract.gratuityEligible ? "Yes" : "No"
            }
          />
          <Detail
            labelText="Gratuity rate"
            value={
              contract.gratuityRate
                ? `${contract.gratuityRate}%`
                : "Not applicable"
            }
          />
          <Detail
            labelText="Tax rate"
            value={
              contract.gratuityTaxRate
                ? `${contract.gratuityTaxRate}%`
                : "Not applicable"
            }
          />
          <Detail
            labelText="Contract months"
            value={compensation.contractMonths ?? "Needs end date"}
          />
          <Detail
            labelText="Eligible earnings (period)"
            value={
              compensation.estimatedGrossEarnings
                ? formatMoney(
                    compensation.estimatedGrossEarnings,
                    { currency: contract.currency },
                  )
                : "Not applicable"
            }
          />
          <Detail
            labelText="Estimated gross gratuity"
            value={
              compensation.estimatedGrossGratuity
                ? formatMoney(
                    compensation.estimatedGrossGratuity,
                    { currency: contract.currency },
                  )
                : "Not applicable"
            }
          />
          <Detail
            labelText="Estimated tax"
            value={
              compensation.estimatedTax
                ? formatMoney(compensation.estimatedTax, {
                    currency: contract.currency,
                  })
                : "Not applicable"
            }
          />
          <Detail
            labelText="Estimated net gratuity"
            value={
              compensation.estimatedNetGratuity
                ? formatMoney(
                    compensation.estimatedNetGratuity,
                    { currency: contract.currency },
                  )
                : "Not applicable"
            }
          />
          <Detail
            labelText="Annual eligible earnings base"
            value={formatMoney(
              compensation.gratuityEligibleAnnualEarnings,
              { currency: contract.currency },
            )}
          />
        </div>
      </section>
    </div>
  )
}
