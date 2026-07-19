"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  createCorrespondenceTemplate,
  updateCorrespondenceTemplate,
  type TemplateFormState,
} from "@/src/modules/hr/actions/manage-correspondence-templates";
import { defaultAllowsEmployeeResponse } from "@/src/modules/hr/lib/correspondence-response";
import { CORRESPONDENCE_CATEGORIES } from "@/src/modules/hr/lib/correspondence-visibility";

const initialState: TemplateFormState = {
  status: "idle",
  message: "",
};

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type TemplateFormProps = {
  mode: "create" | "edit";
  initial?: {
    id: string;
    name: string;
    category: string;
    defaultTitle: string;
    body: string;
    employeeVisible: boolean;
    requiresAcknowledgement: boolean;
    allowsEmployeeResponse: boolean;
    isActive: boolean;
  };
};

export function CorrespondenceTemplateForm({
  mode,
  initial,
}: TemplateFormProps) {
  const action =
    mode === "create"
      ? createCorrespondenceTemplate
      : updateCorrespondenceTemplate;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const cancelHref = "/people/documents/templates";

  return (
    <form action={formAction}>
      {mode === "edit" && initial ? (
        <input type="hidden" name="templateId" value={initial.id} />
      ) : null}

      <PageShell>
        <PeoplePageHeader
          title={mode === "create" ? "New letter template" : "Edit template"}
          description="Use {{employeeName}}, {{position}}, {{date}}, {{employeeNumber}}, {{nisNumber}}, and {{birNumber}} placeholders."
          backHref={cancelHref}
          backLabel="Templates"
          actions={
            <FormPageActions cancelHref={cancelHref}>
              <Button type="submit" disabled={pending}>
                <Save />
                {pending ? "Saving…" : "Save template"}
              </Button>
            </FormPageActions>
          }
        />

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Template name
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name ?? ""}
              required
            />
            {state.fieldErrors?.name ? (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              defaultValue={initial?.category ?? "GENERAL"}
            >
              {CORRESPONDENCE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="defaultTitle">
              Default title
            </label>
            <Input
              id="defaultTitle"
              name="defaultTitle"
              defaultValue={initial?.defaultTitle ?? ""}
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="body">
              Body
            </label>
            <Textarea
              id="body"
              name="body"
              rows={10}
              defaultValue={initial?.body ?? ""}
              required
            />
          </div>
        </section>

        <section className="grid gap-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="employeeVisible"
              value="true"
              defaultChecked={initial?.employeeVisible ?? true}
              className="mt-0.5 size-4"
            />
            <span className="font-medium">Employee visible by default</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="requiresAcknowledgement"
              value="true"
              defaultChecked={initial?.requiresAcknowledgement ?? false}
              className="mt-0.5 size-4"
            />
            <span className="font-medium">Requires acknowledgement</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="allowsEmployeeResponse"
              value="true"
              defaultChecked={
                initial?.allowsEmployeeResponse ??
                defaultAllowsEmployeeResponse(
                  (initial?.category ?? "GENERAL") as never,
                )
              }
              className="mt-0.5 size-4"
            />
            <span className="font-medium">Allow employee response</span>
          </label>
          {mode === "edit" ? (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={initial?.isActive ?? true}
                className="mt-0.5 size-4"
              />
              <span className="font-medium">Active</span>
            </label>
          ) : null}
        </section>
      </PageShell>
    </form>
  );
}
