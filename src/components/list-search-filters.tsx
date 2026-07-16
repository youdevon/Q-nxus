"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildListFilterUrl,
  countActiveFilters,
  normalizeFilterValues,
  type FilterParams,
} from "@/src/lib/list-filter-url";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

export type ListFilterOption = {
  value: string;
  label: string;
};

export type ListFilterField =
  | {
      type: "checkbox";
      name: string;
      label: string;
      options: ListFilterOption[];
      multi?: boolean;
    }
  | {
      type: "date";
      name: string;
      label: string;
    };

export type ActiveFilterChip = {
  key: string;
  value?: string;
  label: string;
};

type ListSearchFiltersProps = {
  basePath: string;
  searchParam?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  clearHref: string;
  fields: ListFilterField[];
  values: FilterParams;
  chips?: ActiveFilterChip[];
};

function FilterCheckbox({
  name,
  value,
  label,
  checked,
  multi,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  multi: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
      <input
        type={multi ? "checkbox" : "radio"}
        name={name}
        value={value}
        defaultChecked={checked}
        className="size-4 shrink-0 rounded border border-input accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

export function ListSearchFilters({
  basePath,
  searchParam = "query",
  searchPlaceholder = "Search…",
  searchValue = "",
  clearHref,
  fields,
  values,
  chips = [],
}: ListSearchFiltersProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const valuesRef = useRef(values);

  const [query, setQuery] = useState(searchValue);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const activeFilterCount = countActiveFilters(values, searchParam);
  const visibleChips = useMemo(() => chips.filter(Boolean), [chips]);
  const hasActiveSearch = Boolean(searchValue || query.trim());
  const showMode = typeof values.show === "string" ? values.show : undefined;
  const hasClearableState =
    hasActiveSearch || activeFilterCount > 0 || Boolean(showMode);

  // Keep the input in sync with URL-driven props (Clear, back/forward),
  // but do not clobber text while the user is actively typing.
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      return;
    }

    setQuery(searchValue);
  }, [searchValue]);

  // Live-update only the search query param (preserves other filters; resets page).
  useEffect(() => {
    if (query.trim() === searchValue.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextQuery = query.trim();
      const href = buildListFilterUrl(basePath, {
        ...valuesRef.current,
        [searchParam]: nextQuery || undefined,
      });
      router.replace(href, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query, searchValue, basePath, searchParam, router]);

  return (
    <section aria-label="Search and filters" className="pb-1">
      <form method="get" action={basePath} className="space-y-4">
        {showMode ? <input type="hidden" name="show" value={showMode} /> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id={searchParam}
              name={searchParam}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
              aria-label="Search"
              autoComplete="off"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {fields.length > 0 && (
              <Button
                type="button"
                variant="outline"
                aria-expanded={filtersOpen}
                aria-controls="list-search-filters-panel"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <SlidersHorizontal />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5">
                    {activeFilterCount}
                  </Badge>
                )}
                <ChevronDown
                  className={cn(
                    "transition-transform",
                    filtersOpen && "rotate-180",
                  )}
                />
              </Button>
            )}

            <Button type="submit">
              <Search />
              Search
            </Button>

            {hasClearableState && (
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={clearHref} />}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {fields.length > 0 && (
          <div
            id="list-search-filters-panel"
            hidden={!filtersOpen}
            className="rounded-lg border border-border bg-muted/20 p-4"
          >
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => {
                if (field.type === "date") {
                  const currentValue = values[field.name];
                  const dateValue =
                    typeof currentValue === "string" ? currentValue : "";

                  return (
                    <div key={field.name}>
                      <p className="mb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                        {field.label}
                      </p>
                      <Input
                        type="date"
                        name={field.name}
                        defaultValue={dateValue}
                        className="bg-background"
                      />
                    </div>
                  );
                }

                const selected = normalizeFilterValues(values[field.name]);
                const multi = field.multi ?? true;

                return (
                  <fieldset key={field.name} className="min-w-0">
                    <legend className="mb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                      {field.label}
                    </legend>
                    <div className="space-y-0.5">
                      {field.options.map((option) => (
                        <FilterCheckbox
                          key={option.value}
                          name={field.name}
                          value={option.value}
                          label={option.label}
                          checked={selected.includes(option.value)}
                          multi={multi}
                        />
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        )}
      </form>

      {visibleChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active filters</span>
          {visibleChips.map((chip) => (
            <Badge
              key={`${chip.key}-${chip.value ?? "all"}`}
              variant="outline"
              className="gap-1 pr-1"
            >
              {chip.label}
              <Link
                href={buildListFilterUrl(basePath, values, {
                  omitKeys: [chip.key],
                })}
                className="inline-flex rounded-full p-0.5 hover:bg-muted"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="size-3" />
              </Link>
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
