// Source entry facade for `@elmeragroup/fuse/kbd` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe: the cap and group classes stay module-private.
export { Kbd, KbdGroup } from "./components/kbd/kbd";
export type { KbdGroupProps, KbdProps } from "./components/kbd/kbd";
