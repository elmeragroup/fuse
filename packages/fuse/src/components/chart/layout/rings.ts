/**
 * The radial chart's rings: where each ring runs, the maximum each fills against, the band a
 * pointer picks it in, and the stroke that draws its value. CONTRACT section 8.4 gives the maxima:
 * rings run from the first row outermost to the last innermost, and a ring never laps.
 */
import { toDegrees } from "./polar-angle";

/** One ring's place, in the unit of the outer radius it was laid out in. */
export type RingBand = {
  /** The radius of the ring's centre line. */
  readonly radius: number;
  /** The ring's stroke width. */
  readonly width: number;
  /** Where the ring's pick band starts, at the middle of the gap inside it. */
  readonly inner: number;
  /** Where it ends, at the middle of the gap outside it. */
  readonly outer: number;
};

/** What the rings divide: the outer radius, the hole's share of it and the share of each band a ring fills. */
export type RingFrame = {
  readonly outer: number;
  /** The hole's radius as a share of the outer radius, 0.3 by default. */
  readonly innerRadius: number;
  /** The share of each ring's band its stroke fills, `--chart-ring-fill`, 0.7 by default. */
  readonly fill: number;
};

/**
 * Each ring's place. The rings split the band from the hole to the rim evenly, the first ring
 * outermost, and each draws a centred stroke of `fill` of its band, so a pick band reaches the
 * middle of the gaps on both sides.
 *
 * @param count - The ring count.
 * @param frame - The outer radius, the hole and the fill.
 * @returns Each ring's place, first ring first.
 */
export function ringBands(count: number, frame: RingFrame): readonly RingBand[] {
  const hole = frame.innerRadius * frame.outer;
  const band = (frame.outer - hole) / Math.max(1, count);
  return Array.from({ length: count }, (_, index): RingBand => {
    const outer = frame.outer - index * band;
    const inner = outer - band;
    return { radius: (outer + inner) / 2, width: band * frame.fill, inner, outer };
  });
}

/**
 * The ring a pointer's distance from the centre falls in, by radius band.
 *
 * @param distance - The pointer's distance from the centre, in the bands' unit.
 * @param bands - Each ring's place.
 * @returns The ring's index, or null inside the hole and past the rim.
 */
export function ringAt(distance: number, bands: readonly RingBand[]): number | null {
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    if (band !== undefined && distance >= band.inner && distance <= band.outer) return index;
  }
  return null;
}

/** One ring's value against its maximum. */
export type RingFill = {
  /** The maximum it fills against, or null when it has none above 0. */
  readonly max: number | null;
  /** The value over its maximum, unclamped, or null for a missing value or no maximum. */
  readonly share: number | null;
  /** Whether an explicit maximum lies below the value. */
  readonly over: boolean;
};

/**
 * What each ring fills against: the largest value, Root's `max` for every ring, or each row's own
 * maximum from `maxKey`.
 */
export type RingMaxima =
  | { readonly kind: "largest" }
  | { readonly kind: "root"; readonly max: number }
  | { readonly kind: "rows"; readonly maxima: readonly (number | null)[] };

/**
 * Each ring's fill. Under "largest" every ring fills against the largest value, so the largest ring
 * fills the sweep. Under an explicit maximum, a value above it is over and draws the full sweep.
 *
 * @param values - Each ring's value, or null for a missing one.
 * @param maxima - What each ring fills against.
 * @returns Each ring's fill.
 */
export function ringFills(values: readonly (number | null)[], maxima: RingMaxima): readonly RingFill[] {
  const largest = Math.max(
    0,
    ...values.map((value) => (value !== null && Number.isFinite(value) ? value : 0))
  );
  return values.map((value, index): RingFill => {
    const own =
      maxima.kind === "largest"
        ? largest
        : maxima.kind === "root"
          ? maxima.max
          : (maxima.maxima[index] ?? null);
    const max = own !== null && Number.isFinite(own) && own > 0 ? own : null;
    if (max === null || value === null || !Number.isFinite(value)) return { max, share: null, over: false };
    return { max, share: value / max, over: maxima.kind !== "largest" && value > max };
  });
}

/**
 * The angle a ring's value fills: its share of the sweep, never past the sweep, so a ring never
 * laps itself.
 *
 * @param fill - The ring's fill.
 * @param width - The sweep's width in degrees.
 * @returns The filled angle in degrees, 0 for a missing or non-positive value.
 */
export function ringAngle(fill: RingFill, width: number): number {
  if (fill.share === null || !(fill.share > 0)) return 0;
  return width * Math.min(1, fill.share);
}

/**
 * How a ring's stroke draws its value along a centre-line track whose `pathLength` is the sweep's
 * width in degrees: the dash's start and length in those units, and its cap.
 */
export type RingStroke = {
  /** Where the dash starts along the track, in degrees from the sweep's start. */
  readonly start: number;
  /** The dash's length in degrees. */
  readonly length: number;
  /** "round" caps sit inside the value's angle, "butt" draws a short arc at its true length. */
  readonly cap: "round" | "butt" | "none";
};

/** What a ring's stroke measures in: its centre line's radius, its stroke width and the device pixel ratio. */
export type RingPixels = {
  /** The centre line's radius in CSS pixels. */
  readonly radius: number;
  /** The stroke width in CSS pixels. */
  readonly width: number;
  /** Device pixels per CSS pixel. */
  readonly dpr: number;
};

/**
 * A ring's stroke for a filled angle. Round caps sit inside the value's angle, so the drawn extent
 * equals it. An arc shorter than its stroke width draws butt caps at its true length. A non-zero
 * value keeps one device pixel of arc along its centre line, and 0 draws nothing.
 *
 * @param angle - The filled angle in degrees, as `ringAngle` gives it.
 * @param pixels - The ring's radius, stroke width and the device pixel ratio.
 * @returns The stroke.
 */
export function ringStroke(angle: number, pixels: RingPixels): RingStroke {
  if (!(angle > 0) || !(pixels.radius > 0)) return { start: 0, length: 0, cap: "none" };
  const drawn = Math.max(angle, leastArc(pixels.radius, pixels.dpr));
  const cap = toDegrees(pixels.width / 2 / pixels.radius);
  if (drawn <= 2 * cap) return { start: 0, length: drawn, cap: "butt" };
  return { start: cap, length: drawn - 2 * cap, cap: "round" };
}

/**
 * The angle one device pixel of arc spans at a radius, the least a value above 0 draws, so a ring's
 * stroke and a gauge's band never vanish for a value just above their start.
 *
 * @param radius - The radius in CSS pixels.
 * @param dpr - Device pixels per CSS pixel.
 * @returns The angle in degrees, or 0 where nothing measured the radius or the ratio.
 */
export function leastArc(radius: number, dpr: number): number {
  return radius > 0 && dpr > 0 ? toDegrees(1 / dpr / radius) : 0;
}

/** How many whole marks a dotted ring and a notched gauge track hold over their sweep. */
export const DIAL_MARKS = 40;

/**
 * How many of a dial's evenly spaced marks an offset lights, a dotted ring's dots or a gauge's
 * notches: its share of the sweep in whole marks, rounded to the nearest, and at least one for any
 * offset above 0, so a value just above the start still reads.
 *
 * @param offset - The offset in degrees, as the sweep shows it this frame.
 * @param width - The sweep's width in degrees.
 * @param count - The marks on the sweep.
 * @returns The lit count, 0 to `count`.
 */
export function litMarks(offset: number, width: number, count: number): number {
  if (!(offset > 0) || !(width > 0)) return 0;
  return Math.min(count, Math.max(1, Math.round((count * offset) / width)));
}
