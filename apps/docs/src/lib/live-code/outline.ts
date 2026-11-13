/**
 * The geometry of the stage editor's part outline: where a ring goes around an element, given what
 * its ancestors clip. Pure arithmetic over measured rects; `stage-editor.tsx` samples the DOM.
 */

/** A rect by its edges, in viewport px. */
type Edges = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** An ancestor whose overflow clips: its padding box, and the axes it clips on. */
export type Clipper = {
  readonly box: Edges;
  readonly x: boolean;
  readonly y: boolean;
};

/** An element's layout metrics: its untransformed size, border offsets and padding box size. */
type BoxMetrics = {
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly clientLeft: number;
  readonly clientTop: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
};

/**
 * An element's padding box in viewport px, from its border box as the viewport sees it, which a
 * transform such as `scale` has resized, and its untransformed metrics, scaled to match.
 *
 * @param border - The element's `getBoundingClientRect()`.
 * @param metrics - Its offset and client metrics.
 * @returns The padding box's edges.
 */
export function paddingBox(
  border: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  metrics: BoxMetrics
): Edges {
  const x = metrics.offsetWidth === 0 ? 1 : border.width / metrics.offsetWidth;
  const y = metrics.offsetHeight === 0 ? 1 : border.height / metrics.offsetHeight;
  const left = border.left + metrics.clientLeft * x;
  const top = border.top + metrics.clientTop * y;
  return { left, top, right: left + metrics.clientWidth * x, bottom: top + metrics.clientHeight * y };
}

/** A ring's box against the outline layer's origin, and how far its ring may paint past it. */
export type RingBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** How far past each edge, top, right, bottom and left, the ring may paint, in px. */
  readonly reach: readonly [number, number, number, number];
};

/**
 * The ring around what shows of an element: the element's rect cut by each clipper on the axes it
 * clips, as a scrolled list hides its overscan rows, moved to the layer's origin. The ring paints
 * past the box up to `ring` px on each side, and never past the region the clippers leave.
 *
 * @param element - The element's rect.
 * @param clippers - Its clipping ancestors, in any order.
 * @param origin - The outline layer's top left corner.
 * @param ring - How far the ring reaches past its box when nothing stops it.
 * @returns The ring's box, or `null` when nothing of the element shows.
 */
export function ringBox(
  element: Edges,
  clippers: readonly Clipper[],
  origin: { readonly left: number; readonly top: number },
  ring: number
): RingBox | null {
  const clip = clippers.reduce<Edges>(
    (edges, { box, x, y }) => ({
      left: x ? Math.max(edges.left, box.left) : edges.left,
      right: x ? Math.min(edges.right, box.right) : edges.right,
      top: y ? Math.max(edges.top, box.top) : edges.top,
      bottom: y ? Math.min(edges.bottom, box.bottom) : edges.bottom,
    }),
    { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity }
  );
  const shown: Edges = {
    left: Math.max(element.left, clip.left),
    top: Math.max(element.top, clip.top),
    right: Math.min(element.right, clip.right),
    bottom: Math.min(element.bottom, clip.bottom),
  };
  if (shown.right <= shown.left || shown.bottom <= shown.top) return null;
  const reach = (room: number): number => Math.min(room, ring);
  return {
    left: shown.left - origin.left,
    top: shown.top - origin.top,
    width: shown.right - shown.left,
    height: shown.bottom - shown.top,
    reach: [
      reach(shown.top - clip.top),
      reach(clip.right - shown.right),
      reach(clip.bottom - shown.bottom),
      reach(shown.left - clip.left),
    ],
  };
}
