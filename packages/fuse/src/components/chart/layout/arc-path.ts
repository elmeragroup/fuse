/**
 * The polar path writers. Each turns numbers in degrees and in the caller's radius unit into SVG
 * path data through d3-shape, which takes radians, and keeps `PATH_DIGITS` digits, so the server's
 * markup and the loop's last frame write the same string. A slice and a clock wedge are d3 arcs, and
 * a ring is a stroked centre-line track. The radar's and the clock's curves have their own writers,
 * in `radar.ts` and `clock-path.ts`.
 */
import { arc as d3Arc } from "d3-shape";

import type { Sweep } from "./polar-angle";
import { isFullTurn, polarPoint, toRadians } from "./polar-angle";
import { PATH_DIGITS, pathNumber } from "./rounding";

/** One arc: a sector of an annulus, in degrees and the caller's radius unit. */
export type ArcSpec = {
  readonly innerRadius: number;
  readonly outerRadius: number;
  /** Degrees from 12 o'clock, clockwise. */
  readonly startAngle: number;
  readonly endAngle: number;
  /** Degrees d3 takes out of the arc's two seams, 0 by default. */
  readonly padAngle?: number;
  /** The radius the pad's width is measured at, d3's `sqrt(inner² + outer²)` by default. */
  readonly padRadius?: number;
  /** The corner radius, clamped as d3 clamps it, 0 by default. */
  readonly cornerRadius?: number;
};

/** The d3 arc input every writer builds, in radians. */
type D3ArcInput = {
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
};

/** The d3 arc generator for one spec, its corner and pad radius set. */
function generatorOf(spec: Pick<ArcSpec, "cornerRadius" | "padRadius">) {
  return d3Arc<D3ArcInput>()
    .digits(PATH_DIGITS)
    .cornerRadius(spec.cornerRadius ?? 0)
    .padRadius(spec.padRadius ?? null);
}

/** One spec as d3's arc reads it. */
function inputOf(spec: Omit<ArcSpec, "cornerRadius" | "padRadius">): D3ArcInput {
  return {
    innerRadius: spec.innerRadius,
    outerRadius: spec.outerRadius,
    startAngle: toRadians(spec.startAngle),
    endAngle: toRadians(spec.endAngle),
    padAngle: toRadians(spec.padAngle ?? 0),
  };
}

/**
 * The path of one arc, as d3's arc draws it, with its corner clamp and pad.
 *
 * @param spec - The arc.
 * @returns The path data.
 */
export function arcPath(spec: ArcSpec): string {
  return generatorOf(spec)(inputOf(spec)) ?? "";
}

/**
 * One generator for many arcs that share a corner radius and a pad radius, such as a clock's
 * wedges in one frame, which draws each arc as `arcPath` does.
 *
 * @param shared - The corner radius and the pad radius every arc takes.
 * @returns A writer of each arc's path data.
 */
export function arcWriter(
  shared: Pick<ArcSpec, "cornerRadius" | "padRadius">
): (spec: Omit<ArcSpec, "cornerRadius" | "padRadius">) => string {
  const generator = generatorOf(shared);
  return (spec) => generator(inputOf(spec)) ?? "";
}

/**
 * The centroid of one arc, d3's: the middle of its radii on the middle of its angles, where an
 * inside label sits.
 *
 * @param spec - The arc.
 * @returns The centroid's x and y from the centre.
 */
export function arcCentroid(spec: ArcSpec): readonly [number, number] {
  return generatorOf(spec).centroid(inputOf(spec));
}

/**
 * A ring's centre-line track over a sweep, the path a ring strokes its value along. A full turn
 * draws as two half arcs, because one arc command cannot close a circle.
 *
 * @param radius - The centre line's radius.
 * @param sweep - The sweep.
 * @returns The path data.
 */
export function ringTrack(radius: number, sweep: Sweep): string {
  const point = (angle: number) => {
    const { x, y } = polarPoint(angle, radius);
    return `${pathNumber(x)},${pathNumber(y)}`;
  };
  const r = pathNumber(radius);
  const clockwise = sweep.direction === 1 ? 1 : 0;
  if (isFullTurn(sweep)) {
    const half = sweep.start + 180 * sweep.direction;
    return `M${point(sweep.start)}A${r},${r} 0 0 ${clockwise} ${point(half)}A${r},${r} 0 0 ${clockwise} ${point(sweep.end)}`;
  }
  const large = sweep.width > 180 ? 1 : 0;
  return `M${point(sweep.start)}A${r},${r} 0 ${large} ${clockwise} ${point(sweep.end)}`;
}
