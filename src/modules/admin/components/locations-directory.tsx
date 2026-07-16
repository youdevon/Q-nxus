import Link from "next/link";
import { MapPin, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { recordStatusBadgeVariant } from "@/src/config/ui-colors";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { AdministrationNav } from "./administration-nav";
import type { LocationListItem } from "@/src/modules/admin/data/get-locations";

export function LocationsDirectory({
  locations,
}: {
  locations: LocationListItem[];
}) {
  return (
    <PageShell size="lg">
      <AdministrationNav />

      <PageHeader
        title="Locations"
        description="Manage offices, branches, warehouses, remote workplaces and operational sites."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/administration/locations/new" />}
          >
            <Plus />
            New location
          </Button>
        }
      />

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Location directory
          </h2>
          <span className="text-xs text-muted-foreground">
            {locations.length} location
            {locations.length === 1 ? "" : "s"}
          </span>
        </div>

        {locations.length === 0 ? (
          <div className="py-10 text-center">
            <MapPin className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No locations configured</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create the first workplace or operational site.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Area</th>
                  <th className="px-3 py-3 font-medium">Time zone</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {locations.map((location) => (
                  <tr
                    key={location.id}
                    className="relative hover:bg-muted/30 focus-within:bg-muted/30"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/administration/locations/${location.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                      >
                        {location.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {location.code}
                      </p>
                    </td>

                    <td className="px-3 py-3">
                      {location.locationType
                        .replaceAll("_", " ")
                        .toLowerCase()
                        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    </td>

                    <td className="px-3 py-3 text-muted-foreground">
                      {[location.city, location.region]
                        .filter(Boolean)
                        .join(",") || "—"}
                    </td>

                    <td className="px-3 py-3 text-muted-foreground">
                      {location.timeZone}
                    </td>

                    <td className="px-3 py-3">
                      <Badge
                        variant={recordStatusBadgeVariant(location.status)}
                      >
                        {location.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
