// This is the source entry facade for `@elmeragroup/fuse/timeline-list`. It holds explicit named
// re-exports and no `export *`, local declaration or directive. The exports and barrel generators
// discover this file, so never hand-edit `package.json#exports` or `src/index.ts`. The recipe
// stays module-private.
export { TimelineList } from "./components/timeline-list/timeline-list";
export type {
  TimelineListDescriptionProps,
  TimelineListItemProps,
  TimelineListRootProps,
  TimelineListTimeProps,
  TimelineListTitleProps,
} from "./components/timeline-list/timeline-list";
