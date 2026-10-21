// Source entry facade for `@elmeragroup/fuse/data-table-filter` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. Subpath-only: its types read the optional `@tanstack/react-table` peer, so
// the root barrel leaves it out (OPTIONAL_PEER_ENTRIES in scripts/entries.ts). No public recipe.
export { DataTableFilter } from "./components/data-table-filter";
export type {
  DataTableFilterBarProps,
  DataTableFilterChipProps,
  DataTableFilterChipsProps,
  DataTableFilterClearProps,
  DataTableFilterOperatorProps,
  DataTableFilterRemoveProps,
  DataTableFilterSubjectProps,
  DataTableFilterTriggerProps,
  DataTableFilterValueProps,
} from "./components/data-table-filter/data-table-filter-bar";
export type {
  DataTableFilterContentProps,
  DataTableFilterFieldListProps,
} from "./components/data-table-filter/data-table-filter-content";
export type {
  DataTableFilterDateEditorProps,
  DataTableFilterKindEditorProps,
  DateEditorState,
} from "./components/data-table-filter/data-table-filter-editors";
export { DataTableFilterCompositionError } from "./components/data-table-filter/data-table-filter-error";
export type { DataTableFilterCompositionRule } from "./components/data-table-filter/data-table-filter-error";
export { useDataTableFilter, useDataTableFilterChip } from "./components/data-table-filter/data-table-filter";
export type {
  ChipFilter,
  DataTableFilterContextValue,
  DataTableFilterRootProps,
  FacetReader,
} from "./components/data-table-filter/data-table-filter";
export type {
  ColumnFiltersAtomSource,
  FilterColumnSource,
  FilterTableSource,
} from "./components/data-table-filter/data-table-filter-source";
export type {
  DataTableFilterEditorProps,
  DataTableFilterValueContentProps,
} from "./components/data-table-filter/data-table-filter-value-content";
export type { DatePresetKey } from "./components/data-table-filter/date-presets";
export { defineFilterFields } from "./components/data-table-filter/filter-fields";
export type {
  BooleanFilterField,
  DateFilterField,
  FilterFacets,
  FilterField,
  FilterFieldMap,
  FilterFields,
  FilterOption,
  MultiOptionFilterField,
  NumberFilterField,
  OptionFilterField,
  TextFilterField,
} from "./components/data-table-filter/filter-fields";
export { createDataTableFilterFn } from "./components/data-table-filter/filter-fn";
export type { DataTableFilterFn } from "./components/data-table-filter/filter-fn";
export { calendarDateIn, matchesFilter, normalizeText } from "./components/data-table-filter/filter-match";
export type { MatchOptions } from "./components/data-table-filter/filter-match";
export { OPERATORS } from "./components/data-table-filter/filter-model";
export type {
  DataTableFilterEntry,
  DataTableFilterState,
  FilterKind,
  FilterOperator,
  FilterValue,
  IsoDate,
  OperatorTarget,
} from "./components/data-table-filter/filter-model";
export { parseColumnFilters } from "./components/data-table-filter/filter-parse";
