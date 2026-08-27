"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { UI_ELEVATION } from "@/src/config/ui-elevation";
import type { FinancialInstitutionOption } from "@/src/modules/payroll/lib/payroll-setup-types";
import {
  OTHER_FINANCIAL_INSTITUTION_ID,
  formatTtFinancialInstitutionLabel,
  getTtFinancialInstitutionById,
  getTtFinancialInstitutionsGrouped,
} from "@/src/modules/payroll/lib/tt-financial-institutions";

const fallbackGroups = getTtFinancialInstitutionsGrouped();

type FinancialInstitutionSelectProps = {
  id?: string;
  institutionId: string;
  bankName: string;
  onChange: (next: { institutionId: string; bankName: string }) => void;
  disabled?: boolean;
  /** DB-backed options; falls back to the TT TypeScript catalog when empty. */
  institutions?: readonly FinancialInstitutionOption[];
};

function selectedLabel(
  institutionId: string,
  bankName: string,
  institutions: readonly FinancialInstitutionOption[],
): string {
  if (institutionId === OTHER_FINANCIAL_INSTITUTION_ID) {
    return bankName.trim() || "Other (enter name)";
  }

  const fromDb = institutions.find(
    (row) => row.id === institutionId || row.catalogKey === institutionId,
  );
  if (fromDb) {
    return `${fromDb.displayName} (${fromDb.shortName})`;
  }

  const institution = getTtFinancialInstitutionById(institutionId);
  if (institution) {
    return formatTtFinancialInstitutionLabel(institution);
  }

  return bankName.trim() || "Select institution…";
}

export function FinancialInstitutionSelect({
  id,
  institutionId,
  bankName,
  onChange,
  disabled = false,
  institutions = [],
}: FinancialInstitutionSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    if (institutions.length === 0) {
      return fallbackGroups.map((group) => ({
        label: group.label,
        items: group.institutions.map((row) => ({
          id: row.id,
          label: formatTtFinancialInstitutionLabel(row),
          bankName: row.name,
        })),
      }));
    }

    const byType = new Map<string, FinancialInstitutionOption[]>();
    for (const row of institutions) {
      const key = row.institutionType;
      const list = byType.get(key) ?? [];
      list.push(row);
      byType.set(key, list);
    }

    return [...byType.entries()].map(([type, rows]) => ({
      label: type.replaceAll("_", " "),
      items: rows.map((row) => ({
        id: row.id,
        label: `${row.displayName} (${row.shortName})`,
        bankName: row.displayName,
      })),
    }));
  }, [institutions]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <Button
        id={id}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        className="w-full min-w-0 justify-between font-normal"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {selectedLabel(institutionId, bankName, institutions)}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>

      {open ? (
        <div
          id={listId}
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground",
            UI_ELEVATION.raised,
          )}
        >
          <Command>
            <CommandInput placeholder="Search institutions…" />
            <CommandList>
              <CommandEmpty>No institution found.</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.label}
                      onSelect={() => {
                        onChange({
                          institutionId: item.id,
                          bankName: item.bankName,
                        });
                        setOpen(false);
                      }}
                    >
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandGroup heading="Other">
                <CommandItem
                  value="Other enter custom name"
                  onSelect={() => {
                    onChange({
                      institutionId: OTHER_FINANCIAL_INSTITUTION_ID,
                      bankName: bankName.trim() || "",
                    });
                    setOpen(false);
                  }}
                >
                  Other (enter name)
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  );
}
