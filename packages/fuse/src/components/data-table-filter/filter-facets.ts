/**
 * The filter's facet policy: where each field's option counts and number range come from. Server
 * facets win over TanStack faceting, and with `manualFiltering` TanStack's page-local facets
 * never show.
 */
import type { FilterTableSource } from "./data-table-filter-source";
import type { AnyFilterFacets, FilterFieldMap } from "./filter-fields";

/** Counts and ranges per field, from the `facets` prop or TanStack faceting. */
export type FacetReader = {
  /** Option counts, or undefined when unknown, such as in server mode without facets. */
  readonly counts: (fieldId: string) => ReadonlyMap<string, number> | undefined;
  /** A number field's range, or undefined when unknown. */
  readonly range: (fieldId: string) => readonly [number, number] | undefined;
};

/** Where counts come from: a server's counts object, or TanStack's faceted unique values. */
type CountsSource = Readonly<Record<string, number>> | ReadonlyMap<unknown, number>;

const countsBySource = new WeakMap<CountsSource, ReadonlyMap<string, number>>();

/**
 * Counts normalized to string keys, once per source: a server's counts object, or the map
 * TanStack's faceting memoizes until its rows change. Every value row reads its field's counts,
 * so a list of 50 rows over thousands of facet entries reads one map, not 50 copies.
 */
function normalizedCounts(
  source: CountsSource,
  normalize: () => ReadonlyMap<string, number>
): ReadonlyMap<string, number> {
  const cached = countsBySource.get(source);
  if (cached !== undefined) {
    return cached;
  }
  const counts = normalize();
  countsBySource.set(source, counts);
  return counts;
}

/**
 * Reads each field's counts and range: the server's facets first, then TanStack faceting, which
 * server mode skips. A number field's configured `min` and `max` stand in for an unknown range.
 *
 * @param table - The table, for faceting and `options.manualFiltering`.
 * @param fields - The fields, for a number field's configured range.
 * @param facets - The server's facets, if any.
 * @returns The reader.
 */
export function createFacetReader(
  table: FilterTableSource,
  fields: FilterFieldMap,
  facets: AnyFilterFacets | undefined
): FacetReader {
  return {
    counts: (fieldId) => {
      const known = facets?.[fieldId]?.counts;
      if (known !== undefined) {
        return normalizedCounts(known, () => new Map(Object.entries(known)));
      }
      // In server mode TanStack's faceting counts the current page only. Page-local counts never
      // show as totals.
      if (table.options.manualFiltering === true) {
        return undefined;
      }
      const unique = table.getColumn(fieldId)?.getFacetedUniqueValues?.();
      return unique === undefined
        ? undefined
        : normalizedCounts(unique, () => new Map([...unique].map(([key, count]) => [String(key), count])));
    },
    range: (fieldId) => {
      const known = facets?.[fieldId]?.range;
      if (known !== undefined) {
        return known;
      }
      const field = fields[fieldId];
      const fromConfig: readonly [number, number] | undefined =
        field?.kind === "number" && field.min !== undefined && field.max !== undefined
          ? [field.min, field.max]
          : undefined;
      if (table.options.manualFiltering === true) {
        return fromConfig;
      }
      return table.getColumn(fieldId)?.getFacetedMinMaxValues?.() ?? fromConfig;
    },
  };
}
