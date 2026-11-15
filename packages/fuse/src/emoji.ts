// The source entry for `@elmeragroup/fuse/emoji`. It holds explicit named re-exports only, with
// no `export *`, no local declarations and no directives. The exports and barrel generators find
// this file, so never edit `package.json#exports` or `src/index.ts` by hand. Each face also ships
// as a named export for tree-shaking, and `Emoji` stays the main export. It exports no public recipe.
export {
  Emoji,
  LoudlyCryingFace,
  NeutralFace,
  PartyingFace,
  SlightlyFrowningFace,
  SlightlySmilingFace,
} from "./components/emoji/emoji";
export type { EmojiProps } from "./components/emoji/emoji";
