/**
 * Where a polar tooltip rests (MOTION-REVIEW Fix R2). The popup sits in a side lane beside the dial,
 * outside the labels past the rim and inside the Root's figure, with its vertical centre on the
 * active ray's height at the rim. A ray right of 12 o'clock takes the right lane and a ray left of
 * it the left, and a popup keeps its lane until the ray is 20° past 12 or 6 o'clock on the other
 * side. When neither lane fits beside the dial, the popup sits below the labels. A pointer that
 * moves toward the open popup inside the triangle from its last plot position to the popup's near
 * edge keeps the active part, past the rim only (Q9).
 */
import type { PlaceSize } from "./tooltip-place";

/** A point in client pixels. */
export type LanePoint = { readonly x: number; readonly y: number };

/** A box in client pixels. */
export type LaneBox = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** The lanes a popup can take. */
export type LaneSide = "right" | "left" | "bottom";

/**
 * The dial in client pixels: its centre, its outer radius, and how far below the centre its drawing
 * ends, the radius for a full dial and 0 for a semicircle on its flat edge.
 */
export type LaneDial = { readonly centre: LanePoint; readonly radius: number; readonly bottom?: number };

/** Where a popup rests: the lane it takes, its box there, and the widest it may be in that lane. */
export type LaneRest = { readonly side: LaneSide; readonly box: LaneBox; readonly room: number };

/** The gap between the dial or its labels and the popup, in CSS pixels, the overlay's 8 px. */
export const LANE_GAP = 8;

/** How far past 12 or 6 o'clock, as a sine, a ray must turn before the popup changes lane: sin 20°. */
const SWITCH = Math.sin((20 * Math.PI) / 180);

/**
 * The side lane for a ray: right of 12 o'clock is right, left of it is left, and a half turn's tie
 * goes right. A popup already in a lane keeps it until the ray reaches 20° into the other half.
 *
 * @param angle - The ray's angle in degrees from 12 o'clock, clockwise.
 * @param current - The lane the popup is in, or null when it opens.
 * @returns The lane.
 */
export function laneSide(angle: number, current: "right" | "left" | null): "right" | "left" {
  const sine = Math.sin((angle * Math.PI) / 180);
  if (current === "right") return sine < -SWITCH ? "left" : "right";
  if (current === "left") return sine > SWITCH ? "right" : "left";
  return sine < -1e-9 ? "left" : "right";
}

/**
 * The height a side lane's popup centres on for a ray: the ray's rim point, clamped so the popup
 * stays inside its bounds.
 *
 * @param angle - The ray's angle in degrees.
 * @param dial - The dial.
 * @param height - The popup's height.
 * @param bounds - The box the popup stays inside.
 * @returns The popup's vertical centre, in client pixels.
 */
export function laneY(angle: number, dial: LaneDial, height: number, bounds: LaneBox): number {
  const y = dial.centre.y - dial.radius * Math.cos((angle * Math.PI) / 180);
  const low = bounds.top + height / 2;
  const high = bounds.bottom - height / 2;
  return high < low ? (low + high) / 2 : Math.min(high, Math.max(low, y));
}

/** The narrowest side lane a popup takes, in CSS pixels; a narrower lane sends it below the dial. */
export const LANE_MIN = 128;

/**
 * Where the popup rests for a ray: in its side lane when that lane holds `LANE_MIN` pixels inside
 * the bounds, else in the other side lane when that one does, else below the labels. The choice reads
 * the room, never the popup's own width, which changes with its text from step to step, so a lane
 * never flips for a longer label; the popup takes the lane's room as its widest. A side lane's inner
 * edge sits one gap outside the further of the rim and the labels, and the bottom lane's top one gap
 * below them, centred on the dial and never moved vertically.
 *
 * @param angle - The ray's angle in degrees.
 * @param side - The side lane `laneSide` chose.
 * @param dial - The dial.
 * @param labels - The union of the labels past the rim, or null for none.
 * @param size - The popup's size.
 * @param bounds - The box the popup stays inside, the Root's figure.
 * @returns The lane it rests in, its box, and the widest the popup may be there.
 */
export function laneRest(
  angle: number,
  side: "right" | "left",
  dial: LaneDial,
  labels: LaneBox | null,
  size: PlaceSize,
  bounds: LaneBox
): LaneRest {
  const { centre, radius } = dial;
  const right = Math.max(centre.x + radius, labels?.right ?? Number.NEGATIVE_INFINITY) + LANE_GAP;
  const left = Math.min(centre.x - radius, labels?.left ?? Number.POSITIVE_INFINITY) - LANE_GAP;
  const middle = laneY(angle, dial, size.height, bounds);
  const top = middle - size.height / 2;
  const rooms = { right: bounds.right - right, left: left - bounds.left };
  const lane = (at: "right" | "left"): LaneRest => {
    const room = rooms[at];
    const width = Math.min(size.width, room);
    const box =
      at === "right"
        ? { left: right, top, right: right + width, bottom: top + size.height }
        : { left: left - width, top, right: left, bottom: top + size.height };
    return { side: at, box, room };
  };
  const other = side === "right" ? "left" : "right";
  if (rooms[side] >= LANE_MIN) return lane(side);
  if (rooms[other] >= LANE_MIN) return lane(other);
  const below =
    Math.max(centre.y + (dial.bottom ?? radius), labels?.bottom ?? Number.NEGATIVE_INFINITY) + LANE_GAP;
  const room = bounds.right - bounds.left;
  const width = Math.min(size.width, room);
  const x = Math.min(bounds.right - width, Math.max(bounds.left, centre.x - width / 2));
  return {
    side: "bottom",
    box: { left: x, top: below, right: x + width, bottom: below + size.height },
    room,
  };
}

/**
 * Whether a point lies inside a triangle or on its edge, by the signs of its barycentric areas.
 *
 * @param point - The point.
 * @param a - A corner.
 * @param b - Another corner.
 * @param c - The third corner.
 * @returns True inside or on an edge.
 */
export function inTriangle(point: LanePoint, a: LanePoint, b: LanePoint, c: LanePoint): boolean {
  const cross = (p: LanePoint, q: LanePoint, r: LanePoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(a, b, point);
  const d2 = cross(b, c, point);
  const d3 = cross(c, a, point);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

/**
 * The near edge of a popup seen from a point: the two corners of the box's side that faces it.
 *
 * @param from - Where the pointer left the plot.
 * @param box - The popup's client box.
 * @returns The near edge's two ends.
 */
export function nearEdge(
  from: LanePoint,
  box: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
): readonly [LanePoint, LanePoint] {
  const dx = from.x < box.left ? box.left - from.x : from.x > box.right ? from.x - box.right : 0;
  const dy = from.y < box.top ? box.top - from.y : from.y > box.bottom ? from.y - box.bottom : 0;
  if (dx >= dy) {
    const x = from.x < box.left ? box.left : box.right;
    return [
      { x, y: box.top },
      { x, y: box.bottom },
    ];
  }
  const y = from.y < box.top ? box.top : box.bottom;
  return [
    { x: box.left, y },
    { x: box.right, y },
  ];
}
