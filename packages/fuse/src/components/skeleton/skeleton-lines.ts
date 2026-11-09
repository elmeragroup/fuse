/**
 * The pure half of drawing text as bones: line fragments in, one bar per visual line out.
 * `Range.getClientRects` reports one rect per fragment, and a line of text breaks into several
 * wherever an inline element (a link, a `strong`, a time) starts or ends. Fragments that share a
 * line and sit closer than `LINE_GAP` of their font size merge, so one line reads as one bar while
 * two columns of text a gutter apart stay two.
 */

/** Of the font size: wider than a word space, narrower than a column gutter. */
const LINE_GAP = 0.4;

/** One fragment of a line of text, in the bones layer's pixels. */
export type LineFragment = {
  /** The fragment's line box, as the range reports it. */
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  /** The computed font size of the text, in pixels. */
  readonly fontSize: number;
  /** Where the bar is drawn within the line box: the font's ascender down to its descender. */
  readonly barTop: number;
  readonly barBottom: number;
};

/** One bar to draw, in the bones layer's pixels. */
export type LineBar = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The largest computed font size of the line's fragments, in pixels. */
  readonly fontSize: number;
};

/** A line being merged, which later fragments on the same line extend. */
type OpenLine = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  fontSize: number;
  barTop: number;
  barBottom: number;
};

/** Whether a fragment continues an open line: half its height overlaps, and the gap is small. */
function continues(line: OpenLine, fragment: LineFragment): boolean {
  const overlap = Math.min(line.bottom, fragment.bottom) - Math.max(line.top, fragment.top);
  const shorter = Math.min(line.bottom - line.top, fragment.bottom - fragment.top);
  const gap = fragment.left - line.right;
  return overlap >= shorter / 2 && gap <= Math.max(line.fontSize, fragment.fontSize) * LINE_GAP;
}

/**
 * Merges line fragments into one bar per visual line.
 *
 * @param fragments - Every fragment of every text node, in any order.
 * @returns One bar per merged line, spanning its fragments across and from the highest bar top
 *   to the lowest bar bottom, at the largest font size among them.
 */
export function mergeLineFragments(fragments: readonly LineFragment[]): LineBar[] {
  // Left to right, so each fragment only ever extends a line to its left.
  const sorted = fragments.toSorted((a, b) => a.left - b.left);
  const lines: OpenLine[] = [];
  for (const fragment of sorted) {
    const line = lines.find((open) => continues(open, fragment));
    if (line === undefined) {
      lines.push({ ...fragment });
      continue;
    }
    line.left = Math.min(line.left, fragment.left);
    line.right = Math.max(line.right, fragment.right);
    line.top = Math.min(line.top, fragment.top);
    line.bottom = Math.max(line.bottom, fragment.bottom);
    line.fontSize = Math.max(line.fontSize, fragment.fontSize);
    line.barTop = Math.min(line.barTop, fragment.barTop);
    line.barBottom = Math.max(line.barBottom, fragment.barBottom);
  }
  return lines.map((line) => ({
    x: line.left,
    y: line.barTop,
    width: line.right - line.left,
    height: line.barBottom - line.barTop,
    fontSize: line.fontSize,
  }));
}
