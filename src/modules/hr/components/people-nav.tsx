"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Network,
  PanelsTopLeft,
  Users,
} from "lucide-react"

const items = [
  {
    title: "Employees",
    href: "/people",
    icon: Users,
  },
  {
    title: "Structure",
    href: "/people/structure",
    icon: Network,
  },
  {
    title: "Organization Chart",
    href: "/people/structure/chart",
    icon: PanelsTopLeft,
  },
  {
    title: "Leave",
    href: "/people/leave/types",
    icon: CalendarDays,
  },
]

export function PeopleNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="People navigation"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {items.map((item) => {
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
