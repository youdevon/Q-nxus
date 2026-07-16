import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav"

export const metadata: Metadata = {
  title: "Location",
}

export const dynamic = "force-dynamic"

type LocationPageProps = {
  params: Promise<{
    id: string
  }>
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium">
        {value?.trim() || "Not provided"}
      </p>
    </div>
  )
}

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export default async function LocationPage({
  params,
}: LocationPageProps) {
  const { id } = await params

  const location = await prisma.location.findUnique({
    where: {
      id,
    },
    include: {
      organization: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!location) {
    notFound()
  }

  const fullAddress = [
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.region,
    location.postalCode,
    location.countryCode,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <PageShell>
      <AdministrationNav />

      <PageHeader
        title={location.name}
        description="Location profile and regional configuration."
        actions={
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/administration/locations" />}
            >
              <ArrowLeft />
              Locations
            </Button>

            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/administration/locations/${location.id}/edit`}
                />
              }
            >
              <Pencil />
              Edit location
            </Button>
          </>
        }
      />

      <section className="border-y border-border py-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center border border-border">
              <MapPin className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                {location.name}
              </h2>

              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {location.code}
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {location.locationType}
              </p>
            </div>
          </div>

          <Badge
            variant={
              location.status === "ACTIVE"
                ? "default"
                : "secondary"
            }
          >
            {formatStatus(location.status)}
          </Badge>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Location information
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail label="Location name" value={location.name} />
          <Detail label="Location code" value={location.code} />
          <Detail label="Location type" value={location.locationType} />
          <Detail
            label="Organization"
            value={location.organization.name}
          />
          <Detail
            label="Status"
            value={formatStatus(location.status)}
          />
          <Detail label="Time zone" value={location.timeZone} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Address
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail label="Full address" value={fullAddress} />
          <Detail
            label="Address line 1"
            value={location.addressLine1}
          />
          <Detail
            label="Address line 2"
            value={location.addressLine2}
          />
          <Detail label="City" value={location.city} />
          <Detail label="Region" value={location.region} />
          <Detail
            label="Postal code"
            value={location.postalCode}
          />
          <Detail
            label="Country code"
            value={location.countryCode}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Effective period
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            label="Effective from"
            value={location.effectiveFrom
              .toISOString()
              .slice(0, 10)}
          />

          <Detail
            label="Effective until"
            value={
              location.effectiveUntil
                ?.toISOString()
                .slice(0, 10) ?? "No end date"
            }
          />

          <Detail
            label="Created"
            value={location.createdAt
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)}
          />

          <Detail
            label="Last updated"
            value={location.updatedAt
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)}
          />
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" />
          Select Edit location before making changes.
        </p>

        <Button
          nativeButton={false}
          variant="outline"
          render={
            <Link
              href={`/administration/locations/${location.id}/edit`}
            />
          }
        >
          <Pencil />
          Edit location
        </Button>
      </footer>
    </PageShell>
  )
}
