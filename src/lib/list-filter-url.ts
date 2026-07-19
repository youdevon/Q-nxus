export type FilterParamValue = string | string[] | undefined;

export type FilterParams = Record<string, FilterParamValue>;

function appendParam(
  params: URLSearchParams,
  key: string,
  value: FilterParamValue,
) {
  if (value === undefined || value === "") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item) {
        params.append(key, item);
      }
    }
    return;
  }

  params.set(key, value);
}

export function buildListFilterUrl(
  basePath: string,
  values: FilterParams,
  options?: {
    omitKeys?: string[];
    page?: number;
  },
): string {
  const params = new URLSearchParams();
  const omitted = new Set(options?.omitKeys ?? []);

  for (const [key, value] of Object.entries(values)) {
    if (omitted.has(key) || key === "page") {
      continue;
    }

    appendParam(params, key, value);
  }

  if (options?.page !== undefined && options.page > 0) {
    params.set("page", String(options.page));
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function normalizeFilterValues(
  value: string | string[] | undefined,
): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

export function countActiveFilters(
  values: FilterParams,
  searchParam = "query",
): number {
  return Object.entries(values).reduce((count, [key, value]) => {
    if (
      key === searchParam ||
      key === "page" ||
      key === "show" ||
      key === "sort" ||
      key === "order"
    ) {
      return count;
    }

    if (Array.isArray(value)) {
      return count + value.filter(Boolean).length;
    }

    return value ? count + 1 : count;
  }, 0);
}
