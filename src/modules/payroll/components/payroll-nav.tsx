"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  Landmark,
  Users,
} from "lucide-react";

import { useAuth } from "@/src/modules/auth/context/auth-provider";

const payrollAccess = ["payroll.view", "payroll.setup", "payroll.manage"] as const;

const items = [
  {
    title: "Readiness",
    href: "/payroll",
    icon: Users,
    anyOf: payrollAccess,
  },
  {
    title: "Runs",
    href: "/payroll/runs",
    icon: CalendarRange,
    anyOf: payrollAccess,
  },
  {
    title: "Salaries",
    href: "/payroll/salaries",
    icon: CircleDollarSign,
    anyOf: payrollAccess,
  },
  {
    title: "Reports",
    href: "/payroll/reports",
    icon: BarChart3,
    anyOf: payrollAccess,
  },
  {
    title: "Settings",
    href: "/payroll/settings",
    icon: Landmark,
    anyOf: payrollAccess,
  },
];

export function PayrollNav() {
  const pathname = usePathname();
  const { canAny } = useAuth();
  const visibleItems = items.filter((item) => canAny(...item.anyOf));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Payroll navigation"
      className="-mt-1 flex flex-wrap gap-x-1 gap-y-0.5"
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/payroll"
            ? pathname === "/payroll"
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
