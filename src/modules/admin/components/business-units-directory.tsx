import Link from "next/link";
import { Network, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { recordStatusBadgeVariant } from "@/src/config/ui-colors";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { AdministrationNav } from "./administration-nav";
import type { BusinessUnitListItem } from "@/src/modules/admin/data/get-business-units";

export function BusinessUnitsDirectory({
  businessUnits,
}: {
  businessUnits: BusinessUnitListItem[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title="Business Units"
        description="Manage operational divisions, reporting relationships and effective organizational structures."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/administration/business-units/new" />}
          >
            <Plus />
            New Business Unit
          </Button>
        }
      />

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Business Unit directory
          </h2>
          <span className="text-xs text-muted-foreground">
            {businessUnits.length} Business Unit
            {businessUnits.length === 1 ? "" : "s"}
          </span>
        </div>

        {businessUnits.length === 0 ? (
          <div className="py-10 text-center">
            <Network className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              No Business Units configured
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create the first operational or reporting unit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Business Unit</th>
                  <th className="px-3 py-3 font-medium">Parent</th>
                  <th className="px-3 py-3 font-medium">Children</th>
                  <th className="px-3 py-3 font-medium">Effective period</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {businessUnits.map((unit) => (
                  <tr
                    key={unit.id}
                    className="relative hover:bg-muted/30 focus-within:bg-muted/30"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/administration/business-units/${unit.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                      >
                        {unit.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {unit.code}
                      </p>
                      {unit.description && (
                        <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                          {unit.description}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3 text-muted-foreground">
                      {unit.parent
                        ? `${unit.parent.name} (${unit.parent.code})`
                        : "Top level"}
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      {unit.childCount}
                    </td>

                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {unit.effectiveFrom.toISOString().slice(0, 10)}
                      {" —"}
                      {unit.effectiveUntil
                        ? unit.effectiveUntil.toISOString().slice(0, 10)
                        : "Open-ended"}
                    </td>

                    <td className="px-3 py-3">
                      <Badge variant={recordStatusBadgeVariant(unit.status)}>
                        {unit.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
