"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AllowanceCategoryRecord } from "@/src/modules/hr/data/get-employment-contracts";

export type ContractAllowanceInput = {
  rowId: string;
  categoryId: string;
  customCategoryName: string;
  amount: string;
  frequency:
    | "MONTHLY"
    | "WEEKLY"
    | "BIWEEKLY"
    | "PER_PAY_PERIOD"
    | "ANNUAL"
    | "ONE_TIME";
  isTaxable: boolean;
  includedInGratuity: boolean;
  notes: string;
};

function newAllowance(): ContractAllowanceInput {
  return {
    rowId: crypto.randomUUID(),
    categoryId: "",
    customCategoryName: "",
    amount: "",
    frequency: "MONTHLY",
    isTaxable: true,
    includedInGratuity: false,
    notes: "",
  };
}

export function ContractAllowanceEditor({
  categories,
  allowances,
  onChange,
}: {
  categories: AllowanceCategoryRecord[];
  allowances: ContractAllowanceInput[];
  onChange: (allowances: ContractAllowanceInput[]) => void;
}) {
  function updateAllowance(
    rowId: string,
    changes: Partial<ContractAllowanceInput>,
  ) {
    onChange(
      allowances.map((allowance) =>
        allowance.rowId === rowId
          ? {
              ...allowance,
              ...changes,
            }
          : allowance,
      ),
    );
  }

  function removeAllowance(rowId: string) {
    onChange(allowances.filter((allowance) => allowance.rowId !== rowId));
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Allowances
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Add travelling, phone, professional or other allowances included in
            this contract.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...allowances, newAllowance()])}
        >
          <Plus />
          Add allowance
        </Button>
      </div>

      <input
        type="hidden"
        name="allowancesJson"
        value={JSON.stringify(allowances)}
      />

      {allowances.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm font-medium">No allowances added</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Base salary will be recorded without additional allowances.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/70">
          {allowances.map((allowance, index) => (
            <div
              key={allowance.rowId}
              className="grid gap-5 py-6 md:grid-cols-2"
            >
              <div className="md:col-span-2 flex items-center justify-between">
                <p className="text-sm font-medium">Allowance {index + 1}</p>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeAllowance(allowance.rowId)}
                >
                  <Trash2 />
                  Remove
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Allowance category
                </label>

                <select
                  value={allowance.categoryId}
                  onChange={(event) => {
                    const categoryId = event.target.value;

                    const category = categories.find(
                      (item) => item.id === categoryId,
                    );

                    updateAllowance(allowance.rowId, {
                      categoryId,
                      customCategoryName:
                        categoryId === "NEW"
                          ? allowance.customCategoryName
                          : "",
                      isTaxable:
                        category?.isTaxableDefault ?? allowance.isTaxable,
                      includedInGratuity:
                        category?.includedInGratuityDefault ??
                        allowance.includedInGratuity,
                    });
                  }}
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                  required
                >
                  <option value="">Select allowance</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}

                  <option value="NEW">Add a new category…</option>
                </select>
              </div>

              {allowance.categoryId === "NEW" && (
                <div>
                  <label className="text-sm font-medium">
                    New category name
                  </label>

                  <Input
                    value={allowance.customCategoryName}
                    onChange={(event) =>
                      updateAllowance(allowance.rowId, {
                        customCategoryName: event.target.value,
                      })
                    }
                    placeholder="e.g. Internet Allowance"
                    className="mt-2"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Amount</label>

                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={allowance.amount}
                  onChange={(event) =>
                    updateAllowance(allowance.rowId, {
                      amount: event.target.value,
                    })
                  }
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Frequency</label>

                <select
                  value={allowance.frequency}
                  onChange={(event) =>
                    updateAllowance(allowance.rowId, {
                      frequency: event.target
                        .value as ContractAllowanceInput["frequency"],
                    })
                  }
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Every two weeks</option>
                  <option value="PER_PAY_PERIOD">Per pay period</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="ONE_TIME">One time</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>

                <Input
                  value={allowance.notes}
                  onChange={(event) =>
                    updateAllowance(allowance.rowId, {
                      notes: event.target.value,
                    })
                  }
                  placeholder="Optional details"
                  className="mt-2"
                />
              </div>

              <label className="flex items-center gap-3 pt-8">
                <input
                  type="checkbox"
                  checked={allowance.isTaxable}
                  onChange={(event) =>
                    updateAllowance(allowance.rowId, {
                      isTaxable: event.target.checked,
                    })
                  }
                  className="size-4"
                />

                <span className="text-sm font-medium">Taxable allowance</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allowance.includedInGratuity}
                  onChange={(event) =>
                    updateAllowance(allowance.rowId, {
                      includedInGratuity: event.target.checked,
                    })
                  }
                  className="size-4"
                />

                <span className="text-sm font-medium">
                  Include in gratuity calculation
                </span>
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
