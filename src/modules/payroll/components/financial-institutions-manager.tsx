"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  updateFinancialInstitution,
  type FinancialInstitutionFormState,
} from "@/src/modules/payroll/actions/update-financial-institution";
import type { FinancialInstitutionRecord } from "@/src/modules/payroll/data/get-financial-institutions";

const initialState: FinancialInstitutionFormState = {
  status: "idle",
  message: "",
};

/**
 * Full institution directory (employee selection flags).
 * ACH routing / credits are edited on /payroll/settings/ach/banks (same table).
 */
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
        Shared bank directory for employee payment destinations. Routing numbers
        and ACH credits are managed on{" "}
        <Link
          href="/payroll/settings/ach/banks"
          className="underline underline-offset-2"
        >
          ACH banks & routing
        </Link>{" "}
        — one table, not a separate list.
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Institution</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Routing</th>
              <th className="px-3 py-2 font-medium">Flags</th>
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
      <td className="px-3 py-3 font-mono text-xs">
        {institution.routingCode ?? "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge variant={institution.isActive ? "success" : "secondary"}>
            {institution.isActive ? "Active" : "Inactive"}
          </Badge>
          {institution.supportsAchCredits ? (
            <Badge variant="outline">ACH</Badge>
          ) : (
            <Badge variant="secondary">No ACH</Badge>
          )}
          {institution.isSelectableForEmployees ? (
            <Badge variant="outline">Selectable</Badge>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3">
        {canManage ? (
          <form action={formAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={institution.id} />
            {/* Preserve ACH fields — edited on ACH banks page */}
            <input
              type="hidden"
              name="routingCode"
              value={institution.routingCode ?? ""}
            />
            {institution.supportsAchCredits ? (
              <input type="hidden" name="supportsAchCredits" value="on" />
            ) : null}
            <input
              type="hidden"
              name="displayName"
              value={institution.displayName}
            />
            <input type="hidden" name="shortName" value={institution.shortName} />
            <input type="hidden" name="legalName" value={institution.legalName} />
            {institution.achParticipantCode ? (
              <input
                type="hidden"
                name="achParticipantCode"
                value={institution.achParticipantCode}
              />
            ) : null}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={institution.isActive}
                className="size-4"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="isSelectableForEmployees"
                defaultChecked={institution.isSelectableForEmployees}
                className="size-4"
              />
              Selectable
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="supportsPayrollDeposits"
                defaultChecked={institution.supportsPayrollDeposits}
                className="size-4"
              />
              Payroll
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/payroll/settings/ach/banks" />}
            >
              ACH…
            </Button>
          </form>
        ) : (
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href="/payroll/settings/ach/banks" />}
          >
            View ACH banks
          </Button>
        )}
      </td>
    </tr>
  );
}
