"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/src/components/layout/page-header";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import { AdministrationNav } from "./administration-nav";
import {
  saveLocation,
  type LocationFormState,
} from "@/src/modules/admin/actions/save-location";
import type {
  LocationRecord,
  LocationTypeOption,
} from "@/src/modules/admin/data/get-locations";

type LocationFormProps = {
  location?: LocationRecord | null;
  locationTypes: LocationTypeOption[];
};

const initialState: LocationFormState = {
  status: "idle",
  message: "",
};

function dateValue(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
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

export function LocationForm({ location, locationTypes }: LocationFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    saveLocation,
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
    <form action={formAction}>
      <PageShell>
        <input type="hidden" name="id" value={location?.id ?? ""} />
        <input
          type="hidden"
          name="updatedAt"
          value={location?.updatedAt.toISOString() ?? ""}
        />

        <AdministrationNav />

        <PageHeader
          title={location ? "Edit location" : "New location"}
          description="Manage workplace identity, address, regional settings and operational dates."
          backHref={
            location
              ? `/administration/locations/${location.id}`
              : "/administration/locations"
          }
          backLabel={location ? "Location" : "Locations"}
          actions={
            <FormPageActions
              cancelHref={
                location
                  ? `/administration/locations/${location.id}`
                  : "/administration/locations"
              }
            >
              <Button type="submit" disabled={isPending}>
                <Save />
                {isPending ? "Saving…" : "Save location"}
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
            Location identity
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Location name
              </label>
              <Input
                id="name"
                name="name"
                defaultValue={location?.name ?? ""}
                required
                className="mt-2"
                aria-invalid={Boolean(state.errors?.name)}
              />
              <FieldError id="name-error" message={state.errors?.name} />
            </div>

            <div>
              <label htmlFor="code" className="text-sm font-medium">
                Location code
              </label>
              <Input
                id="code"
                name="code"
                defaultValue={location?.code ?? ""}
                required
                className="mt-2 font-mono uppercase"
                aria-invalid={Boolean(state.errors?.code)}
              />
              <FieldError id="code-error" message={state.errors?.code} />
            </div>

            <div>
              <label htmlFor="locationType" className="text-sm font-medium">
                Location type
              </label>
              <select
                id="locationType"
                name="locationType"
                defaultValue={location?.locationType ?? ""}
                required
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select a type</option>
                {locationTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.label}
                  </option>
                ))}
              </select>
              <FieldError
                id="location-type-error"
                message={state.errors?.locationType}
              />
            </div>

            <div>
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={location?.status ?? "ACTIVE"}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            Address
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="addressLine1" className="text-sm font-medium">
                Address line 1
              </label>
              <Input
                id="addressLine1"
                name="addressLine1"
                defaultValue={location?.addressLine1 ?? ""}
                className="mt-2"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="addressLine2" className="text-sm font-medium">
                Address line 2
              </label>
              <Input
                id="addressLine2"
                name="addressLine2"
                defaultValue={location?.addressLine2 ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="city" className="text-sm font-medium">
                City
              </label>
              <Input
                id="city"
                name="city"
                defaultValue={location?.city ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="region" className="text-sm font-medium">
                Region
              </label>
              <Input
                id="region"
                name="region"
                defaultValue={location?.region ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="countryCode" className="text-sm font-medium">
                Country code
              </label>
              <Input
                id="countryCode"
                name="countryCode"
                defaultValue={location?.countryCode ?? "TT"}
                maxLength={2}
                className="mt-2 uppercase"
              />
              <FieldError
                id="country-code-error"
                message={state.errors?.countryCode}
              />
            </div>

            <div>
              <label htmlFor="postalCode" className="text-sm font-medium">
                Postal code
              </label>
              <Input
                id="postalCode"
                name="postalCode"
                defaultValue={location?.postalCode ?? ""}
                className="mt-2"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            Regional and effective settings
          </h2>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label htmlFor="timeZone" className="text-sm font-medium">
                Time zone
              </label>
              <select
                id="timeZone"
                name="timeZone"
                defaultValue={location?.timeZone ?? "America/Port_of_Spain"}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              >
                <option value="America/Port_of_Spain">
                  America/Port_of_Spain
                </option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Toronto">America/Toronto</option>
                <option value="Europe/London">Europe/London</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label htmlFor="effectiveFrom" className="text-sm font-medium">
                Effective from
              </label>
              <Input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                defaultValue={
                  location
                    ? dateValue(location.effectiveFrom)
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
                defaultValue={dateValue(location?.effectiveUntil)}
                className="mt-2"
              />
              <FieldError
                id="effective-until-error"
                message={state.errors?.effectiveUntil}
              />
            </div>
          </div>
        </section>
      </PageShell>
    </form>
  );
}
