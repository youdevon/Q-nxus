"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useState } from "react"
import { ArrowLeft, FileSignature, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/src/components/layout/page-header"
import { formatMoney } from "@/src/lib/format"
import {
  createEmploymentContract,
  type EmploymentContractFormState,
} from "@/src/modules/hr/actions/create-employment-contract"
import type {
  EmployeeContractHistory,
  EmploymentContractProfile,
  AllowanceCategoryRecord,
} from "@/src/modules/hr/data/get-employment-contracts"
import { calculateContractGratuityEstimate } from "@/src/modules/hr/services/calculate-contract-gratuity"
import {
  ContractAllowanceEditor,
  type ContractAllowanceInput,
} from "./contract-allowance-editor"
import { PeopleNav } from "./people-nav"

const initialState: EmploymentContractFormState = {
  status: "idle",
  message: "",
}

export function EmploymentContractForm({
  history,
  sourceContract,
  allowanceCategories,
}: {
  history: EmployeeContractHistory
  sourceContract?: EmploymentContractProfile | null
  allowanceCategories: AllowanceCategoryRecord[]
}) {
  const [state, action, pending] = useActionState(
    createEmploymentContract,
    initialState,
  )

  const [gratuityEligible, setGratuityEligible] = useState(
    sourceContract?.gratuityEligible ?? false,
  )
  const [startDate, setStartDate] = useState(
    sourceContract?.startDate ?? "",
  )
  const [endDate, setEndDate] = useState(
    sourceContract?.endDate ?? "",
  )
  const [baseSalary, setBaseSalary] = useState(
    sourceContract?.baseSalary ?? "",
  )
  const [gratuityRate, setGratuityRate] = useState(
    sourceContract?.gratuityRate ?? "20",
  )
  const [gratuityTaxRate, setGratuityTaxRate] = useState(
    sourceContract?.gratuityTaxRate ?? "25",
  )

  const [allowances, setAllowances] = useState<
    ContractAllowanceInput[]
  >(
    sourceContract?.allowances.map((allowance) => ({
      rowId: allowance.id,
      categoryId: allowance.categoryId,
      customCategoryName: "",
      amount: allowance.amount,
      frequency:
        allowance.frequency as ContractAllowanceInput["frequency"],
      isTaxable: allowance.isTaxable,
      includedInGratuity:
        allowance.includedInGratuity,
      notes: allowance.notes ?? "",
    })) ?? [],
  )

  const gratuityEstimate = useMemo(() => {
    if (
      !gratuityEligible ||
      !startDate ||
      !endDate ||
      !baseSalary ||
      !gratuityRate
    ) {
      return null
    }

    try {
      return calculateContractGratuityEstimate({
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        baseSalary,
        allowances,
        gratuityRate,
        gratuityTaxRate,
      })
    } catch {
      return null
    }
  }, [
    gratuityEligible,
    startDate,
    endDate,
    baseSalary,
    allowances,
    gratuityRate,
    gratuityTaxRate,
  ])

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message)
    }

    if (state.status === "conflict") {
      toast.warning(state.message)
    }
  }, [state])

  const employee = history.employee
  const isAmendment = Boolean(sourceContract)
  const currency = sourceContract?.currency ?? "TTD"

  return (
    <form
      action={action}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <PeopleNav />

      <input
        type="hidden"
        name="employeeId"
        value={employee.id}
      />

      {sourceContract && (
        <input
          type="hidden"
          name="sourceContractId"
          value={sourceContract.id}
        />
      )}

      <PageHeader
        title={
          isAmendment
            ? "Amend Employment Contract"
            : "New Employment Contract"
        }
        description={`${employee.firstName} ${employee.lastName} · ${employee.employeeNumber}`}
        actions={
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={
                    sourceContract
                      ? `/people/employees/${employee.id}/contracts/${sourceContract.id}`
                      : `/people/employees/${employee.id}/contracts`
                  }
                />
              }
            >
              <ArrowLeft />
              Cancel
            </Button>

            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save contract"}
            </Button>
          </div>
        }
      />

      {state.status !== "idle" && (
        <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <ContractAllowanceEditor
        categories={allowanceCategories}
        allowances={allowances}
        onChange={setAllowances}
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Contract details
          </h2>
        </div>

        <div className="grid gap-5 border-y border-border py-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="contractNumber"
              className="text-sm font-medium"
            >
              Contract number
            </label>
            <Input
              id="contractNumber"
              name="contractNumber"
              defaultValue=""
              className="mt-2 font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="contractType"
              className="text-sm font-medium"
            >
              Contract type
            </label>
            <select
              id="contractType"
              name="contractType"
              defaultValue={
                sourceContract?.contractType ?? "FIXED_TERM"
              }
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="PERMANENT">Permanent</option>
              <option value="FIXED_TERM">Fixed term</option>
              <option value="TEMPORARY">Temporary</option>
              <option value="PART_TIME">Part time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONSULTANCY">Consultancy</option>
              <option value="ACTING">Acting</option>
              <option value="SECONDMENT">Secondment</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="changeType"
              className="text-sm font-medium"
            >
              Contract action
            </label>
            <select
              id="changeType"
              name="changeType"
              defaultValue={
                isAmendment ? "AMENDMENT" : "INITIAL"
              }
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
            >
              {!isAmendment && (
                <option value="INITIAL">
                  Initial contract
                </option>
              )}
              <option value="RENEWAL">Renewal</option>
              <option value="EXTENSION">Extension</option>
              <option value="AMENDMENT">Amendment</option>
              <option value="SALARY_ADJUSTMENT">
                Salary adjustment
              </option>
              <option value="POSITION_CHANGE">
                Position change
              </option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="jobTitle"
              className="text-sm font-medium"
            >
              Contract job title
            </label>
            <Input
              id="jobTitle"
              name="jobTitle"
              defaultValue={
                sourceContract?.jobTitle ??
                employee.positionTitle ??
                ""
              }
              className="mt-2"
              required
            />
          </div>

          <div>
            <label
              htmlFor="startDate"
              className="text-sm font-medium"
            >
              Start date
            </label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              className="mt-2"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
              required
            />
          </div>

          <div>
            <label
              htmlFor="endDate"
              className="text-sm font-medium"
            >
              End date
            </label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              className="mt-2"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Required for leave balances and gratuity
              estimates.
            </p>
          </div>

          <div>
            <label
              htmlFor="signedDate"
              className="text-sm font-medium"
            >
              Signed date
            </label>
            <Input
              id="signedDate"
              name="signedDate"
              type="date"
              className="mt-2"
            />
          </div>

          <div>
            <label
              htmlFor="documentReference"
              className="text-sm font-medium"
            >
              Document reference
            </label>
            <Input
              id="documentReference"
              name="documentReference"
              defaultValue=""
              className="mt-2"
            />
          </div>

          <div>
            <label
              htmlFor="baseSalary"
              className="text-sm font-medium"
            >
              Base salary
            </label>
            <Input
              id="baseSalary"
              name="baseSalary"
              type="number"
              min="0"
              step="0.01"
              value={baseSalary}
              onChange={(event) =>
                setBaseSalary(event.target.value)
              }
              className="mt-2"
              required
            />
          </div>

          <div>
            <label
              htmlFor="currency"
              className="text-sm font-medium"
            >
              Currency
            </label>
            <Input
              id="currency"
              name="currency"
              maxLength={3}
              defaultValue={sourceContract?.currency ?? "TTD"}
              className="mt-2 uppercase"
              required
            />
          </div>

          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              name="gratuityEligible"
              checked={gratuityEligible}
              onChange={(event) =>
                setGratuityEligible(event.target.checked)
              }
              className="size-4"
            />
            <span className="text-sm font-medium">
              Employee is eligible for gratuity under this
              contract
            </span>
          </label>

          {gratuityEligible && (
            <>
              <div>
                <label
                  htmlFor="gratuityRate"
                  className="text-sm font-medium"
                >
                  Gratuity rate
                </label>
                <Input
                  id="gratuityRate"
                  name="gratuityRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={gratuityRate}
                  onChange={(event) =>
                    setGratuityRate(event.target.value)
                  }
                  className="mt-2"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Percentage of eligible contract earnings
                  (base salary + gratuity-included allowances).
                </p>
              </div>

              <div>
                <label
                  htmlFor="gratuityTaxRate"
                  className="text-sm font-medium"
                >
                  Gratuity tax rate
                </label>
                <Input
                  id="gratuityTaxRate"
                  name="gratuityTaxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={gratuityTaxRate}
                  onChange={(event) =>
                    setGratuityTaxRate(event.target.value)
                  }
                  className="mt-2"
                  required
                />
              </div>

              <div className="md:col-span-2 border-t border-border pt-5">
                <p className="text-sm font-medium">
                  Estimated gratuity
                </p>
                {gratuityEstimate ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Contract months
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {gratuityEstimate.contractMonths}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Eligible earnings
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(
                          gratuityEstimate.estimatedGrossEarnings,
                          { currency },
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Gross gratuity
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(
                          gratuityEstimate.estimatedGrossGratuity,
                          { currency },
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Net gratuity
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(
                          gratuityEstimate.estimatedNetGratuity,
                          { currency },
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Enter start date, end date, salary, and
                    rates to preview the estimate. Mark
                    allowances as included in gratuity to add
                    them to the base.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <label
              htmlFor="notes"
              className="text-sm font-medium"
            >
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={sourceContract?.notes ?? ""}
              rows={4}
              className="mt-2"
            />
          </div>
        </div>
      </section>
    </form>
  )
}
