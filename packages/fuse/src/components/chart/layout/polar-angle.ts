/**
 * The polar angle convention of CONTRACT section 8.5, which every polar family draws and picks in.
 * Angles are degrees from 12 o'clock, and positive angles run clockwise, d3-shape's frame in
 * degrees. A point at angle a and radius r sits at `(r·sin a, −r·cos a)` from the centre, in screen
 * coordinates whose y grows downward. Degrees turn into radians only at a d3-shape call.
 */
import { ChartCompositionError } from "./errors";

/** A point in screen coordinates from the centre, x right and y down. */
export type PolarPoint = { readonly x: number; readonly y: number };

/**
 * A sweep as d3's pie reads its angles: it starts at `start`, runs `width` degrees in `direction`,
 * and never runs past one turn.
 */
export type Sweep = {
  /** The start angle in degrees. */
  readonly start: number;
  /** The end angle in degrees, at most one turn from the start. */
  readonly end: number;
  /** The sweep's width in degrees, 0 to 360. */
  readonly width: number;
  /** 1 for a clockwise sweep, −1 for a counter-clockwise one, whose end lies below its start. */
  readonly direction: 1 | -1;
};

/** A box in units of the outer radius, from the centre, x right and y down. */
export type SweepBox = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** Radians per degree. */
const RADIANS = Math.PI / 180;

/**
 * Degrees as radians, for a d3-shape call.
 *
 * @param degrees - An angle in degrees.
 * @returns The angle in radians.
 */
export function toRadians(degrees: number): number {
  return degrees * RADIANS;
}

/**
 * Radians as degrees, for a d3-shape result.
 *
 * @param radians - An angle in radians.
 * @returns The angle in degrees.
 */
export function toDegrees(radians: number): number {
  return radians / RADIANS;
}

/**
 * The point at an angle and a radius from the centre.
 *
 * @param angle - Degrees from 12 o'clock, clockwise.
 * @param radius - The distance from the centre.
 * @returns The point, x right and y down.
 */
export function polarPoint(angle: number, radius: number): PolarPoint {
  const a = toRadians(angle);
  return { x: radius * Math.sin(a), y: -radius * Math.cos(a) };
}

/**
 * The sweep between two angles. A sweep wider than one turn clamps to one turn, and an end below
 * the start sweeps counter-clockwise, both as d3's pie reads its angles.
 *
 * @param start - The start angle in degrees.
 * @param end - The end angle in degrees.
 * @returns The sweep.
 */
export function sweepOf(start: number, end: number): Sweep {
  const span = Math.min(360, Math.max(-360, end - start));
  return { start, end: start + span, width: Math.abs(span), direction: span < 0 ? -1 : 1 };
}

/**
 * The sweep between two angles a Root's props name, as `sweepOf` reads them.
 *
 * @param part - The Root, which the error names.
 * @param start - `startAngle`.
 * @param end - `endAngle`.
 * @returns The sweep.
 * @throws {ChartCompositionError} `invalid-sweep` when either angle is not a finite number.
 */
export function parseSweep(part: string, start: number, end: number): Sweep {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new ChartCompositionError(
      part,
      "invalid-sweep",
      `received startAngle ${String(start)} and endAngle ${String(end)}. Pass finite numbers of degrees.`
    );
  }
  return sweepOf(start, end);
}

/**
 * An angle in degrees turned into `[0, 360)`, so −90 reads 270 and 450 reads 90.
 *
 * @param angle - Degrees, any number of turns either way.
 * @returns The same direction within one turn.
 */
export function turnOf(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * The angle of a pointer offset from the centre, normalised to `[0, 360)`. The exact centre reads 0,
 * because `atan2(0, −0)` is π and would read 180.
 *
 * @param dx - The offset to the right, in any unit.
 * @param dy - The offset downward, in the same unit.
 * @returns Degrees from 12 o'clock, clockwise.
 */
export function pointerAngle(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const angle = toDegrees(Math.atan2(dx, -dy));
  const normal = angle < 0 ? angle + 360 : angle;
  // A tiny negative angle rounds up to 360 in floating point, which lies outside the range.
  return normal >= 360 ? 0 : normal;
}

/**
 * How far an angle lies into a sweep, measured from the sweep's start in the sweep's own direction,
 * so a −135 to 135 gauge and a counter-clockwise sweep need no special case.
 *
 * @param angle - Degrees, in any turn.
 * @param sweep - The sweep.
 * @returns The offset in degrees, 0 to the sweep's width, or null when the angle lies outside it.
 */
export function angleInSweep(angle: number, sweep: Sweep): number | null {
  const raw = (angle - sweep.start) * sweep.direction;
  const offset = turnOf(raw);
  // A full turn holds every angle, and its own start at its end too.
  if (sweep.width >= 360) return offset;
  return offset <= sweep.width ? offset : null;
}

/**
 * The tight box around a sweep's outer arc and its centre, in units of the outer radius, so a
 * semicircle gets a 2:1 cell and a full circle a square one. The box always holds the centre,
 * which a pie's slices and a gauge's hub reach, so its aspect ratio is a pure function of the
 * angles and the server's markup is final at any width.
 *
 * @param sweep - The sweep.
 * @returns The box.
 */
export function sweepBox(sweep: Sweep): SweepBox {
  const low = Math.min(sweep.start, sweep.end);
  const high = Math.max(sweep.start, sweep.end);
  // The quarter turns walk from the sweep's start brought into one turn, so a start of any size, as
  // far out as a float holds, takes at most five steps. A sweep that is not finite, which a Root
  // refuses before it builds one, boxes a whole turn.
  const finite = Number.isFinite(low) && Number.isFinite(high);
  const from = finite ? turnOf(low) : 0;
  const to = from + (finite ? Math.min(360, high - low) : 360);
  const points: PolarPoint[] = [{ x: 0, y: 0 }];
  if (finite) points.push(polarPoint(low, 1), polarPoint(high, 1));
  // Every quarter turn inside the sweep is an extreme of the arc.
  for (let quarter = Math.ceil(from / 90); quarter * 90 <= to; quarter += 1) {
    points.push(polarPoint(quarter * 90, 1));
  }
  // Rounding to 12 digits lets sin(180°) read 0, so the box has no float sliver past the centre.
  const tidy = (value: number) => Math.round(value * 1e12) / 1e12 + 0;
  return {
    left: tidy(Math.min(...points.map(({ x }) => x))),
    top: tidy(Math.min(...points.map(({ y }) => y))),
    right: tidy(Math.max(...points.map(({ x }) => x))),
    bottom: tidy(Math.max(...points.map(({ y }) => y))),
  };
}

/**
 * The viewBox of a sweep's box, which every polar layer draws in.
 *
 * @param box - The sweep's box, in units of the outer radius.
 * @returns The viewBox attribute.
 */
export function viewBoxOf(box: SweepBox): string {
  return `${String(box.left)} ${String(box.top)} ${String(box.right - box.left)} ${String(box.bottom - box.top)}`;
}

/**
 * A point's place in the cell, as percentages of the sweep's box.
 *
 * @param box - The sweep's box, in units of the outer radius.
 * @param x - The point's x, in units of the outer radius.
 * @param y - The point's y, down, in the same unit.
 * @returns The left and top percentages, to 3 decimals.
 */
export function boxPercent(box: SweepBox, x: number, y: number): readonly [string, string] {
  const left = ((x - box.left) / (box.right - box.left)) * 100;
  const top = ((y - box.top) / (box.bottom - box.top)) * 100;
  return [`${left.toFixed(3)}%`, `${top.toFixed(3)}%`];
}
