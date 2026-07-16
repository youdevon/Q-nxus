"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  FileClock,
  Hash,
  KeyRound,
  Mail,
  MapPin,
  Network,
  Settings2,
  SlidersHorizontal,
} from "lucide-react"

const items = [
  {
    title: "Organization",
    href: "/administration/organization",
    icon: Building2,
  },
  {
    title: "Locations",
    href: "/administration/locations",
    icon: MapPin,
  },
  {
    title: "Business Units",
    href: "/administration/business-units",
    icon: Network,
  },
  {
    title: "Users and Roles",
    href: "/administration/access",
    icon: KeyRound,
  },
  {
    title: "Feature Controls",
    href: "/administration/features",
    icon: SlidersHorizontal,
  },
  {
    title: "Numbering Sequences",
    href: "/administration/numbering-sequences",
    icon: Hash,
  },
  {
    title: "Domain Settings",
    href: "/administration/settings",
    icon: Settings2,
  },
  {
    title: "System Email",
    href: "/administration/notifications/email",
    icon: Mail,
  },
  {
    title: "Audit Trail",
    href: "/administration/audit",
    icon: FileClock,
  },
]

export function AdministrationNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Administration navigation"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="size-4" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
