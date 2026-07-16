"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Network,
  PanelsTopLeft,
  Users,
} from "lucide-react"

import { useAuth } from "@/src/modules/auth/context/auth-provider"

const items = [
  {
    title: "Employees",
    href: "/people",
    icon: Users,
    anyOf: ["people.directory.view", "people.manage"],
  },
  {
    title: "Structure",
    href: "/people/structure",
    icon: Network,
    anyOf: ["people.manage"],
  },
  {
    title: "Organization Chart",
    href: "/people/structure/chart",
    icon: PanelsTopLeft,
    anyOf: ["people.directory.view", "people.manage"],
  },
  {
    title: "Leave Types",
    href: "/people/leave/types",
    icon: CalendarDays,
    anyOf: ["leave.manage"],
  },
  {
    title: "Leave Balances",
    href: "/people/leave/balances",
    icon: CalendarDays,
    anyOf: ["leave.manage", "people.manage"],
  },
]

export function PeopleNav() {
  const pathname = usePathname()
  const { canAny } = useAuth()
  const visibleItems = items.filter((item) =>
    canAny(...item.anyOf),
  )

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="People navigation"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {visibleItems.map((item) => {
        const Icon = item.icon
        const active =
          item.href === "/people"
            ? pathname === "/people" ||
              pathname.startsWith("/people/employees")
            : item.href === "/people/structure"
              ? pathname === "/people/structure"
              : pathname.startsWith(item.href)

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
