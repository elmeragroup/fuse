// Source entry for `@elmeragroup/fuse/kbd`. It holds only explicit named re-exports, with no
// `export *`, no local declarations and no directives. The exports and barrel generators discover
// this file, so never hand-edit package.json#exports or src/index.ts. It exports no public
// recipe, and the cap and group classes stay module-private.
export { Kbd, KbdGroup } from "./components/kbd/kbd";
export type { KbdGroupProps, KbdProps } from "./components/kbd/kbd";
