// The source entry for `@elmeragroup/fuse/autocomplete`. It holds explicit named re-exports only,
// with no `export *`, no local declarations and no directives. The exports and barrel generators
// find this file, so never edit `package.json#exports` or `src/index.ts` by hand.
// It exports no public recipe, because the parts style themselves with Combobox's popup look.
export { Autocomplete } from "./components/autocomplete";
export type {
  AutocompleteClearProps,
  AutocompleteContentProps,
  AutocompleteInputProps,
  AutocompleteRootProps,
} from "./components/autocomplete/autocomplete";
