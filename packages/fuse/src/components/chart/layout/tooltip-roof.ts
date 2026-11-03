/**
 * The roof over a span of the plot: the highest point of the drawn marks whose geometry reaches into
 * it. A chart popup rests on the roof under its own width, so it covers no mark. The marks come in
 * as pieces in plot pixels, y down: straight lines through points the browser sampled along a drawn
 * path, a box's top and sides, and the ellipse of a dot. A profile keeps the roof of each pixel
 * column, so a span's roof costs one pass over the columns it covers, however many marks drew.
 */

/** A straight piece of a drawn mark. */
type LinePiece = {
  readonly kind: "line";
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};

/** An ellipse, such as a dot. */
type EllipsePiece = {
  readonly kind: "ellipse";
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
};

/** One piece of a drawn mark. */
export type MarkPiece = LinePiece | EllipsePiece;

/** A drawn mark: its pieces, and how far its stroke reaches past them. */
export type RoofMark = {
  readonly pieces: readonly MarkPiece[];
  /** Half the stroke width, or 0 for a mark that only fills. */
  readonly reach: number;
};

/**
 * The roof of each pixel column over a stretch of the plot. Column `i` covers x from `start + i` to
 * `start + i + 1`, and holds the smallest y any mark reaches there, or infinity where none does.
 */
export type RoofProfile = { readonly start: number; readonly tops: Float64Array };

/**
 * The pieces of a line through points, such as the samples along a drawn path.
 *
 * @param points - The points in order, x then y.
 * @returns A line between each point and the next.
 */
export function polyline(points: readonly (readonly [number, number])[]): MarkPiece[] {
  const pieces: MarkPiece[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const [x0, y0] = points[index - 1] ?? [0, 0];
    const [x1, y1] = points[index] ?? [0, 0];
    pieces.push({ kind: "line", x0, y0, x1, y1 });
  }
  return pieces;
}

/**
 * The pieces of an upright box: its top edge and its sides, which hold every point it reaches.
 *
 * @param x - The left edge.
 * @param y - The top edge.
 * @param width - The width.
 * @param height - The height.
 * @returns The pieces, none for a box of negative size.
 */
export function box(x: number, y: number, width: number, height: number): MarkPiece[] {
  if (!(width >= 0 && height >= 0)) return [];
  return [
    { kind: "line", x0: x, y0: y, x1: x + width, y1: y },
    { kind: "line", x0: x, y0: y, x1: x, y1: y + height },
    { kind: "line", x0: x + width, y0: y, x1: x + width, y1: y + height },
  ];
}

/**
 * The piece of an upright ellipse.
 *
 * @param cx - The centre's x.
 * @param cy - The centre's y.
 * @param rx - The radius along x.
 * @param ry - The radius along y.
 * @returns The piece, none for an empty ellipse.
 */
export function ellipse(cx: number, cy: number, rx: number, ry: number): MarkPiece[] {
  return rx > 0 && ry > 0 ? [{ kind: "ellipse", cx, cy, rx, ry }] : [];
}

/** The upright box around some pieces. */
export type PieceBounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/**
 * The upright box that holds every piece: the lines' ends and each ellipse's extent.
 *
 * @param pieces - The pieces.
 * @param also - Bounds the box must hold too, such as a mark's box in another state.
 * @returns The box, or `also` when there are no pieces.
 */
export function boundsOf(pieces: readonly MarkPiece[], also: PieceBounds | null = null): PieceBounds | null {
  let bounds = also;
  const hold = (left: number, top: number, right: number, bottom: number) => {
    bounds =
      bounds === null
        ? { left, top, right, bottom }
        : {
            left: Math.min(bounds.left, left),
            top: Math.min(bounds.top, top),
            right: Math.max(bounds.right, right),
            bottom: Math.max(bounds.bottom, bottom),
          };
  };
  for (const piece of pieces) {
    if (piece.kind === "line") {
      hold(
        Math.min(piece.x0, piece.x1),
        Math.min(piece.y0, piece.y1),
        Math.max(piece.x0, piece.x1),
        Math.max(piece.y0, piece.y1)
      );
    } else {
      hold(piece.cx - piece.rx, piece.cy - piece.ry, piece.cx + piece.rx, piece.cy + piece.ry);
    }
  }
  return bounds;
}

/**
 * The roof profile of drawn marks over a stretch of the plot. A stroke reaches its half width past
 * a piece both ways, so a line's stroke and a dot's ring count where they draw. A piece counts in
 * each column from the one that holds its left end to the one that holds its right end.
 *
 * @param marks - The drawn marks.
 * @param start - The stretch's left edge.
 * @param end - The stretch's right edge.
 * @returns The profile, one column per whole pixel from `start` to `end`.
 */
export function roofProfile(marks: readonly RoofMark[], start: number, end: number): RoofProfile {
  const first = Math.floor(start);
  const tops = new Float64Array(Math.max(1, Math.ceil(end) - first)).fill(Number.POSITIVE_INFINITY);
  const last = first + tops.length - 1;
  for (const { pieces, reach } of marks) {
    for (const piece of pieces) {
      const [low, high] =
        piece.kind === "line"
          ? [Math.min(piece.x0, piece.x1), Math.max(piece.x0, piece.x1)]
          : [piece.cx - piece.rx, piece.cx + piece.rx];
      const from = Math.max(first, Math.floor(low - reach));
      const to = Math.min(last, Math.floor(high + reach));
      for (let column = from; column <= to; column += 1) {
        const top = pieceTop(piece, column - reach, column + 1 + reach);
        const index = column - first;
        if (top !== null && top - reach < (tops[index] ?? Number.POSITIVE_INFINITY))
          tops[index] = top - reach;
      }
    }
  }
  return { start: first, tops };
}

/**
 * Two profiles of one stretch merged: each column takes the higher roof, as marks that show now and
 * marks that land elsewhere both need room.
 *
 * @param a - One profile.
 * @param b - The other.
 * @returns The merged profile over `a`'s stretch.
 */
export function higherRoof(a: RoofProfile, b: RoofProfile): RoofProfile {
  const tops = a.tops.map((top, index) => Math.min(top, topAt(b, a.start + index)));
  return { start: a.start, tops };
}

/**
 * A profile widened along x: each column takes the highest roof within `by` pixels of it. Marks
 * that slide along x by up to `by` stay under the widened roof of where they start and where they
 * land, wherever they pass between.
 *
 * @param profile - The profile.
 * @param by - How far the marks travel along x, in pixels.
 * @returns The widened profile over the same stretch.
 */
export function widenedRoof(profile: RoofProfile, by: number): RoofProfile {
  const reach = Math.ceil(by);
  if (reach <= 0) return profile;
  const { tops } = profile;
  const widened = tops.map((_, index) => {
    let top = Number.POSITIVE_INFINITY;
    const last = Math.min(tops.length - 1, index + reach);
    for (let column = Math.max(0, index - reach); column <= last; column += 1) {
      top = Math.min(top, tops[column] ?? Number.POSITIVE_INFINITY);
    }
    return top;
  });
  return { start: profile.start, tops: widened };
}

/**
 * A profile raised by a margin: each column's roof sits `by` pixels higher.
 *
 * @param profile - The profile.
 * @param by - The margin, in pixels.
 * @returns The raised profile over the same stretch.
 */
export function raisedRoof(profile: RoofProfile, by: number): RoofProfile {
  return by <= 0 ? profile : { start: profile.start, tops: profile.tops.map((top) => top - by) };
}

/**
 * The roof over a span: the smallest y any mark reaches in a column the span covers.
 *
 * @param profile - The roof profile.
 * @param start - The span's left edge.
 * @param end - The span's right edge, at or past `start`.
 * @returns The roof's y, or null when no mark reaches into the span.
 */
export function roofOver(profile: RoofProfile, start: number, end: number): number | null {
  let roof = Number.POSITIVE_INFINITY;
  const first = Math.floor(start);
  const last = Math.max(first, Math.ceil(end) - 1);
  for (let column = first; column <= last; column += 1) roof = Math.min(roof, topAt(profile, column));
  return roof === Number.POSITIVE_INFINITY ? null : roof;
}

/** A profile's roof in one column, or infinity outside its stretch. */
function topAt(profile: RoofProfile, column: number): number {
  return profile.tops[column - profile.start] ?? Number.POSITIVE_INFINITY;
}

/** The smallest y a piece reaches over [a, b], or null when it misses the span. */
function pieceTop(piece: MarkPiece, a: number, b: number): number | null {
  if (piece.kind === "ellipse") {
    const { cx, cy, rx, ry } = piece;
    if (cx + rx < a || cx - rx > b) return null;
    const off = cx < a ? a - cx : cx > b ? cx - b : 0;
    return cy - ry * Math.sqrt(Math.max(0, 1 - (off / rx) ** 2));
  }
  const { x0, y0, x1, y1 } = piece;
  const lo = Math.max(a, Math.min(x0, x1));
  const hi = Math.min(b, Math.max(x0, x1));
  if (lo > hi) return null;
  if (x0 === x1) return Math.min(y0, y1);
  const at = (x: number): number => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  return Math.min(at(lo), at(hi));
}
