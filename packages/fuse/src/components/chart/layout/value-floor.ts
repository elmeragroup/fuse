/**
 * The value-axis pixel floor's arithmetic, which a cartesian plot and a clock dial share: a body of
 * finite non-zero length that snaps to nothing keeps one device pixel, grown from its base away
 * from zero, as long as that pixel stays inside the drawn extent. It reads no frame, so a dial
 * floors its columns without the cartesian plot's geometry.
 */

/** How far from a bound, in CSS pixels, a snapped edge still counts as on it. */
const TIE = 1e-6;

/**
 * Which way a body's floor grows from its base: toward the start of the value axis, toward its end,
 * or not at all, as a stack's inner segment takes it.
 */
export type FloorGrowth = "start" | "end" | "none";

/**
 * A body's value-axis span with the floor: its snapped span as it is, or, when a body of finite
 * non-zero length snapped to nothing, one device pixel on from its base the way `growth` names. A
 * kept pixel that would leave `[0, limit]` stays out, and the body stays flat.
 *
 * @param from - Where the snapped span starts, CSS pixels.
 * @param to - Where it ends.
 * @param length - The body's unsnapped length.
 * @param growth - Which way the floor grows from the base.
 * @param dpr - Device pixels per CSS pixel.
 * @param limit - The drawn extent's far edge along the value axis, snapped, CSS pixels.
 * @returns The span with the floor.
 */
export function valueFloor(
  from: number,
  to: number,
  length: number,
  growth: FloorGrowth,
  dpr: number,
  limit: number
): readonly [number, number] {
  if (growth === "none" || to > from || !(length > 0) || !Number.isFinite(length)) return [from, to];
  const device = 1 / dpr;
  const kept: readonly [number, number] = growth === "start" ? [from - device, from] : [to, to + device];
  // Snapped edges are differences of page pixels, off by float error, so the bounds allow it.
  const inside = kept[0] >= -TIE && kept[1] <= limit + TIE;
  return inside ? kept : [from, to];
}
