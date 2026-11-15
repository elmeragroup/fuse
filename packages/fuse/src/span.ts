// The source entry for `@elmeragroup/fuse/span`. It holds explicit named re-exports only, with no
// `export *`, no local declarations and no directives. The exports and barrel generators find this
// file, so never edit `package.json#exports` or `src/index.ts` by hand. `spanVariants` is public.
export { Span } from "./components/span/span";
export type { SpanProps } from "./components/span/span";
export { spanVariants } from "./components/span/span-variants";
