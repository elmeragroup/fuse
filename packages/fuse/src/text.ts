// This file is the source entry for `@elmeragroup/fuse/text`. It contains only explicit named re-exports,
// with no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. `textVariants` is public.
export { Text } from "./components/text/text";
export type { TextProps } from "./components/text/text";
export { textVariants } from "./components/text/text-variants";
