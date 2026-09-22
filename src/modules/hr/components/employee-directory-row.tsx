"use client";

import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type EmployeeDirectoryRowProps = {
  href: string;
  label: string;
  children: ReactNode;
};

type CellProps = {
  className?: string;
  children?: ReactNode;
};

/**
 * Clickable directory row that navigates with a real Next.js Link in every cell.
 * Prefer Links over `router.push` on `<tr onClick>` — soft-nav via push can fail
 * silently when the App Router does not apply a search-param or RSC update.
 */
export function EmployeeDirectoryRow({
  href,
  label,
  children,
}: EmployeeDirectoryRowProps) {
  const cells = Children.toArray(children);

  return (
    <tr className="group hover:bg-muted/20 focus-within:bg-muted/20">
      {cells.map((child, index) => {
        if (!isValidElement<CellProps>(child)) {
          return child;
        }

        const cell = child as ReactElement<CellProps>;

        return cloneElement(cell, {
          className: cn(cell.props.className, "relative"),
          children: (
            <>
              <Link
                href={href}
                className="absolute inset-0 z-[1]"
                aria-label={index === 0 ? label : undefined}
                tabIndex={index === 0 ? 0 : -1}
              />
              <div className="relative z-0">{cell.props.children}</div>
            </>
          ),
        });
      })}
    </tr>
  );
}
