"use client";

import { useEffect, useId, useRef, useState } from "react";
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
import {
  OTHER_FINANCIAL_INSTITUTION_ID,
  formatTtFinancialInstitutionLabel,
  getTtFinancialInstitutionById,
  getTtFinancialInstitutionsGrouped,
} from "@/src/modules/payroll/lib/tt-financial-institutions";

const institutionGroups = getTtFinancialInstitutionsGrouped();

type FinancialInstitutionSelectProps = {
  id?: string;
  institutionId: string;
  bankName: string;
  onChange: (next: { institutionId: string; bankName: string }) => void;
  disabled?: boolean;
};

function selectedLabel(institutionId: string, bankName: string): string {
  if (institutionId === OTHER_FINANCIAL_INSTITUTION_ID) {
    return bankName.trim() || "Other (enter name)";
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
}: FinancialInstitutionSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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
    <div ref={rootRef} className="relative">
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        className={cn(
          "h-9 w-full justify-between px-3 font-normal",
          !institutionId && "text-muted-foreground",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate text-left">
          {institutionId
            ? selectedLabel(institutionId, bankName)
            : "Select institution…"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>

      {open ? (
        <div
          id={listId}
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-md"
        >
          <Command
            filter={(value, search) => {
              const query = search.trim().toLowerCase();
              if (!query) {
                return 1;
              }
              return value.toLowerCase().includes(query) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search by name or short name…" />
            <CommandList>
              <CommandEmpty>No institution found.</CommandEmpty>
              {institutionGroups.map((group) => (
                <CommandGroup key={group.categoryId} heading={group.label}>
                  {group.institutions.map((institution) => (
                    <CommandItem
                      key={institution.id}
                      value={`${institution.name} ${institution.shortName} ${institution.id}`}
                      data-checked={
                        institutionId === institution.id ? "true" : undefined
                      }
                      onSelect={() => {
                        onChange({
                          institutionId: institution.id,
                          bankName: institution.name,
                        });
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {formatTtFinancialInstitutionLabel(institution)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandGroup heading="Custom">
                <CommandItem
                  value="other custom enter name"
                  data-checked={
                    institutionId === OTHER_FINANCIAL_INSTITUTION_ID
                      ? "true"
                      : undefined
                  }
                  onSelect={() => {
                    onChange({
                      institutionId: OTHER_FINANCIAL_INSTITUTION_ID,
                      bankName:
                        institutionId === OTHER_FINANCIAL_INSTITUTION_ID
                          ? bankName
                          : "",
                    });
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    Other (enter name)
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  );
}
