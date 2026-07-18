"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateFinancialInstitution,
  type FinancialInstitutionFormState,
} from "@/src/modules/payroll/actions/update-financial-institution";
import type { FinancialInstitutionRecord } from "@/src/modules/payroll/data/get-financial-institutions";

const initialState: FinancialInstitutionFormState = {
  status: "idle",
  message: "",
};

export function FinancialInstitutionsManager({
  institutions,
  canManage,
}: {
  institutions: FinancialInstitutionRecord[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ACH routing and participant codes are placeholders until confirmed with
        the originating bank — leave blank rather than inventing values
        (REQUIRES_CONFIRMATION).
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Institution</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Flags</th>
              <th className="px-3 py-2 font-medium">
                Routing (placeholder)
              </th>
              <th className="px-3 py-2 font-medium">
                ACH participant (placeholder)
              </th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {institutions.map((institution) => (
              <InstitutionRow
                key={institution.id}
                institution={institution}
                canManage={canManage}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InstitutionRow({
  institution,
  canManage,
}: {
  institution: FinancialInstitutionRecord;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateFinancialInstitution,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <tr className="border-b align-top">
      <td className="px-3 py-3">
        <p className="font-medium">{institution.displayName}</p>
        <p className="text-xs text-muted-foreground">
          {institution.shortName}
          {institution.catalogKey ? ` · ${institution.catalogKey}` : ""}
        </p>
      </td>
      <td className="px-3 py-3 text-xs">
        {institution.institutionType.replaceAll("_", " ")}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge variant={institution.isActive ? "success" : "secondary"}>
            {institution.isActive ? "Active" : "Inactive"}
          </Badge>
          {institution.supportsAchCredits ? (
            <Badge variant="outline">ACH credits</Badge>
          ) : (
            <Badge variant="secondary">No ACH</Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-3" colSpan={canManage ? 3 : 2}>
        {canManage ? (
          <form action={formAction} className="grid gap-2 md:grid-cols-3">
            <input type="hidden" name="id" value={institution.id} />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={institution.isActive}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="isSelectableForEmployees"
                defaultChecked={institution.isSelectableForEmployees}
              />
              Selectable
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="supportsPayrollDeposits"
                defaultChecked={institution.supportsPayrollDeposits}
              />
              Payroll deposits
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="supportsAchCredits"
                defaultChecked={institution.supportsAchCredits}
              />
              ACH credits
            </label>
            <Input
              name="routingCode"
              defaultValue={institution.routingCode ?? ""}
              placeholder="Routing — REQUIRES_CONFIRMATION"
              className="md:col-span-1"
            />
            <Input
              name="achParticipantCode"
              defaultValue={institution.achParticipantCode ?? ""}
              placeholder="ACH participant — REQUIRES_CONFIRMATION"
            />
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">
            Routing: {institution.routingCode ?? "—"} · ACH:{" "}
            {institution.achParticipantCode ?? "—"}
          </p>
        )}
      </td>
    </tr>
  );
}
