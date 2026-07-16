"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Network, Users } from "lucide-react";

import { useAuth } from "@/src/modules/auth/context/auth-provider";

const items = [
  {
    title: "Employees",
    href: "/people",
    icon: Users,
    anyOf: ["people.directory.view", "people.manage"],
  },
  {
    title: "Leave requests",
    href: "/leave",
    icon: ClipboardList,
    anyOf: ["leave.manage", "leave.approve"],
  },
  {
    title: "Holidays",
    href: "/people/leave/holidays",
    icon: CalendarDays,
    anyOf: ["leave.manage"],
  },
  {
    title: "Leave Balances",
    href: "/people/leave/balances",
    icon: CalendarDays,
    anyOf: ["leave.manage", "people.manage"],
  },
  {
    title: "Organization",
    href: "/people/structure",
    icon: Network,
    anyOf: ["people.directory.view", "people.manage"],
  },
];

export function PeopleNav() {
  const pathname = usePathname();
  const { canAny } = useAuth();
  const visibleItems = items.filter((item) => canAny(...item.anyOf));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="People navigation"
      className="-mt-1 flex flex-wrap gap-x-1 gap-y-0.5"
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/people"
            ? pathname === "/people" || pathname.startsWith("/people/employees")
            : item.href === "/people/structure"
              ? pathname.startsWith("/people/structure")
              : item.href === "/leave"
                ? pathname === "/leave" || pathname.startsWith("/leave/")
                : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="size-3.5 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
