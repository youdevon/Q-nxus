import Link from "next/link"
import type { Metadata } from "next"
import {
  Building2,
  CalendarDays,
  Clock3,
  Globe2,
  Mail,
  Pencil,
  Phone,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav"

export const metadata: Metadata = {
  title: "Organization",
}

export const dynamic = "force-dynamic"

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

export default async function OrganizationPage() {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  })

  if (!organization) {
    return (
      <PageShell>
        <AdministrationNav />

        <PageHeader
          title="Organization"
          description="No organization profile has been configured."
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <AdministrationNav />

      <PageHeader
        title={organization.name}
        description="Organization identity, contact information and regional defaults."
        actions={
          <Button
            nativeButton={false}
            render={
              <Link href="/administration/organization/edit" />
            }
          >
            <Pencil />
            Edit organization
          </Button>
        }
      />

      <section className="border-y border-border py-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center border border-border">
              <Building2 className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                {organization.name}
              </h2>

              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {organization.code}
              </p>

              {organization.legalName && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {organization.legalName}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                organization.status === "ACTIVE"
                  ? "default"
                  : "secondary"
              }
            >
              {formatStatus(organization.status)}
            </Badge>

            <Badge variant="outline">
              Version {organization.version}
            </Badge>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Organization identity
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail label="Organization name" value={organization.name} />
          <Detail label="Short name" value={organization.shortName} />
          <Detail label="Legal name" value={organization.legalName} />
          <Detail label="Organization code" value={organization.code} />
          <Detail
            label="Operational status"
            value={formatStatus(organization.status)}
          />
          <Detail
            label="Record status"
            value={organization.isActive ? "Active" : "Inactive"}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Contact information
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail label="Email" value={organization.email} />
          <Detail label="Telephone" value={organization.phone} />
          <Detail label="Website" value={organization.website} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Globe2 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Regional defaults
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            label="Time zone"
            value={organization.defaultTimeZone}
          />
          <Detail
            label="Currency"
            value={organization.defaultCurrency}
          />
          <Detail
            label="Language"
            value={organization.defaultLanguage}
          />
          <Detail
            label="Date format"
            value={organization.dateFormat}
          />
          <Detail
            label="First day of week"
            value={String(organization.firstDayOfWeek)}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Record information
          </h2>
        </div>

        <div className="grid gap-6 border-y border-border py-6 md:grid-cols-2">
          <Detail
            label="Created"
            value={organization.createdAt
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)}
          />

          <Detail
            label="Last updated"
            value={organization.updatedAt
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)}
          />

          <Detail
            label="Archived"
            value={
              organization.archivedAt
                ? organization.archivedAt
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 19)
                : "No"
            }
          />
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-border pt-5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" />
          Existing records open in read-only mode.
        </p>

        <Button
          nativeButton={false}
          variant="outline"
          render={
            <Link href="/administration/organization/edit" />
          }
        >
          <Pencil />
          Edit organization
        </Button>
      </footer>
    </PageShell>
  )
}
