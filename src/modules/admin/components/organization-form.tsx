"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import {
  Building2Icon,
  CheckCircle2Icon,
  CircleAlertIcon,
  Globe2Icon,
  Network,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  FormPageActions,
  PageActionsStart,
} from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  updateOrganization,
  type OrganizationFormState,
} from "@/src/modules/admin/actions/update-organization";
import type { OrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import { AdministrationNav } from "./administration-nav";

type OrganizationFormProps = {
  organization: OrganizationProfile;
  updatedAtLabel: string;
  canManageReporting?: boolean;
};

const initialState: OrganizationFormState = {
  status: "idle",
  message: "",
};

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function OrganizationForm({
  organization,
  updatedAtLabel,
  canManageReporting = false,
}: OrganizationFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateOrganization,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  return (
    <PageShell>
      <AdministrationNav />

      <PageHeader
        title="Edit organization"
        description="Manage organization identity, contact information, regional defaults, operational status and reporting lines."
        backHref="/administration/organization"
        backLabel="Organization"
        actions={
          <>
            {canManageReporting ? (
              <PageActionsStart>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link href="/administration/organization/reporting" />
                  }
                >
                  <Network />
                  Reporting lines
                </Button>
              </PageActionsStart>
            ) : null}
            <FormPageActions cancelHref="/administration/organization">
              <Button type="submit" form="organization-profile-form" disabled={isPending}>
                <SaveIcon />
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </FormPageActions>
          </>
        }
      />

      <form
        key={`${organization.id}-v${organization.version}`}
        id="organization-profile-form"
        action={formAction}
        className="flex flex-col gap-8"
      >
        <input type="hidden" name="id" value={organization.id} />
        <input type="hidden" name="version" value={organization.version} />

        {state.status !== "idle" && (
          <div
            className={
              state.status === "success"
                ? ""
                : "border-y border-destructive/40 bg-destructive/5 py-3"
            }
            role={state.status === "success" ? "status" : "alert"}
          >
            <div className="flex items-start gap-3 px-1">
              {state.status === "success" ? (
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
              ) : (
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <p className="text-sm">{state.message}</p>
            </div>
          </div>
        )}

        <section aria-labelledby="identity-heading">
          <div className="mb-4 flex items-center gap-2">
            <Building2Icon className="size-4 text-muted-foreground" />
            <h2
              id="identity-heading"
              className="text-sm font-semibold tracking-wide uppercase"
            >
              Organization identity
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Display name
              </label>
              <Input
                id="name"
                name="name"
                defaultValue={organization.name}
                required
                maxLength={160}
                className="mt-2"
                aria-invalid={Boolean(state.errors?.name)}
                aria-describedby={state.errors?.name ? "name-error" : undefined}
              />
              <FieldError id="name-error" message={state.errors?.name} />
            </div>

            <div>
              <label htmlFor="code" className="text-sm font-medium">
                Organization code
              </label>
              <Input
                id="code"
                name="code"
                defaultValue={organization.code}
                required
                maxLength={20}
                className="mt-2 font-mono uppercase"
                aria-invalid={Boolean(state.errors?.code)}
                aria-describedby={state.errors?.code ? "code-error" : undefined}
              />
              <FieldError id="code-error" message={state.errors?.code} />
            </div>

            <div>
              <label htmlFor="legalName" className="text-sm font-medium">
                Legal name
              </label>
              <Input
                id="legalName"
                name="legalName"
                defaultValue={organization.legalName ?? ""}
                maxLength={200}
                className="mt-2"
                aria-invalid={Boolean(state.errors?.legalName)}
                aria-describedby={
                  state.errors?.legalName ? "legal-name-error" : undefined
                }
              />
              <FieldError
                id="legal-name-error"
                message={state.errors?.legalName}
              />
            </div>

            <div>
              <label htmlFor="shortName" className="text-sm font-medium">
                Short name
              </label>
              <Input
                id="shortName"
                name="shortName"
                defaultValue={organization.shortName ?? ""}
                maxLength={50}
                className="mt-2"
                placeholder="Shown in the sidebar"
                aria-invalid={Boolean(state.errors?.shortName)}
                aria-describedby={
                  state.errors?.shortName ? "short-name-error" : undefined
                }
              />
              <FieldError
                id="short-name-error"
                message={state.errors?.shortName}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="contact-heading">
          <div className="mb-4 flex items-center gap-2">
            <Globe2Icon className="size-4 text-muted-foreground" />
            <h2
              id="contact-heading"
              className="text-sm font-semibold tracking-wide uppercase"
            >
              Contact information
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                General email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={organization.email ?? ""}
                className="mt-2"
                aria-invalid={Boolean(state.errors?.email)}
                aria-describedby={
                  state.errors?.email ? "email-error" : undefined
                }
              />
              <FieldError id="email-error" message={state.errors?.email} />
            </div>

            <div>
              <label htmlFor="phone" className="text-sm font-medium">
                Telephone
              </label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={organization.phone ?? ""}
                className="mt-2"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="website" className="text-sm font-medium">
                Website
              </label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://example.com"
                defaultValue={organization.website ?? ""}
                className="mt-2"
                aria-invalid={Boolean(state.errors?.website)}
                aria-describedby={
                  state.errors?.website ? "website-error" : undefined
                }
              />
              <FieldError id="website-error" message={state.errors?.website} />
            </div>
          </div>
        </section>

        <section aria-labelledby="regional-heading">
          <h2
            id="regional-heading"
            className="mb-4 text-sm font-semibold tracking-wide uppercase"
          >
            Regional defaults
          </h2>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="defaultTimeZone" className="text-sm font-medium">
                Time zone
              </label>
              <select
                id="defaultTimeZone"
                name="defaultTimeZone"
                defaultValue={organization.defaultTimeZone}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="America/Port_of_Spain">
                  America/Port_of_Spain
                </option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Toronto">America/Toronto</option>
                <option value="Europe/London">Europe/London</option>
                <option value="UTC">UTC</option>
              </select>
              <FieldError
                id="timezone-error"
                message={state.errors?.defaultTimeZone}
              />
            </div>

            <div>
              <label htmlFor="defaultCurrency" className="text-sm font-medium">
                Currency
              </label>
              <select
                id="defaultCurrency"
                name="defaultCurrency"
                defaultValue={organization.defaultCurrency}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="TTD">TTD — Trinidad and Tobago Dollar</option>
                <option value="USD">USD — United States Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="GBP">GBP — Pound Sterling</option>
                <option value="EUR">EUR — Euro</option>
              </select>
              <FieldError
                id="currency-error"
                message={state.errors?.defaultCurrency}
              />
            </div>

            <div>
              <label htmlFor="defaultLanguage" className="text-sm font-medium">
                Language
              </label>
              <select
                id="defaultLanguage"
                name="defaultLanguage"
                defaultValue={organization.defaultLanguage}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="en">English</option>
                <option value="en-TT">English — Trinidad and Tobago</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
              <FieldError
                id="language-error"
                message={state.errors?.defaultLanguage}
              />
            </div>

            <div>
              <label htmlFor="dateFormat" className="text-sm font-medium">
                Date format
              </label>
              <select
                id="dateFormat"
                name="dateFormat"
                defaultValue={organization.dateFormat}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                <option value="yyyy-MM-dd">YYYY-MM-DD</option>
              </select>
              <FieldError
                id="date-format-error"
                message={state.errors?.dateFormat}
              />
            </div>

            <div>
              <label htmlFor="firstDayOfWeek" className="text-sm font-medium">
                First day of week
              </label>
              <select
                id="firstDayOfWeek"
                name="firstDayOfWeek"
                defaultValue={String(organization.firstDayOfWeek)}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
              <FieldError
                id="first-day-error"
                message={state.errors?.firstDayOfWeek}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="status-heading">
          <h2
            id="status-heading"
            className="mb-4 text-sm font-semibold tracking-wide uppercase"
          >
            Operational status
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="status" className="text-sm font-medium">
                Organization status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={organization.status}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <FieldError id="status-error" message={state.errors?.status} />
            </div>

            <div className="flex items-start gap-3 pt-1 md:pt-7">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={organization.isActive}
                className="mt-0.5 size-4"
              />
              <div>
                <label htmlFor="isActive" className="text-sm font-medium">
                  Organization is active
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inactive Organizations should not permit normal operational
                  transactions.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Version {organization.version}</Badge>
            <span>Last updated {updatedAtLabel}</span>
          </div>

          <Button type="submit" disabled={isPending}>
            <SaveIcon />
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </footer>
      </form>

      <section
        aria-labelledby="reporting-lines-callout-heading"
        className="border border-border p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Network className="size-4 text-muted-foreground" />
              <h2
                id="reporting-lines-callout-heading"
                className="text-sm font-semibold tracking-wide uppercase"
              >
                Reporting lines
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Configure which position each role reports to. This is separate
              from organization name and code, and uses the same position
              hierarchy as Employees → Organization.
            </p>
          </div>

          {canManageReporting ? (
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/administration/organization/reporting" />}
            >
              <Network />
              Edit reporting lines
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Requires people.manage to edit.
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
