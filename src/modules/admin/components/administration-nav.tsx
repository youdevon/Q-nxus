"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileClock,
  Hash,
  KeyRound,
  Mail,
  Settings2,
} from "lucide-react";

const items = [
  {
    title: "Organization",
    href: "/administration/organization",
    icon: Building2,
  },
  {
    title: "Users and Roles",
    href: "/administration/access",
    icon: KeyRound,
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
];

export function AdministrationNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Administration navigation"
      className="-mt-1 flex flex-wrap gap-x-1 gap-y-0.5"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);

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
