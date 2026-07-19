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
import { UI_ELEVATION } from "@/src/config/ui-elevation";

export type FilterableSelectOption = {
  value: string;
  label: string;
  /** Optional secondary line (e.g. category path). */
  description?: string;
  /** Extra search tokens beyond label/value/description. */
  keywords?: string;
};

export type FilterableSelectGroup = {
  label: string;
  options: readonly FilterableSelectOption[];
};

type FilterableSelectProps = {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options?: readonly FilterableSelectOption[];
  groups?: readonly FilterableSelectGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

/**
 * Searchable single-select using the shared Command pattern.
 * Used for long qualification subtype / degree-type lists.
 */
export function FilterableSelect({
  id,
  name,
  value,
  onChange,
  options = [],
  groups,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches.",
  required = false,
  disabled = false,
  allowEmpty = false,
  emptyLabel = "None",
}: FilterableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const flatOptions = groups
    ? groups.flatMap((group) => [...group.options])
    : [...options];

  const selected = flatOptions.find((option) => option.value === value);
  const displayLabel = selected?.label
    ?? (value ? value : allowEmpty ? emptyLabel : placeholder);

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
      <input type="hidden" name={name} value={value} />
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        className={cn(
          "h-9 w-full justify-between px-3 font-normal",
          !value && "text-muted-foreground",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate text-left">{displayLabel}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>

      {open ? (
        <div
          id={listId}
          className={`absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover ${UI_ELEVATION.raised}`}
        >
          <Command
            filter={(itemValue, search) => {
              const query = search.trim().toLowerCase();
              if (!query) {
                return 1;
              }
              return itemValue.toLowerCase().includes(query) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {allowEmpty ? (
                <CommandGroup>
                  <CommandItem
                    value={`${emptyLabel} empty`}
                    data-checked={!value ? "true" : undefined}
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {groups
                ? groups.map((group) => (
                    <CommandGroup key={group.label} heading={group.label}>
                      {group.options.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={[
                            option.label,
                            option.value,
                            option.description,
                            option.keywords,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          data-checked={
                            value === option.value ? "true" : undefined
                          }
                          onSelect={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <span className="block truncate">{option.label}</span>
                            {option.description ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            ) : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))
                : (
                    <CommandGroup>
                      {options.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={[
                            option.label,
                            option.value,
                            option.description,
                            option.keywords,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          data-checked={
                            value === option.value ? "true" : undefined
                          }
                          onSelect={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <span className="block truncate">{option.label}</span>
                            {option.description ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            ) : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  );
}
