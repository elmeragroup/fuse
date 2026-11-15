// This file is the source entry for `@elmeragroup/fuse/button-group`. It contains only explicit named
// re-exports, with no `export *`, local declarations or directives. The exports and barrel generators read
// this file, so change `package.json#exports` and `src/index.ts` only through them. It exports a public
// recipe for reuse in other components.
export { ButtonGroup } from "./components/button-group";
export type {
  ButtonGroupRootProps,
  ButtonGroupSeparatorProps,
  ButtonGroupTextProps,
} from "./components/button-group/button-group";
export { buttonGroupVariants } from "./components/button-group/button-group-variants";
