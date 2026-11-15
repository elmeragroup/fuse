// Source entry facade for `@elmeragroup/fuse/action-bar`. The file holds only explicit named
// re-exports, with no `export *`, no local declarations and no directives.
// The exports and barrel generators discover this file, so never hand-edit package.json#exports
// or src/index.ts. The bar has no public recipe, and its classes stay module-private.
export { ActionBar } from "./components/action-bar";
export type {
  ActionBarButtonLabelProps,
  ActionBarButtonProps,
  ActionBarClearProps,
  ActionBarCountProps,
  ActionBarRootProps,
  ActionBarSeparatorProps,
} from "./components/action-bar/action-bar";
