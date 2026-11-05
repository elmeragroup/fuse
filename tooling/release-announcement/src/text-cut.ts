/**
 * Cutting text to a length without breaking what a reader sees as one character. Lengths count
 * UTF-16 code units, as JavaScript's `length` and the Block Kit limits here do. A cut lands
 * between grapheme clusters (`Intl.Segmenter`), so it splits no surrogate pair, emoji, flag, ZWJ
 * sequence or letter with combining marks. A single cluster longer than the length, such as a
 * letter under a long run of combining marks, is cut between code points instead, which still
 * leaves well-formed text. Escaped mrkdwn text is never cut inside an entity either.
 */

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The entities `escapeText` writes, at most five units long. */
const ENTITY = /^&(?:amp|lt|gt);/u;

/** Whether `at` falls inside an entity of escaped `text`. */
function insideEntity(text: string, at: number): boolean {
  // An entity holds one `&`, so only the last one before `at` can be open there.
  const amp = text.lastIndexOf("&", at - 1);
  if (amp === -1 || amp < at - 4) return false;
  const entity = ENTITY.exec(text.slice(amp, amp + 5));
  return entity !== null && amp + entity[0].length > at;
}

/** The longest prefix of `text` within `length` that ends where `allowed` permits a cut. */
function cut(text: string, length: number, allowed: (at: number) => boolean): string {
  if (text.length <= length) return text;
  let end = 0;
  for (const { index, segment } of GRAPHEMES.segment(text)) {
    const next = index + segment.length;
    if (next > length) break;
    if (allowed(next)) end = next;
  }
  if (end > 0) return text.slice(0, end);
  // The first cluster alone is longer than `length`: cut it between code points.
  let at = 0;
  for (const point of text) {
    if (at + point.length > length) break;
    at += point.length;
    if (allowed(at)) end = at;
  }
  return text.slice(0, end);
}

/**
 * The longest prefix of `text` of at most `length` units that ends between grapheme clusters.
 *
 * @param text - Plain text.
 * @param length - The most UTF-16 code units the prefix may have.
 * @returns The prefix; empty only when `length` is less than the first code point.
 */
export function cutText(text: string, length: number): string {
  return cut(text, length, () => true);
}

/**
 * The longest prefix of escaped mrkdwn `text` of at most `length` units that ends between grapheme
 * clusters and outside every `&amp;`, `&lt;` and `&gt;`.
 *
 * @param text - Text escaped by `escapeText`.
 * @param length - The most UTF-16 code units the prefix may have.
 * @returns The prefix; never empty when `length` is at least 5, the longest entity.
 */
export function cutEscaped(text: string, length: number): string {
  return cut(text, length, (at) => !insideEntity(text, at));
}
