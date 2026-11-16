// This file is the source entry for `@elmeragroup/fuse/attachment`. It contains only explicit named
// re-exports, with no `export *`, local declarations or directives. The exports and barrel generators read
// this file, so change `package.json#exports` and `src/index.ts` only through them. There is no public
// recipe, and the part classes stay module-private.
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
