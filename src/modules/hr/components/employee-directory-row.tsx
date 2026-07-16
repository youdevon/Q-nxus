"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

type EmployeeDirectoryRowProps = {
  href: string;
  label: string;
  children: ReactNode;
};

export function EmployeeDirectoryRow({
  href,
  label,
  children,
}: EmployeeDirectoryRowProps) {
  const router = useRouter();

  function navigate() {
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={label}
      className="group cursor-pointer hover:bg-muted/20 focus-visible:bg-muted/20 focus-visible:outline-none"
      onClick={navigate}
      onKeyDown={onKeyDown}
    >
      {children}
    </tr>
  );
}
