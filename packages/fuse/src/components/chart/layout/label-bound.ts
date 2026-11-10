/**
 * A label's width bound: the widest it draws at the 12 px label size in any common sans. A polar
 * dial's ring values fit beside its angle labels by it, since the page, not Fuse, picks the font,
 * and a fit by Roboto's widths alone lets a wider face collide. Like `label-width.ts`, it measures
 * nothing in the browser, so the server and every engine show the same values.
 */
import { CHARACTERS } from "./label-width";

/**
 * The widest each character of {@link CHARACTERS} draws at 12 px, in whole pixels: its advance in
 * Roboto or Inter, the brands' faces, or in DejaVu Sans or Liberation Sans, the widest common
 * fallback and Arial's metrics, as its default glyph or its tabular figure, whichever is widest,
 * rounded up. An engine that snaps advances to whole pixels, as Chromium on Linux does for web
 * fonts, draws no glyph wider. A test compares them with each face's `hmtx` table.
 */
const BOUNDS = [
  4, 5, 6, 11, 8, 12, 10, 4, 5, 5, 8, 11, 4, 8, 4, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 5, 11, 11, 11, 7, 13,
  9, 9, 9, 10, 9, 8, 10, 10, 4, 7, 9, 7, 11, 10, 10, 9, 10, 9, 9, 8, 9, 9, 12, 9, 9, 9, 5, 5, 5, 11, 7, 6, 8,
  8, 7, 8, 8, 5, 8, 8, 4, 4, 7, 4, 12, 8, 8, 8, 8, 5, 7, 5, 8, 8, 10, 8, 8, 7, 8, 5, 8, 11, 4, 3, 8, 11, 4,
  12, 8, 8, 12, 10, 9, 8, 8, 9, 10, 8, 8,
] as const;

/** The bound of a character the table lacks, which is a digit's, the widest common class. */
const FALLBACK = 8;

const TABLE = new Map<string, number>();
let position = 0;
// Every character of the table is one UTF-16 unit, so code points and positions agree.
for (const character of CHARACTERS) {
  TABLE.set(character, BOUNDS[position] ?? FALLBACK);
  position += 1;
}

/**
 * Bound a label's width at 12 px: the widest it draws in Roboto, Inter, DejaVu Sans or Liberation
 * Sans, with default or tabular figures, each glyph rounded up to a whole pixel. A character the
 * table lacks counts as the widest digit.
 *
 * @param label - The visual label.
 * @returns Its widest width in CSS pixels.
 */
export function labelBound(label: string): number {
  let width = 0;
  for (const character of label) width += TABLE.get(character) ?? FALLBACK;
  return width;
}
