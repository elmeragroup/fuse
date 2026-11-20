/**
 * Code, as one component set on a page of its own: the docs default demo's two lines, 1 cell.
 *
 * - The root is the `<pre data-slot="code">`. Its sample renders in a 448px host, the Card host's
 *   width, wider than the demo's longest line.
 * - Its one label is the demo's source, which sugar-high splits into a span per token below an inner
 *   `<code>`, each with an inline `color`. The label draws each token's color as a range of the text.
 * - The label has no TEXT property: Figma does not color the characters a designer types, and on
 *   2026-11-19 a `characters` write, even of the same text, gave every character the first
 *   character's fill.
 */
import type { SetManifest } from "../capture/manifest";
import { always } from "./popup-facts";

/** The width the kit's previews and the compare host give the block. */
export const CODE_PREVIEW_WIDTH = 448;

/** The docs default demo's source. */
export const CODE_SAMPLE = `const answer = 42;
console.log(answer);`;

/** The block's manifest, which the capture-backed build reads with `captures/code.json`. */
export const CODE_MANIFEST: SetManifest = {
  key: "code",
  name: "Code",
  api: { page: "code", parts: ["Code"] },
  slot: "code",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  previewWidth: CODE_PREVIEW_WIDTH,
  label: { key: "text", name: "text", characters: CODE_SAMPLE, textProperty: undefined, shownIn: always },
  iconsFor: () => [],
  swapProperties: [],
};
