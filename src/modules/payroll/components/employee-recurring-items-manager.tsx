"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Repeat, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import {
  saveEmployeeRecurringItem,
  type PayrollComponentFormState,
} from "@/src/modules/payroll/actions/manage-payroll-recurring-components";
import type { EmployeeRecurringItemRecord } from "@/src/modules/payroll/data/get-payroll-recurring-components";

const initialState: PayrollComponentFormState = {
  status: "idle",
  message: "",
};

type DefinitionOption = {
  id: string;
  code: string;
  name: string;
  kind: string;
  category: string;
  defaultAmount: string | null;
};

export function EmployeeRecurringItemsManager({
  employeeId,
  items,
  definitions,
  canManage,
  currency = "TTD",
}: {
  employeeId: string;
  items: EmployeeRecurringItemRecord[];
  definitions: DefinitionOption[];
  canManage: boolean;
  currency?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />
          <SectionHeading>Recurring earnings & deductions</SectionHeading>
        </div>
        {canManage && definitions.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreate((current) => !current)}
          >
            <Plus />
            {showCreate ? "Hide" : "Assign"}
          </Button>
        ) : null}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Applied automatically into payslip preview and draft pay runs when
        active for the period. Optional remaining balance decreases when a
        regular pay run is posted.
      </p>

      {definitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active component definitions. Create them under Payroll → Settings
          → Recurring components.
        </p>
      ) : null}

      {canManage && showCreate && definitions.length > 0 ? (
        <div className="mb-4">
          <AssignmentForm
            employeeId={employeeId}
            definitions={definitions}
            onSuccess={() => setShowCreate(false)}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recurring items assigned to this employee.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AssignmentCard
              key={item.id}
              employeeId={employeeId}
              item={item}
              canManage={canManage}
              currency={currency}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AssignmentCard({
  employeeId,
  item,
  canManage,
  currency,
}: {
  employeeId: string;
  item: EmployeeRecurringItemRecord;
  canManage: boolean;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && canManage) {
    return (
      <div className="rounded-md border border-border/70 p-4">
        <AssignmentForm
          employeeId={employeeId}
          item={item}
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
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/70 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{item.definitionName}</p>
          <Badge variant={item.isActive ? "success" : "secondary"}>
            {item.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline">{item.kind}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.definitionCode} · {item.category.replaceAll("_", " ")}
          {item.isTaxable ? " · Taxable" : ""}
        </p>
        <p className="mt-2 text-sm">
          {formatMoney(item.amount, { currency })} / period
          {item.remainingBalance != null
            ? ` · Balance ${formatMoney(item.remainingBalance, { currency })}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.startDate}
          {item.endDate ? ` → ${item.endDate}` : " → open"}
        </p>
        {item.notes ? (
          <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
        ) : null}
      </div>
      {canManage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
      ) : null}
    </div>
  );
}

function AssignmentForm({
  employeeId,
  item,
  definitions,
  onSuccess,
}: {
  employeeId: string;
  item?: EmployeeRecurringItemRecord;
  definitions?: DefinitionOption[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveEmployeeRecurringItem,
    initialState,
  );
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(
    item?.definitionId ?? definitions?.[0]?.id ?? "",
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess?.();
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, onSuccess]);

  const selectedDefinition = definitions?.find(
    (definition) => definition.id === selectedDefinitionId,
  );

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-md border border-border/70 bg-muted/10 p-4 md:grid-cols-2"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      {!item && definitions ? (
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs text-muted-foreground" htmlFor="definitionId">
            Component
          </label>
          <select
            id="definitionId"
            name="definitionId"
            value={selectedDefinitionId}
            onChange={(event) => setSelectedDefinitionId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {definitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.code} — {definition.name} ({definition.kind})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="amount">
          Amount per period
        </label>
        <Input
          id="amount"
          name="amount"
          defaultValue={
            item?.amount ?? selectedDefinition?.defaultAmount ?? ""
          }
          key={`${item?.id ?? "new"}-${selectedDefinitionId}-amount`}
          required
          inputMode="decimal"
        />
      </div>
      <div className="space-y-1.5">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="remainingBalance"
        >
          Remaining balance (optional)
        </label>
        <Input
          id="remainingBalance"
          name="remainingBalance"
          defaultValue={item?.remainingBalance ?? ""}
          placeholder="Leave blank for open-ended"
          inputMode="decimal"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="startDate">
          Start date
        </label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={item?.startDate ?? new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="endDate">
          End date (optional)
        </label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={item?.endDate ?? ""}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <label className="text-xs text-muted-foreground" htmlFor="notes">
          Notes
        </label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={2}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={item?.isActive ?? true}
          />
          Active
        </label>
        <Button type="submit" disabled={pending}>
          <Save />
          {pending ? "Saving…" : item ? "Update assignment" : "Assign"}
        </Button>
      </div>
    </form>
  );
}
