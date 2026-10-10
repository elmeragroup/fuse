/** A rectangle in canvas screen px. */
export type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** A length per side, in CSS px. */
export type Sides = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/** A shaded band the measure overlay draws, in screen px, and the CSS px it labels. */
export type Band = { readonly box: Box; readonly px: number };

/** Below this many screen px, two edges count as touching. */
const TOUCHING = 0.5;

/**
 * An element's padding as one band per padded side, in screen space: top and bottom span the
 * padding box, left and right sit between them. The bands start inside the border, so a
 * bordered control shades its padding, not its border.
 *
 * @param box - The element's border box on screen.
 * @param sides - Its computed padding and border widths in CSS px.
 * @param scale - Screen px per CSS px, the canvas zoom.
 */
export function paddingBands(
  box: Box,
  { padding, border }: { readonly padding: Sides; readonly border: Sides },
  scale: number
): Band[] {
  const inner = {
    x: box.x + border.left * scale,
    y: box.y + border.top * scale,
    width: box.width - (border.left + border.right) * scale,
    height: box.height - (border.top + border.bottom) * scale,
  };
  const top = padding.top * scale;
  const right = padding.right * scale;
  const bottom = padding.bottom * scale;
  const left = padding.left * scale;
  const middle = { y: inner.y + top, height: inner.height - top - bottom };
  const bands: Band[] = [
    { box: { x: inner.x, y: inner.y, width: inner.width, height: top }, px: padding.top },
    { box: { x: inner.x + inner.width - right, ...middle, width: right }, px: padding.right },
    {
      box: { x: inner.x, y: inner.y + inner.height - bottom, width: inner.width, height: bottom },
      px: padding.bottom,
    },
    { box: { x: inner.x, ...middle, width: left }, px: padding.left },
  ];
  return bands.filter((band) => band.px > 0);
}

/** The shared span of two ranges, or both together when they do not overlap. */
function span(startA: number, endA: number, startB: number, endB: number): [number, number] {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  return end > start ? [start, end] : [Math.min(startA, startB), Math.max(endA, endB)];
}

/**
 * The gaps between consecutive children: beside each other in a row, or stacked. A gap spans
 * the children's shared height or width. Children that touch or overlap have none.
 *
 * @param children - The children's border boxes on screen, in document order.
 * @param scale - Screen px per CSS px.
 */
export function childGaps(children: readonly Box[], scale: number): Band[] {
  return children.slice(1).flatMap((next, index) => {
    const previous = children[index];
    if (previous === undefined) {
      return [];
    }
    const right = previous.x + previous.width;
    const bottom = previous.y + previous.height;
    if (next.x - right > TOUCHING) {
      const [y, end] = span(previous.y, bottom, next.y, next.y + next.height);
      return [{ box: { x: right, y, width: next.x - right, height: end - y }, px: (next.x - right) / scale }];
    }
    if (next.y - bottom > TOUCHING) {
      const [x, end] = span(previous.x, right, next.x, next.x + next.width);
      return [
        { box: { x, y: bottom, width: end - x, height: next.y - bottom }, px: (next.y - bottom) / scale },
      ];
    }
    return [];
  });
}

/** A CSS px length as a label: at most two decimals, without trailing zeros. */
export function formatPx(px: number): string {
  return String(Math.round(px * 100) / 100);
}
