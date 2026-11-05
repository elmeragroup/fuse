/**
 * Where a polar tooltip rests and how it travels (D6, D7). The popup's centre sits on the active
 * ray, just outside the rim, at any angle, and `data-side` names the side nearest the ray. A step
 * glides the popup round the dial on an orbit, the short way, and spirals between two radii, so it
 * never crosses the centre. A pointer that moves toward the open popup inside the triangle from its
 * last plot position to the popup's near edge keeps the active part (Q9).
 */
import { polarPoint } from "./polar-angle";
import type { PlaceSize, PopupPlace } from "./tooltip-place";

/** A point in client pixels. */
export type OrbitPoint = { readonly x: number; readonly y: number };

/** The sides a popup can take. */
export type PopupSide = "top" | "right" | "bottom" | "left";

/** The most degrees an orbit turns between two keyframes, the Motion table's 10°. */
export const ORBIT_STEP = 10;

/**
 * The side nearest a ray: `top` within 45° of 12 o'clock, then `right`, `bottom` and `left`.
 *
 * @param angle - The ray's angle in degrees from 12 o'clock, clockwise.
 * @returns The side.
 */
export function nearestSide(angle: number): PopupSide {
  const normal = ((angle % 360) + 360) % 360;
  if (normal < 45 || normal >= 315) return "top";
  if (normal < 135) return "right";
  if (normal < 225) return "bottom";
  return "left";
}

/**
 * The popup's centre on a ray: far enough out that the whole box lies past the rim and its gap. The
 * box's half-extent along the ray, its support there, is how far its nearest edge reaches back.
 *
 * @param angle - The ray's angle in degrees.
 * @param rim - The rim's radius, in client pixels.
 * @param gap - The gap between the rim and the popup, in client pixels.
 * @param size - The popup's size.
 * @returns The centre's offset from the dial's centre, in client pixels.
 */
export function rayCentre(angle: number, rim: number, gap: number, size: PlaceSize): OrbitPoint {
  const unit = polarPoint(angle, 1);
  const support = (Math.abs(unit.x) * size.width) / 2 + (Math.abs(unit.y) * size.height) / 2;
  const distance = rim + gap + support;
  return { x: unit.x * distance, y: unit.y * distance };
}

/** The angle of a client point around a centre, in degrees from 12 o'clock, clockwise. */
function angleOf(point: OrbitPoint, centre: OrbitPoint): number {
  return (Math.atan2(point.x - centre.x, centre.y - point.y) * 180) / Math.PI;
}

/**
 * The turns of an orbit from one popup place to another round a dial's centre: the popup's centre
 * moves the short way round, with a keyframe every `ORBIT_STEP` degrees or less, and its distance
 * from the centre moves evenly from one radius to the other, so it spirals and never crosses the
 * centre. A popup at the dial's very centre has no angle, so the glide runs straight.
 *
 * @param from - Where the popup starts, its left and bottom edges in client pixels.
 * @param to - Where it rests.
 * @param size - The popup's size.
 * @param centre - The dial's centre in client pixels.
 * @returns The places in order, the start and the end included.
 */
export function orbitTurns(
  from: PopupPlace,
  to: PopupPlace,
  size: PlaceSize,
  centre: OrbitPoint
): PopupPlace[] {
  const start = { x: from.left + size.width / 2, y: from.bottom - size.height / 2 };
  const end = { x: to.left + size.width / 2, y: to.bottom - size.height / 2 };
  const r0 = Math.hypot(start.x - centre.x, start.y - centre.y);
  const r1 = Math.hypot(end.x - centre.x, end.y - centre.y);
  if (r0 < 1e-9 || r1 < 1e-9) return [from, to];
  const a0 = angleOf(start, centre);
  const turn = ((((angleOf(end, centre) - a0) % 360) + 540) % 360) - 180;
  const steps = Math.max(1, Math.ceil(Math.abs(turn) / ORBIT_STEP));
  const places: PopupPlace[] = [from];
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const point = polarPoint(a0 + turn * t, r0 + (r1 - r0) * t);
    places.push({ left: centre.x + point.x - size.width / 2, bottom: centre.y + point.y + size.height / 2 });
  }
  places.push(to);
  return places;
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
export function inTriangle(point: OrbitPoint, a: OrbitPoint, b: OrbitPoint, c: OrbitPoint): boolean {
  const cross = (p: OrbitPoint, q: OrbitPoint, r: OrbitPoint) =>
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
  from: OrbitPoint,
  box: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
): readonly [OrbitPoint, OrbitPoint] {
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
