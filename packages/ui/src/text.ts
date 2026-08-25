// Source entry facade for `@elmeragroup/ui/text` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. `textVariants` is PUBLIC (text.md §4).
export { Text } from "./components/text/text";
export type { TextProps } from "./components/text/text";
export { textVariants } from "./components/text/text-variants";
