const SPACES = /[\u0020\u2009\u202f\u00a0]/gu;

/**
 * Map every space in a Fuse-formatted string to U+00A0. Engines disagree on which space Intl
 * writes. Node 26 writes `−3,5 °C` with U+0020 where WebKit writes U+00A0, and Node puts U+2009
 * around the en-US range dash where the browsers put U+0020. Before the en-US day period, Node
 * writes U+0020 and the engines write U+0020, U+202F or U+00A0. Any of these differences fails
 * hydration. A no-break space also keeps a label on one line. Consumer strings never pass through
 * this.
 *
 * @param text - A string Fuse formatted.
 * @returns The string with U+0020, U+2009, U+202F and U+00A0 written as U+00A0.
 */
export function canonicalSpaces(text: string): string {
  return text.replace(SPACES, "\u00a0");
}
