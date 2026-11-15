// This file is the source entry for `@elmeragroup/fuse/emoji`. It contains only explicit named re-exports,
// with no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. Each face also ships as a named export
// for tree-shaking, and `Emoji` stays the main export. It exports no public recipe.
export {
  Emoji,
  LoudlyCryingFace,
  NeutralFace,
  PartyingFace,
  SlightlyFrowningFace,
  SlightlySmilingFace,
} from "./components/emoji/emoji";
export type { EmojiProps } from "./components/emoji/emoji";
