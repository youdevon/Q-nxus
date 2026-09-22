"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createFinancialInstitution,
  updateFinancialInstitution,
  type FinancialInstitutionFormState,
} from "@/src/modules/payroll/actions/update-financial-institution";
import type { FinancialInstitutionRecord } from "@/src/modules/payroll/data/get-financial-institutions";

const idle: FinancialInstitutionFormState = { status: "idle", message: "" };

function FormToast({ state }: { state: FinancialInstitutionFormState }) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
  return null;
}

export function AchBanksManager({
  institutions,
  canManage,
}: {
  institutions: FinancialInstitutionRecord[];
  canManage: boolean;
}) {
  const achEnabled = institutions.filter(
    (row) => row.supportsAchCredits && row.routingCode,
  );
  const otherWithRouting = institutions.filter(
    (row) => row.routingCode && !row.supportsAchCredits,
  );
  const withoutRouting = institutions.filter((row) => !row.routingCode);

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        These banks are accepted on FCB Business Online ACH salary files.
        Enable <strong>ACH credits</strong> and set a valid 9-digit routing
        number (NACHA 3-7-1 check digit) when a new bank joins TT ACH. Optional
        account min/max lengths produce export warnings only.
      </p>

      {canManage ? <AddAchBankForm /> : null}

      <BankTable
        title="ACH-enabled banks"
        description={`${achEnabled.length} participant${achEnabled.length === 1 ? "" : "s"} used when generating ACH files.`}
        institutions={achEnabled}
        canManage={canManage}
        empty="No ACH banks yet. Add one above, or enable ACH credits on an existing institution."
      />

      <BankTable
        title="Routing on file — ACH not enabled"
        description="Have a routing number but ACH credits is off. Turn ACH on when confirmed."
        institutions={otherWithRouting}
        canManage={canManage}
        empty="None."
      />

      {withoutRouting.length > 0 ? (
        <details className="rounded-md border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            Institutions without routing ({withoutRouting.length})
          </summary>
          <div className="mt-4">
            <BankTable
              title=""
              description="Still available for employee selection; cannot appear on ACH files until routing + ACH credits are set."
              institutions={withoutRouting}
              canManage={canManage}
              empty=""
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function AddAchBankForm() {
  const [state, formAction, pending] = useActionState(
    createFinancialInstitution,
    idle,
  );

  return (
    <section className="rounded-md border p-4">
      <FormToast state={state} />
      <h2 className="text-sm font-semibold tracking-wide uppercase">
        Add ACH bank
      </h2>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        Use this when a new institution starts supporting domestic ACH credits.
      </p>
      <form
        action={formAction}
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        <label className="grid gap-1 text-xs">
          Legal name
          <Input name="legalName" required placeholder="Full legal name" />
        </label>
        <label className="grid gap-1 text-xs">
          Display name
          <Input name="displayName" placeholder="Defaults to legal name" />
        </label>
        <label className="grid gap-1 text-xs">
          Short name
          <Input name="shortName" required placeholder="e.g. FCB" />
        </label>
        <label className="grid gap-1 text-xs">
          Routing (9 digits)
          <Input
            name="routingCode"
            required
            inputMode="numeric"
            pattern="[0-9]{9}"
            placeholder="010100013"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Account min length
          <Input
            name="accountNumberMinLength"
            inputMode="numeric"
            placeholder="e.g. 7"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Account max length
          <Input
            name="accountNumberMaxLength"
            inputMode="numeric"
            placeholder="e.g. 17"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Type
          <select
            name="institutionType"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue="COMMERCIAL_BANK"
          >
            <option value="COMMERCIAL_BANK">Commercial bank</option>
            <option value="CREDIT_UNION">Credit union</option>
            <option value="LICENSED_NON_BANK">Licensed non-bank</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          ACH participant code (optional)
          <Input name="achParticipantCode" placeholder="If bank provides one" />
        </label>
        <div className="flex flex-wrap items-end gap-4 text-xs md:col-span-2 lg:col-span-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="supportsAchCredits"
              defaultChecked
              className="size-4"
            />
            ACH credits
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isSelectableForEmployees"
              defaultChecked
              className="size-4"
            />
            Selectable
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="supportsPayrollDeposits"
              defaultChecked
              className="size-4"
            />
            Payroll deposits
          </label>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add bank"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function BankTable({
  title,
  description,
  institutions,
  canManage,
  empty,
}: {
  title: string;
  description: string;
  institutions: FinancialInstitutionRecord[];
  canManage: boolean;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      {title ? (
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {institutions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Bank</th>
                <th className="px-3 py-2 font-medium">Routing</th>
                <th className="px-3 py-2 font-medium">Account length</th>
                <th className="px-3 py-2 font-medium">Flags</th>
                {canManage ? (
                  <th className="px-3 py-2 font-medium">Edit</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {institutions.map((institution) => (
                <AchBankRow
                  key={institution.id}
                  institution={institution}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AchBankRow({
  institution,
  canManage,
}: {
  institution: FinancialInstitutionRecord;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateFinancialInstitution,
    idle,
  );

  return (
    <tr className="border-b align-top">
      <FormToast state={state} />
      <td className="px-3 py-3">
        <p className="font-medium">{institution.displayName}</p>
        <p className="text-xs text-muted-foreground">
          {institution.shortName}
          {institution.catalogKey ? ` · ${institution.catalogKey}` : " · manual"}
        </p>
      </td>
      {!canManage ? (
        <>
          <td className="px-3 py-3 font-mono text-xs">
            {institution.routingCode ?? "—"}
          </td>
          <td className="px-3 py-3 text-xs">
            {institution.accountNumberMinLength ?? "—"}–
            {institution.accountNumberMaxLength ?? "—"}
          </td>
          <td className="px-3 py-3">
            <FlagBadges institution={institution} />
          </td>
        </>
      ) : (
        <td className="px-3 py-3" colSpan={4}>
          <form
            action={formAction}
            className="grid gap-2 md:grid-cols-6 md:items-end"
          >
            <input type="hidden" name="id" value={institution.id} />
            <label className="grid gap-1 text-xs md:col-span-2">
              Display name
              <Input
                name="displayName"
                defaultValue={institution.displayName}
              />
            </label>
            <input type="hidden" name="legalName" value={institution.legalName} />
            <label className="grid gap-1 text-xs">
              Short name
              <Input name="shortName" defaultValue={institution.shortName} />
            </label>
            <label className="grid gap-1 text-xs">
              Routing
              <Input
                name="routingCode"
                defaultValue={institution.routingCode ?? ""}
                inputMode="numeric"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Acct min
              <Input
                name="accountNumberMinLength"
                defaultValue={institution.accountNumberMinLength ?? ""}
                inputMode="numeric"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Acct max
              <Input
                name="accountNumberMaxLength"
                defaultValue={institution.accountNumberMaxLength ?? ""}
                inputMode="numeric"
              />
            </label>
            <div className="flex flex-wrap gap-3 text-xs md:col-span-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={institution.isActive}
                  className="size-4"
                />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="supportsAchCredits"
                  defaultChecked={institution.supportsAchCredits}
                  className="size-4"
                />
                ACH credits
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isSelectableForEmployees"
                  defaultChecked={institution.isSelectableForEmployees}
                  className="size-4"
                />
                Selectable
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="supportsPayrollDeposits"
                  defaultChecked={institution.supportsPayrollDeposits}
                  className="size-4"
                />
                Payroll deposits
              </label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </td>
      )}
    </tr>
  );
}

function FlagBadges({
  institution,
}: {
  institution: FinancialInstitutionRecord;
}) {
  return (
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
  );
}
