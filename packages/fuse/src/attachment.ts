// Source entry facade for `@elmeragroup/fuse/attachment` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe. The part classes stay module-private.
export { Attachment } from "./components/attachment";
export type {
  AttachmentAspectRatioProps,
  AttachmentMediaProps,
} from "./components/attachment/attachment-markup";
export type { AttachmentActionProps } from "./components/attachment/attachment-action";
export type {
  AttachmentGroupProps,
  AttachmentOrientation,
  AttachmentRootProps,
  AttachmentState,
} from "./components/attachment/attachment";
export type { AttachmentTriggerProps } from "./components/attachment/attachment-trigger";
