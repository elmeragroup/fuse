// The source entry for `@elmeragroup/fuse/button-group`. It holds explicit named re-exports only,
// with no `export *`, no local declarations and no directives. The exports and barrel generators
// find this file, so never edit `package.json#exports` or `src/index.ts` by hand.
// It exports a public recipe for reuse in other components.
export { ButtonGroup } from "./components/button-group";
export type {
  ButtonGroupRootProps,
  ButtonGroupSeparatorProps,
  ButtonGroupTextProps,
} from "./components/button-group/button-group";
export { buttonGroupVariants } from "./components/button-group/button-group-variants";
