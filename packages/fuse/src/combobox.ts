// Source entry facade for `@elmeragroup/fuse/combobox`. The file holds only explicit named
// re-exports, with no `export *`, no local declarations and no directives.
// The exports and barrel generators discover this file, so never hand-edit package.json#exports
// or src/index.ts. There is no public recipe, and each part writes its styling inline.
export { Combobox } from "./components/combobox";
export { useComboboxAnchor } from "./components/combobox/combobox";
export type {
  ComboboxChipProps,
  ComboboxChipsProps,
  ComboboxClearProps,
  ComboboxContentProps,
  ComboboxInputProps,
  ComboboxRootProps,
} from "./components/combobox/combobox";
