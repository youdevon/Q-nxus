"use client"

import { useActionState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/src/components/layout/page-header"
import { AdministrationNav } from "./administration-nav"
import {
  saveFeatureControls,
  type FeatureControlsFormState,
} from "@/src/modules/admin/actions/save-feature-controls"
import type { FeatureControlRecord } from "@/src/modules/admin/data/get-feature-controls"

type FeatureControlsFormProps = {
  features: FeatureControlRecord[]
}

const initialState: FeatureControlsFormState = {
  status: "idle",
  message: "",
}

function formatFeatureName(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function dateValue(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ""
}

export function FeatureControlsForm({
  features,
}: FeatureControlsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveFeatureControls,
    initialState,
  )

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message)
    }

    if (state.status === "error") {
      toast.error(state.message)
    }

    if (state.status === "conflict") {
      toast.warning(state.message)
    }
  }, [state])

  const enabledCount = features.filter(
    (feature) => feature.isEnabled,
  ).length

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <AdministrationNav />

      <PageHeader
        title="Feature Controls"
        description="Enable or disable Organization features and manage their operational status and effective period."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/administration/features" />}
            >
              <ArrowLeft />
              Cancel
            </Button>

            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving…" : "Save feature controls"}
            </Button>
          </div>
        }
      />

      <section aria-labelledby="feature-summary-heading">
        <h2
          id="feature-summary-heading"
          className="mb-3 text-sm font-semibold tracking-wide uppercase"
        >
          Feature summary
        </h2>

        <div className="grid grid-cols-2 gap-x-8 border-y border-border py-5 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Total features
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {features.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Enabled
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {enabledCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Disabled
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {features.length - enabledCount}
            </p>
          </div>
        </div>
      </section>

      {state.status !== "idle" && (
        <div
          role={state.status === "success" ? "status" : "alert"}
          className={
            state.status === "success"
              ? "border-y border-border py-3 text-sm"
              : "border-y border-destructive/40 bg-destructive/5 py-3 text-sm"
          }
        >
          {state.message}
        </div>
      )}

      <section aria-labelledby="feature-controls-heading">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <h2
            id="feature-controls-heading"
            className="text-sm font-semibold tracking-wide uppercase"
          >
            Organization features
          </h2>
        </div>

        {features.length === 0 ? (
          <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">
            No feature controls are configured.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {features.map((feature) => (
              <article
                key={feature.id}
                className="grid gap-5 py-5 lg:grid-cols-[1fr_10rem_11rem_11rem]"
              >
                <input
                  type="hidden"
                  name="featureIds"
                  value={feature.id}
                />
                <input
                  type="hidden"
                  name={`updatedAt:${feature.id}`}
                  value={feature.updatedAt.toISOString()}
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">
                      {formatFeatureName(feature.featureCode)}
                    </h3>

                    <Badge
                      variant={
                        feature.isEnabled ? "default" : "secondary"
                      }
                    >
                      {feature.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {feature.featureCode}
                  </p>

                  <label className="mt-4 flex items-start gap-3">
                    <input
                      type="checkbox"
                      name={`enabled:${feature.id}`}
                      defaultChecked={feature.isEnabled}
                      className="mt-0.5 size-4"
                    />

                    <span>
                      <span className="block text-sm font-medium">
                        Feature enabled
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Allows the Organization to use this platform
                        capability.
                      </span>
                    </span>
                  </label>

                  <div className="mt-4">
                    <label
                      htmlFor={`reason:${feature.id}`}
                      className="text-sm font-medium"
                    >
                      Administrative reason
                    </label>
                    <Input
                      id={`reason:${feature.id}`}
                      name={`reason:${feature.id}`}
                      defaultValue={feature.reason ?? ""}
                      placeholder="Reason for the current feature state"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`status:${feature.id}`}
                    className="text-sm font-medium"
                  >
                    Status
                  </label>
                  <select
                    id={`status:${feature.id}`}
                    name={`status:${feature.id}`}
                    defaultValue={feature.status}
                    className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`effectiveFrom:${feature.id}`}
                    className="text-sm font-medium"
                  >
                    Effective from
                  </label>
                  <Input
                    id={`effectiveFrom:${feature.id}`}
                    name={`effectiveFrom:${feature.id}`}
                    type="date"
                    defaultValue={dateValue(feature.effectiveFrom)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`effectiveUntil:${feature.id}`}
                    className="text-sm font-medium"
                  >
                    Effective until
                  </label>
                  <Input
                    id={`effectiveUntil:${feature.id}`}
                    name={`effectiveUntil:${feature.id}`}
                    type="date"
                    defaultValue={dateValue(feature.effectiveUntil)}
                    className="mt-2"
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="flex justify-end border-t border-border pt-5">
        <Button type="submit" disabled={isPending}>
          <Save />
          {isPending ? "Saving…" : "Save feature controls"}
        </Button>
      </footer>
    </form>
  )
}
