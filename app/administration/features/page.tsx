import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Pencil, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";
import { getFeatureControls } from "@/src/modules/admin/data/get-feature-controls";

export const metadata: Metadata = {
  title: "Feature Controls",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateOnly(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "No end date";
}

export default async function FeaturesPage() {
  const features = await getFeatureControls();

  const enabledCount = features.filter((feature) => feature.isEnabled).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title="Feature Controls"
        description="Current feature availability, operating status and effective periods."
        backHref="/administration"
        backLabel="Administration"
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/administration/features/edit" />}
          >
            <Pencil />
            Edit feature controls
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Total features</p>
          <p className="mt-1 text-2xl font-semibold">{features.length}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Enabled</p>
          <p className="mt-1 text-2xl font-semibold">{enabledCount}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Disabled</p>
          <p className="mt-1 text-2xl font-semibold">
            {features.length - enabledCount}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Organization features
          </h2>
        </div>

        {features.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No feature controls are configured.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {features.map((feature) => (
              <article
                key={feature.id}
                className="grid gap-5 py-5 md:grid-cols-[1fr_10rem_12rem]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">
                      {label(feature.featureCode)}
                    </h3>

                    <Badge variant={activeStateBadgeVariant(feature.isEnabled)}>
                      {feature.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {feature.featureCode}
                  </p>

                  <p className="mt-3 text-sm text-muted-foreground">
                    {feature.reason || "No administrative reason recorded."}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-medium">
                    {label(feature.status)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Effective period
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {dateOnly(feature.effectiveFrom)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    to {dateOnly(feature.effectiveUntil)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          Feature states remain read-only until Edit is selected.
        </p>

        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/administration/features/edit" />}
        >
          <Pencil />
          Edit feature controls
        </Button>
      </footer>
    </div>
  );
}
