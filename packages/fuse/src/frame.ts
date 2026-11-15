// Source entry facade for `@elmeragroup/fuse/frame`. It holds explicit named re-exports only, with
// no `export *`, no local declarations and no directives. The exports and barrel generators
// discover this file, so never hand-edit package.json#exports or src/index.ts. It has no public
// recipe.
export { Frame } from "./components/frame/frame";
export type {
  FrameDescriptionProps,
  FrameFooterProps,
  FrameHeaderProps,
  FrameLayout,
  FramePanelProps,
  FrameRootProps,
  FrameTitleProps,
} from "./components/frame/frame";
