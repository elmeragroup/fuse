// Source entry facade for `@elmeragroup/fuse/frame` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe.
export { Frame } from "./components/frame/frame";
export type {
  FrameDescriptionProps,
  FrameFooterProps,
  FrameHeaderProps,
  FramePanelProps,
  FrameRootProps,
  FrameTitleProps,
} from "./components/frame/frame";
