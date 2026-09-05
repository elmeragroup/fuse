// Source entry facade for `@elmeragroup/ui/timeline-list` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. The recipe stays module-private (timeline-list.md §4 / §8.3).
export { TimelineList } from "./components/timeline-list/timeline-list";
export type {
  TimelineListDescriptionProps,
  TimelineListItemProps,
  TimelineListRootProps,
  TimelineListTimeProps,
  TimelineListTitleProps,
} from "./components/timeline-list/timeline-list";
