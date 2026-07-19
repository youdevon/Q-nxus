"use client";

import { useActionState, useEffect, useState } from "react";
import { Save, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import type { CorrespondenceCategory } from "@/generated/prisma/client";
import {
  createEmployeeCorrespondence,
  updateEmployeeCorrespondence,
  type CorrespondenceFormState,
} from "@/src/modules/hr/actions/manage-employee-correspondence";
import {
  CORRESPONDENCE_CATEGORIES,
  defaultRequiresAcknowledgement,
  isRestrictedCategory,
} from "@/src/modules/hr/lib/correspondence-visibility";
import { defaultAllowsEmployeeResponse } from "@/src/modules/hr/lib/correspondence-response";

const initialState: CorrespondenceFormState = {
  status: "idle",
  message: "",
};

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type CorrespondenceFormProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  mode: "create" | "edit";
  templates?: Array<{ id: string; name: string; category: string }>;
  initial?: {
    id?: string;
    category: string;
    subType?: string | null;
    title: string;
    body: string | null;
    effectiveDate: string;
    retentionUntil: string | null;
    employeeVisible: boolean;
    managerVisible?: boolean;
    requiresAcknowledgement: boolean;
    allowsEmployeeResponse?: boolean;
    templateId?: string | null;
  };
};

export function CorrespondenceForm({
  employee,
  mode,
  templates = [],
  initial,
}: CorrespondenceFormProps) {
  const action =
    mode === "create"
      ? createEmployeeCorrespondence
      : updateEmployeeCorrespondence;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [category, setCategory] = useState<CorrespondenceCategory>(
    (initial?.category as CorrespondenceCategory) ?? "GENERAL",
  );
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(
    initial?.requiresAcknowledgement ??
      defaultRequiresAcknowledgement(
        (initial?.category as CorrespondenceCategory) ?? "GENERAL",
      ),
  );
  const [allowsEmployeeResponse, setAllowsEmployeeResponse] = useState(
    initial?.allowsEmployeeResponse ??
      defaultAllowsEmployeeResponse(
        (initial?.category as CorrespondenceCategory) ?? "GENERAL",
      ),
  );
  const [employeeVisible, setEmployeeVisible] = useState(
    initial?.employeeVisible ?? true,
  );
  const [managerVisible, setManagerVisible] = useState(
    initial?.managerVisible ?? false,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const restricted = isRestrictedCategory(category);
  const cancelHref =
    mode === "edit" && initial?.id
      ? `/people/employees/${employee.id}/documents/${initial.id}`
      : `/people/employees/${employee.id}/documents`;

  return (
    <form action={formAction}>
      <input type="hidden" name="employeeId" value={employee.id} />
      {mode === "edit" && initial?.id ? (
        <input type="hidden" name="correspondenceId" value={initial.id} />
      ) : null}
      <input
        type="hidden"
        name="requiresAcknowledgement"
        value={requiresAcknowledgement ? "true" : "false"}
      />
      <input
        type="hidden"
        name="allowsEmployeeResponse"
        value={allowsEmployeeResponse ? "true" : "false"}
      />
      <input
        type="hidden"
        name="employeeVisible"
        value={!restricted && employeeVisible ? "true" : "false"}
      />
      <input
        type="hidden"
        name="managerVisible"
        value={!restricted && managerVisible ? "true" : "false"}
      />
      {templateId ? (
        <input type="hidden" name="templateId" value={templateId} />
      ) : null}

      <PageShell>
        <PeoplePageHeader
          title={mode === "create" ? "New correspondence" : "Edit draft"}
          description={`${employee.firstName} ${employee.lastName} · ${employee.employeeNumber}`}
          backHref={cancelHref}
          backLabel={mode === "edit" ? "Letter" : "Employee file"}
          actions={
            <FormPageActions cancelHref={cancelHref}>
              {mode === "create" ? (
                <>
                  <Button
                    type="submit"
                    name="issueNow"
                    value="false"
                    variant="outline"
                    disabled={pending}
                  >
                    <Save />
                    {pending ? "Saving…" : "Save draft"}
                  </Button>
                  <Button
                    type="submit"
                    name="issueNow"
                    value="true"
                    disabled={pending}
                  >
                    <Send />
                    {pending ? "Issuing…" : "Save & issue"}
                  </Button>
                </>
              ) : (
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              )}
            </FormPageActions>
          }
        />

        {mode === "create" && templates.length > 0 ? (
          <section className="space-y-2">
            <label className="text-sm font-medium" htmlFor="templateSelect">
              Start from template
            </label>
            <select
              id="templateSelect"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={templateId}
              onChange={(event) => {
                const next = event.target.value;
                setTemplateId(next);
                if (!next) {
                  return;
                }
                window.location.href = `/people/employees/${employee.id}/documents/new?templateId=${encodeURIComponent(next)}`;
              }}
            >
              <option value="">Blank letter</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({label(template.category)})
                </option>
              ))}
            </select>
          </section>
        ) : null}

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={category}
              onChange={(event) => {
                const next = event.target.value as CorrespondenceCategory;
                setCategory(next);
                setRequiresAcknowledgement(defaultRequiresAcknowledgement(next));
                setAllowsEmployeeResponse(defaultAllowsEmployeeResponse(next));
                if (isRestrictedCategory(next)) {
                  setEmployeeVisible(false);
                  setManagerVisible(false);
                }
              }}
            >
              {CORRESPONDENCE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
            {state.fieldErrors?.category ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.category}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="effectiveDate">
              Effective date
            </label>
            <Input
              id="effectiveDate"
              name="effectiveDate"
              type="date"
              defaultValue={
                initial?.effectiveDate ??
                new Date().toISOString().slice(0, 10)
              }
              required
            />
            {state.fieldErrors?.effectiveDate ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.effectiveDate}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="subType">
              Tag / sub-type (optional)
            </label>
            <Input
              id="subType"
              name="subType"
              defaultValue={initial?.subType ?? ""}
              placeholder="FIRST_WARNING, FINAL_WARNING…"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="retentionUntil">
              Retain until (optional)
            </label>
            <Input
              id="retentionUntil"
              name="retentionUntil"
              type="date"
              defaultValue={initial?.retentionUntil ?? ""}
            />
            {state.fieldErrors?.retentionUntil ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.retentionUntil}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="title">
              Title
            </label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Letter of recommendation, written warning…"
              required
            />
            {state.fieldErrors?.title ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.title}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="body">
              Body (optional)
            </label>
            <Textarea
              id="body"
              name="body"
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Letter text or notes…"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="attachment">
              Attachment (optional)
            </label>
            <Input
              id="attachment"
              name="attachment"
              type="file"
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
            />
            <p className="text-xs text-muted-foreground">
              PDF, Word, or image · max 5 MB
            </p>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <SectionHeading>Visibility & acknowledgement</SectionHeading>
          </div>

          {restricted ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Medical and identification documents are always HR-only.
            </p>
          ) : null}

          <div className="grid gap-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={!restricted && employeeVisible}
                disabled={restricted}
                onChange={(event) => setEmployeeVisible(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="font-medium">Employee visible</span>
                <span className="mt-1 block text-muted-foreground">
                  When issued, the employee can view this letter on My Profile.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={!restricted && managerVisible}
                disabled={restricted}
                onChange={(event) => setManagerVisible(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="font-medium">Manager visible</span>
                <span className="mt-1 block text-muted-foreground">
                  The reporting officer can view this issued letter read-only.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={requiresAcknowledgement}
                onChange={(event) =>
                  setRequiresAcknowledgement(event.target.checked)
                }
                className="mt-0.5 size-4"
              />
              <span>
                <span className="font-medium">Requires acknowledgement</span>
                <span className="mt-1 block text-muted-foreground">
                  Typical for disciplinary, warning, instruction, and policy
                  letters.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={allowsEmployeeResponse}
                onChange={(event) =>
                  setAllowsEmployeeResponse(event.target.checked)
                }
                className="mt-0.5 size-4"
              />
              <span>
                <span className="font-medium">Allow employee response</span>
                <span className="mt-1 block text-muted-foreground">
                  Lets the employee submit a written statement (typical for
                  disciplinary, warning, and performance letters).
                </span>
              </span>
            </label>
          </div>
        </section>
      </PageShell>
    </form>
  );
}
