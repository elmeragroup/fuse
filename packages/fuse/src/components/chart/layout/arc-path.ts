/**
 * The polar path writers. Each turns numbers in degrees and in the caller's radius unit into SVG
 * path data through d3-shape, which takes radians, and keeps `PATH_DIGITS` digits, so the server's
 * markup and the loop's last frame write the same string. A slice and a clock wedge are d3 arcs, a
 * ring is a stroked centre-line track, and a radar or clock curve is a radial line or area.
 */
import { arc as d3Arc, areaRadial, curveLinear, curveLinearClosed, lineRadial } from "d3-shape";

import type { Sweep } from "./polar-angle";
import { polarPoint, toRadians } from "./polar-angle";
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
function generatorOf(spec: ArcSpec) {
  return d3Arc<D3ArcInput>()
    .digits(PATH_DIGITS)
    .cornerRadius(spec.cornerRadius ?? 0)
    .padRadius(spec.padRadius ?? null);
}

/** One spec as d3's arc reads it. */
function inputOf(spec: ArcSpec): D3ArcInput {
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
  if (sweep.width >= 360) {
    const half = sweep.start + 180 * sweep.direction;
    return `M${point(sweep.start)}A${r},${r} 0 0 ${clockwise} ${point(half)}A${r},${r} 0 0 ${clockwise} ${point(sweep.end)}`;
  }
  const large = sweep.width > 180 ? 1 : 0;
  return `M${point(sweep.start)}A${r},${r} 0 ${large} ${clockwise} ${point(sweep.end)}`;
}

/** One vertex of a radial line, in degrees and the caller's radius unit. */
export type RadialVertex = { readonly angle: number; readonly radius: number };

/**
 * A radial line through its vertices, as d3's `lineRadial` draws it, closed back to its first vertex
 * when `closed` says so. A null vertex breaks the line.
 *
 * @param vertices - The vertices in order, null where a reading is missing.
 * @param ends - "closed" joins the last vertex to the first, "open" leaves them apart.
 * @returns The path data, empty when no two adjacent vertices draw.
 */
export function radialLinePath(vertices: readonly (RadialVertex | null)[], ends: "closed" | "open"): string {
  return (
    lineRadial<RadialVertex | null>()
      .digits(PATH_DIGITS)
      .curve(ends === "closed" ? curveLinearClosed : curveLinear)
      .defined((vertex) => vertex !== null)
      .angle((vertex) => toRadians(vertex?.angle ?? 0))
      .radius((vertex) => vertex?.radius ?? 0)(vertices) ?? ""
  );
}

/** One vertex of a radial area: its angle and the two radii it spans. */
export type RadialBand = { readonly angle: number; readonly inner: number; readonly outer: number };

/**
 * A radial area between two radii, as d3's `areaRadial` draws it with linear edges. A null vertex
 * breaks the area.
 *
 * @param vertices - The vertices in order, null where a reading is missing.
 * @returns The path data.
 */
export function radialAreaPath(vertices: readonly (RadialBand | null)[]): string {
  return (
    areaRadial<RadialBand | null>()
      .digits(PATH_DIGITS)
      .curve(curveLinear)
      .defined((vertex) => vertex !== null)
      .angle((vertex) => toRadians(vertex?.angle ?? 0))
      .innerRadius((vertex) => vertex?.inner ?? 0)
      .outerRadius((vertex) => vertex?.outer ?? 0)(vertices) ?? ""
  );
}
