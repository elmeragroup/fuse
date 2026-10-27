// Source entry facade for `@elmeragroup/fuse/autocomplete` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe — the parts style themselves with Combobox's popup look.
export { Autocomplete } from "./components/autocomplete";
export { AutocompleteField } from "./components/autocomplete/autocomplete-field";
export type {
  AutocompleteClearProps,
  AutocompleteContentProps,
  AutocompleteInputProps,
  AutocompleteRootProps,
} from "./components/autocomplete/autocomplete";
export type { AutocompleteFieldProps } from "./components/autocomplete/autocomplete-field";
