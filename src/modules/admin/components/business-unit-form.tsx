"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { AdministrationNav } from "./administration-nav";
import {
  saveBusinessUnit,
  type BusinessUnitFormState,
} from "@/src/modules/admin/actions/save-business-unit";
import type {
  BusinessUnitOption,
  BusinessUnitRecord,
} from "@/src/modules/admin/data/get-business-units";

type BusinessUnitFormProps = {
  businessUnit?: BusinessUnitRecord | null;
  parentOptions: BusinessUnitOption[];
};

const initialState: BusinessUnitFormState = {
  status: "idle",
  message: "",
};

function dateValue(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function BusinessUnitForm({
  businessUnit,
  parentOptions,
}: BusinessUnitFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    saveBusinessUnit,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);

      if (state.redirectTo) {
        router.push(state.redirectTo);
        router.refresh();
      }
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [router, state]);

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <input type="hidden" name="id" value={businessUnit?.id ?? ""} />
      <input
        type="hidden"
        name="updatedAt"
        value={businessUnit?.updatedAt.toISOString() ?? ""}
      />

      <AdministrationNav />

      <PageHeader
        title={businessUnit ? "Edit Business Unit" : "New Business Unit"}
        description="Manage operational groupings, reporting hierarchy and effective status."
        backHref={
          businessUnit
            ? `/administration/business-units/${businessUnit.id}`
            : "/administration/business-units"
        }
        backLabel={businessUnit ? "Business unit" : "Business units"}
        actions={
          <FormPageActions
            cancelHref={
              businessUnit
                ? `/administration/business-units/${businessUnit.id}`
                : "/administration/business-units"
            }
          >
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving…" : "Save Business Unit"}
            </Button>
          </FormPageActions>
        }
      />

      {state.status !== "idle" && (
        <div
          role={state.status === "success" ? "status" : "alert"}
          className={
            state.status === "success"
              ? "text-sm"
              : "border-y border-destructive/40 bg-destructive/5 py-3 text-sm"
          }
        >
          {state.message}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Business Unit details
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Business Unit name
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={businessUnit?.name ?? ""}
              required
              className="mt-2"
              aria-invalid={Boolean(state.errors?.name)}
            />
            <FieldError id="name-error" message={state.errors?.name} />
          </div>

          <div>
            <label htmlFor="code" className="text-sm font-medium">
              Business Unit code
            </label>
            <Input
              id="code"
              name="code"
              defaultValue={businessUnit?.code ?? ""}
              required
              className="mt-2 font-mono uppercase"
              aria-invalid={Boolean(state.errors?.code)}
            />
            <FieldError id="code-error" message={state.errors?.code} />
          </div>

          <div>
            <label htmlFor="parentId" className="text-sm font-medium">
              Parent Business Unit
            </label>
            <select
              id="parentId"
              name="parentId"
              defaultValue={businessUnit?.parentId ?? ""}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
            >
              <option value="">No parent — top level</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.code})
                </option>
              ))}
            </select>
            <FieldError id="parent-error" message={state.errors?.parentId} />
          </div>

          <div>
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={businessUnit?.status ?? "ACTIVE"}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={businessUnit?.description ?? ""}
              className="mt-2 min-h-28"
              maxLength={1000}
            />
            <FieldError
              id="description-error"
              message={state.errors?.description}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
          Effective period
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="effectiveFrom" className="text-sm font-medium">
              Effective from
            </label>
            <Input
              id="effectiveFrom"
              name="effectiveFrom"
              type="date"
              defaultValue={
                businessUnit
                  ? dateValue(businessUnit.effectiveFrom)
                  : dateValue(new Date())
              }
              className="mt-2"
            />
            <FieldError
              id="effective-from-error"
              message={state.errors?.effectiveFrom}
            />
          </div>

          <div>
            <label htmlFor="effectiveUntil" className="text-sm font-medium">
              Effective until
            </label>
            <Input
              id="effectiveUntil"
              name="effectiveUntil"
              type="date"
              defaultValue={dateValue(businessUnit?.effectiveUntil)}
              className="mt-2"
            />
            <FieldError
              id="effective-until-error"
              message={state.errors?.effectiveUntil}
            />
          </div>
        </div>
      </section>
    </form>
  );
}
