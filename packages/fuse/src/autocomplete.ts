// This file is the source entry for `@elmeragroup/fuse/autocomplete`. It contains only explicit named
// re-exports, with no `export *`, local declarations or directives. The exports and barrel generators read
// this file, so change `package.json#exports` and `src/index.ts` only through them. It exports no public
// recipe, because the parts style themselves with Combobox's popup look.
export { Autocomplete } from "./components/autocomplete";
export type {
  AutocompleteClearProps,
  AutocompleteContentProps,
  AutocompleteInputProps,
  AutocompleteRootProps,
} from "./components/autocomplete/autocomplete";
