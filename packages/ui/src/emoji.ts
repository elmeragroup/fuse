// Source entry facade for `@elmeragroup/ui/emoji` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. Faces also ship as named exports for tree-shaking; `Emoji` stays
// canonical (emoji.md §8.3). No public recipe.
export {
  Emoji,
  LoudlyCryingFace,
  NeutralFace,
  PartyingFace,
  SlightlyFrowningFace,
  SlightlySmilingFace,
} from "./components/emoji/emoji";
export type { EmojiProps } from "./components/emoji/emoji";
