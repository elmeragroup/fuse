// Source entry facade for `@elmeragroup/fuse/action-bar` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe: the bar's classes stay module-private.
export { ActionBar } from "./components/action-bar";
export type {
  ActionBarButtonLabelProps,
  ActionBarButtonProps,
  ActionBarClearProps,
  ActionBarCountProps,
  ActionBarRootProps,
  ActionBarSeparatorProps,
} from "./components/action-bar/action-bar";
