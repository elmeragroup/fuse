// This file is the source entry for `@elmeragroup/fuse/kbd`. It contains only explicit named re-exports, with
// no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. It exports no public recipe, and the
// cap and group classes stay module-private.
export { Kbd, KbdGroup } from "./components/kbd/kbd";
export type { KbdGroupProps, KbdProps } from "./components/kbd/kbd";
