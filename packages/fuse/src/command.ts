// Source entry facade for `@elmeragroup/fuse/command` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe. The virtualized list is the opt-in
// `@elmeragroup/fuse/command-virtual` entry, so this one never imports TanStack.
export { Command } from "./components/command";
export type {
  CommandBackProps,
  CommandDialogProps,
  CommandGroupedRootProps,
  CommandHintPresetProps,
  CommandInputProps,
  CommandItemProps,
  CommandPageProps,
  CommandPagesProps,
  CommandPageTriggerProps,
  CommandRootProps,
} from "./components/command/command";
export type {
  CommandFooterProps,
  CommandHintProps,
  CommandShortcutProps,
} from "./components/command/command-markup";
