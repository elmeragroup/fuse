// Source entry facade for `@elmeragroup/fuse/link`. It is a pure re-export file with explicit named
// re-exports only, and has no `export *`, local declarations or directives. The exports and barrel generators
// discover this file, so never hand-edit `package.json#exports` or `src/index.ts`.
// `linkVariants` is public.
export { Link } from "./components/link/link";
export type { LinkProps } from "./components/link/link";
export { linkVariants } from "./components/link/link-variants";
