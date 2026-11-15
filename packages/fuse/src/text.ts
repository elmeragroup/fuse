// Source entry facade for `@elmeragroup/fuse/text`. It is a pure re-export file with explicit named
// re-exports only, and has no `export *`, local declarations or directives. The exports and barrel generators
// discover this file, so never hand-edit `package.json#exports` or `src/index.ts`.
// `textVariants` is public.
export { Text } from "./components/text/text";
export type { TextProps } from "./components/text/text";
export { textVariants } from "./components/text/text-variants";
