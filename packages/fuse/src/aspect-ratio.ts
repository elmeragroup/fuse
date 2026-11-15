// This file is the source entry for `@elmeragroup/fuse/aspect-ratio`. It contains only explicit named
// re-exports, with no `export *`, local declarations or directives. The exports and barrel generators read
// this file, so change `package.json#exports` and `src/index.ts` only through them. It exports no public
// recipe. The ratio classes stay module-private.
export { AspectRatio } from "./components/aspect-ratio/aspect-ratio";
export type { AspectRatioProps, AspectRatioValue } from "./components/aspect-ratio/aspect-ratio";
