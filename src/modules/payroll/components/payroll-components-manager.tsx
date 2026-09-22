"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  savePayrollComponentDefinition,
  type PayrollComponentFormState,
} from "@/src/modules/payroll/actions/manage-payroll-recurring-components";
import type { PayrollComponentDefinitionRecord } from "@/src/modules/payroll/data/get-payroll-recurring-components";
import { formatMoney } from "@/src/lib/format";

const initialState: PayrollComponentFormState = {
  status: "idle",
  message: "",
};

const CATEGORY_OPTIONS = [
  { value: "LOAN", label: "Loan" },
  { value: "GARNISHMENT", label: "Garnishment" },
  { value: "PENSION_INSTALLMENT", label: "Pension installment" },
  { value: "VOLUNTARY_DEDUCTION", label: "Voluntary deduction" },
  { value: "RECURRING_EARNING", label: "Recurring earning" },
] as const;

const TAX_TREATMENT_OPTIONS = [
  { value: "NON_TAXABLE", label: "Non-taxable" },
  { value: "TAXABLE_EMPLOYMENT", label: "Taxable employment" },
  { value: "NIS_ONLY", label: "NIS only" },
  { value: "PAYE_EXEMPT", label: "PAYE exempt" },
] as const;

function categoryLabel(value: string): string {
  return (
    CATEGORY_OPTIONS.find((option) => option.value === value)?.label ??
    value.replaceAll("_", " ")
  );
}

function taxTreatmentLabel(value: string): string {
  return (
    TAX_TREATMENT_OPTIONS.find((option) => option.value === value)?.label ??
    value.replaceAll("_", " ")
  );
}

export function PayrollComponentsManager({
  definitions,
  canManage,
}: {
  definitions: PayrollComponentDefinitionRecord[];
  canManage: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Organization-scoped masters for loans, garnishments, pension
        installments, voluntary deductions, and recurring earnings. Assign them
        on each employee&apos;s payroll setup page.
      </p>

      {canManage ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCreate((current) => !current)}
          >
            <Plus />
            {showCreate ? "Hide form" : "New component"}
          </Button>
        </div>
      ) : null}

      {canManage && showCreate ? (
        <DefinitionForm
          key="create"
          canManage={canManage}
          onSuccess={() => setShowCreate(false)}
        />
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Tax</th>
              <th className="px-3 py-2 font-medium">Default</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Assignments</th>
              {canManage ? (
                <th className="px-3 py-2 font-medium">Edit</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {definitions.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 9 : 8}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No component definitions yet.
                </td>
              </tr>
            ) : (
              definitions.map((definition) => (
                <DefinitionRow
                  key={definition.id}
                  definition={definition}
                  canManage={canManage}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DefinitionRow({
  definition,
  canManage,
}: {
  definition: PayrollComponentDefinitionRecord;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && canManage) {
    return (
      <tr className="border-b">
        <td colSpan={9} className="px-3 py-4">
          <DefinitionForm
            definition={definition}
            canManage={canManage}
            onSuccess={() => setEditing(false)}
          />
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b align-top">
      <td className="px-3 py-3 font-mono text-xs">{definition.code}</td>
      <td className="px-3 py-3">
        <p className="font-medium">{definition.name}</p>
      </td>
      <td className="px-3 py-3 text-xs">
        {categoryLabel(definition.category)}
      </td>
      <td className="px-3 py-3 text-xs">{definition.kind}</td>
      <td className="px-3 py-3 text-xs">
        {taxTreatmentLabel(definition.taxTreatment)}
      </td>
      <td className="px-3 py-3 text-xs">
        {definition.defaultAmount != null
          ? formatMoney(definition.defaultAmount, { currency: "TTD" })
          : "—"}
      </td>
      <td className="px-3 py-3">
        <Badge variant={definition.isActive ? "success" : "secondary"}>
          {definition.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-3 py-3 text-xs">{definition.assignmentCount}</td>
      {canManage ? (
        <td className="px-3 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </td>
      ) : null}
    </tr>
  );
}

function DefinitionForm({
  definition,
  canManage,
  onSuccess,
}: {
  definition?: PayrollComponentDefinitionRecord;
  canManage: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    savePayrollComponentDefinition,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess?.();
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, onSuccess]);

  if (!canManage) {
    return null;
  }

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-md border border-border/70 p-4 md:grid-cols-3"
    >
      {definition ? <input type="hidden" name="id" value={definition.id} /> : null}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="code">
          Code
        </label>
        <Input
          id="code"
          name="code"
          defaultValue={definition?.code ?? ""}
          placeholder="LOAN-STAFF"
          required
        />
        {state.fieldErrors?.code ? (
          <p className="text-xs text-destructive">{state.fieldErrors.code}</p>
        ) : null}
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <label className="text-xs text-muted-foreground" htmlFor="name">
          Name
        </label>
        <Input
          id="name"
          name="name"
          defaultValue={definition?.name ?? ""}
          placeholder="Staff loan repayment"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="category">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={definition?.category ?? "LOAN"}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="taxTreatment">
          Tax treatment
        </label>
        <select
          id="taxTreatment"
          name="taxTreatment"
          defaultValue={definition?.taxTreatment ?? "NON_TAXABLE"}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {TAX_TREATMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="defaultAmount"
        >
          Default amount (optional)
        </label>
        <Input
          id="defaultAmount"
          name="defaultAmount"
          defaultValue={definition?.defaultAmount ?? ""}
          placeholder="0.00"
          inputMode="decimal"
        />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={definition?.isActive ?? true}
          />
          Active
        </label>
        <Button type="submit" disabled={pending}>
          <Save />
          {pending ? "Saving…" : definition ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
