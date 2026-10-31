/**
 * A label's width estimate, as CONTRACT section 8.11 uses it to thin x ticks. The server formats
 * every label, then sums the Roboto advance widths of its characters at the 12 px label size,
 * because Roboto is the sans font of every brand and chart text never follows density. No label is
 * measured in the browser, so the server and every engine pick the same ticks.
 */

/** The characters the advance table covers, in the order of {@link ADVANCES}. */
const CHARACTERS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00a0\u2009\u2013\u2212\u00b7\u00e6\u00f8\u00e5\u00c6\u00d8\u00c5\u00e4\u00f6\u00c4\u00d6\u00e9\u00fc";

/**
 * Roboto Regular's advance widths at 12 px, read from the font's `hmtx` table and rounded to three
 * decimals. A test compares them with the font itself.
 */
const ADVANCES = [
  2.977, 3.094, 3.844, 7.389, 6.744, 8.789, 7.465, 2.098, 4.107, 4.178, 5.168, 6.809, 2.361, 3.316, 3.164,
  4.951, 6.744, 6.744, 6.744, 6.744, 6.744, 6.744, 6.744, 6.744, 6.744, 6.744, 2.906, 2.537, 6.1, 6.586,
  6.275, 5.672, 10.775, 7.828, 7.477, 7.811, 7.875, 6.82, 6.633, 8.174, 8.561, 3.264, 6.621, 7.529, 6.463,
  10.477, 8.561, 8.256, 7.57, 8.256, 7.395, 7.125, 7.16, 7.781, 7.641, 10.646, 7.523, 7.207, 7.189, 3.182,
  4.928, 3.182, 5.016, 5.414, 3.709, 6.527, 6.738, 6.281, 6.768, 6.363, 4.172, 6.738, 6.609, 2.918, 2.871,
  6.082, 2.918, 10.523, 6.627, 6.844, 6.738, 6.82, 4.066, 6.193, 3.926, 6.615, 5.812, 9.018, 5.953, 5.678,
  5.953, 4.061, 2.93, 4.061, 8.162, 2.977, 2.449, 7.875, 6.861, 3.135, 10.137, 6.803, 6.527, 11.215, 8.256,
  7.828, 6.527, 6.844, 7.828, 8.256, 6.363, 6.615,
] as const;

/** The advance of a character the table lacks, which is a digit's, the widest common class. */
const FALLBACK = 6.744;

const TABLE = new Map<string, number>();
let position = 0;
// Every character of the table is one UTF-16 unit, so code points and positions agree.
for (const character of CHARACTERS) {
  TABLE.set(character, ADVANCES[position] ?? FALLBACK);
  position += 1;
}

/**
 * The advance width of one character at 12 px.
 *
 * @param character - One code point.
 * @returns Its width in CSS pixels.
 */
export function advanceOf(character: string): number {
  return TABLE.get(character) ?? FALLBACK;
}

/**
 * Estimate a label's width at 12 px.
 *
 * @param label - The visual label.
 * @returns Its width in CSS pixels.
 */
export function labelWidth(label: string): number {
  let width = 0;
  for (const character of label) width += advanceOf(character);
  return width;
}
