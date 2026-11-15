// Source entry facade for `@elmeragroup/fuse/attachment`. The file holds only explicit named
// re-exports, with no `export *`, no local declarations and no directives.
// The exports and barrel generators discover this file, so never hand-edit package.json#exports
// or src/index.ts. There is no public recipe, and the part classes stay module-private.
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
