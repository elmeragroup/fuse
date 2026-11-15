// This file is the source entry for `@elmeragroup/fuse/link`. It contains only explicit named re-exports,
// with no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. `linkVariants` is public.
export { Link } from "./components/link/link";
export type { LinkProps } from "./components/link/link";
export { linkVariants } from "./components/link/link-variants";
