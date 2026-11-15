// This file is the source entry for `@elmeragroup/fuse/timeline-list`. It contains only explicit named
// re-exports, with no `export *`, local declarations or directives. The exports and barrel generators read
// this file, so change `package.json#exports` and `src/index.ts` only through them. The recipe stays
// module-private.
export { TimelineList } from "./components/timeline-list/timeline-list";
export type {
  TimelineListDescriptionProps,
  TimelineListItemProps,
  TimelineListRootProps,
  TimelineListTimeProps,
  TimelineListTitleProps,
} from "./components/timeline-list/timeline-list";
