import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Network,
  Pencil,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/src/components/layout/page-header";
import { recordStatusBadgeVariant } from "@/src/config/ui-colors";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";

export const metadata: Metadata = {
  title: "Business Unit",
};

export const dynamic = "force-dynamic";

type BusinessUnitPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium">
        {value?.trim() || "Not provided"}
      </p>
    </div>
  );
}

export default async function BusinessUnitPage({
  params,
}: BusinessUnitPageProps) {
  const { id } = await params;

  const businessUnit = await prisma.businessUnit.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          name: true,
        },
      },
      parent: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      children: {
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!businessUnit) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title={businessUnit.name}
        description="Business unit profile and hierarchy information."
        backHref="/administration/business-units"
        backLabel="Business units"
        actions={
          <Button
            nativeButton={false}
            render={
              <Link
                href={`/administration/business-units/${businessUnit.id}/edit`}
              />
            }
          >
            <Pencil />
            Edit business unit
          </Button>
        }
      />

      <section>
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center border border-border">
              <Network className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {businessUnit.name}
              </h2>

              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {businessUnit.code}
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {businessUnit.organization.name}
              </p>
            </div>
          </div>

          <Badge variant={recordStatusBadgeVariant(businessUnit.status)}>
            {formatStatus(businessUnit.status)}
          </Badge>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Unit information
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail label="Business unit name" value={businessUnit.name} />
          <Detail label="Business unit code" value={businessUnit.code} />
          <Detail label="Organization" value={businessUnit.organization.name} />
          <Detail label="Status" value={formatStatus(businessUnit.status)} />
          <Detail
            label="Parent business unit"
            value={
              businessUnit.parent
                ? `${businessUnit.parent.name} (${businessUnit.parent.code})`
                : "Top-level business unit"
            }
          />
          <Detail label="Description" value={businessUnit.description} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UsersRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Child business units
          </h2>
        </div>

        {businessUnit.children.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This business unit has no child units.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {businessUnit.children.map((child) => (
              <Link
                key={child.id}
                href={`/administration/business-units/${child.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium">{child.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {child.code}
                  </p>
                </div>

                <Badge variant={recordStatusBadgeVariant(child.status)}>
                  {formatStatus(child.status)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Effective period
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Detail
            label="Effective from"
            value={businessUnit.effectiveFrom.toISOString().slice(0, 10)}
          />

          <Detail
            label="Effective until"
            value={
              businessUnit.effectiveUntil?.toISOString().slice(0, 10) ??
              "No end date"
            }
          />

          <Detail
            label="Created"
            value={businessUnit.createdAt
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)}
          />

          <Detail
            label="Last updated"
            value={businessUnit.updatedAt
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)}
          />
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Existing business units open in read-only mode.
        </p>

        <Button
          nativeButton={false}
          render={
            <Link
              href={`/administration/business-units/${businessUnit.id}/edit`}
            />
          }
        >
          <Pencil />
          Edit business unit
        </Button>
      </footer>
    </div>
  );
}
