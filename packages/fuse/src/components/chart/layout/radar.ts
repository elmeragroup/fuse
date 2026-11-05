/**
 * The radar's layout: the radius domain, where each spoke and vertex sits, the zero polygon, the
 * per-edge quadrilaterals an Area fills, and the spoke and series a pointer picks. CONTRACT section
 * 8.4 gives the domain and the negatives: the radius is a value axis, the centre is the domain's
 * minimum, and a fill always encodes distance from 0.
 */
import { linearScale, scaleTicks } from "./linear-scale";
import { polarPoint } from "./polar-angle";
import type { PolarPoint } from "./polar-angle";
import { pathNumber } from "./rounding";
import { valueDomain } from "./value-domain";
import type { ValueDomain } from "./value-domain";

/** Every value axis aims for 5 ticks, the radius axis too. */
const TICK_COUNT = 5;

/**
 * The radius domain. It runs from 0, or from the niced minimum when a value lies below 0, to the
 * niced data maximum, with 5 ticks. An explicit `max` at or above the data's maximum ends the
 * domain at `max`, and when a value passes `max` the niced data maximum wins, so no reading is
 * clamped.
 *
 * @param values - Every drawn value of every series. Non-finite values are skipped.
 * @param max - Root's `max`, or undefined.
 * @returns The domain and its ticks.
 */
export function radarDomain(values: Iterable<number>, max: number | undefined): ValueDomain {
  const finite = [...values].filter((value) => Number.isFinite(value));
  const niced = valueDomain({ values: finite, baseline: "zero" });
  const top = Math.max(0, ...finite);
  if (max === undefined || !Number.isFinite(max) || max < top || max <= niced.domain[0]) return niced;
  const domain: readonly [number, number] = [niced.domain[0], max];
  return { domain, ticks: scaleTicks(linearScale(domain, [0, 1]), TICK_COUNT).map((tick) => tick + 0) };
}

/**
 * The radius of a value: the domain's minimum sits at the centre and its maximum at `outer`.
 *
 * @param domain - The radius domain.
 * @param outer - The outer radius.
 * @returns The map from a value to its radius.
 */
export function radarRadius(domain: readonly [number, number], outer: number): (value: number) => number {
  const [lo, hi] = domain;
  const span = hi - lo;
  return (value) => (span === 0 ? 0 : (outer * (value - lo)) / span);
}

/**
 * The angle of spoke i of n: spokes run clockwise from 12 o'clock in data order.
 *
 * @param index - The spoke's index.
 * @param count - The spoke count.
 * @returns Degrees from 12 o'clock.
 */
export function spokeAngle(index: number, count: number): number {
  return count === 0 ? 0 : (360 * index) / count;
}

/**
 * Each spoke's vertex for one series.
 *
 * @param values - The series' value per spoke, null for a missing one.
 * @param radiusOf - The value-to-radius map.
 * @returns Each spoke's vertex, null for a missing value.
 */
export function radarVertices(
  values: readonly (number | null)[],
  radiusOf: (value: number) => number
): readonly (PolarPoint | null)[] {
  return values.map((value, index) =>
    value === null || !Number.isFinite(value)
      ? null
      : polarPoint(spokeAngle(index, values.length), radiusOf(value))
  );
}

/**
 * The zero polygon: the radius of 0 on every spoke, joined by straight edges.
 *
 * @param count - The spoke count.
 * @param zero - The radius of 0.
 * @returns Each spoke's point at that radius.
 */
export function zeroPolygon(count: number, zero: number): readonly PolarPoint[] {
  return Array.from({ length: count }, (_, index) => polarPoint(spokeAngle(index, count), zero));
}

/**
 * The quadrilaterals an Area fills, one per edge between two spokes that both hold a reading: the
 * zero point and the vertex on each spoke. Under `fill-rule: evenodd` an edge that crosses the zero
 * polygon fills both of its triangles, so the fill always reads distance from 0. A missing spoke
 * removes both edges beside it. Two spokes make one edge, and one spoke none.
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @param zero - The zero polygon.
 * @returns Each edge's four corners: zero and vertex on the first spoke, then vertex and zero on the next.
 */
export function radarQuads(
  vertices: readonly (PolarPoint | null)[],
  zero: readonly PolarPoint[]
): readonly (readonly PolarPoint[])[] {
  const count = vertices.length;
  const edges = count < 2 ? 0 : count === 2 ? 1 : count;
  const quads: PolarPoint[][] = [];
  for (let index = 0; index < edges; index += 1) {
    const next = (index + 1) % count;
    const a = vertices[index];
    const b = vertices[next];
    const za = zero[index];
    const zb = zero[next];
    if (
      a === null ||
      a === undefined ||
      b === null ||
      b === undefined ||
      za === undefined ||
      zb === undefined
    )
      continue;
    quads.push([za, a, b, zb]);
  }
  return quads;
}

/**
 * The path of polygons, each closed, with every coordinate through `pathNumber`.
 *
 * @param polygons - The polygons.
 * @returns The path data, empty for none.
 */
export function polygonsPath(polygons: readonly (readonly PolarPoint[])[]): string {
  return polygons
    .map(
      (points) =>
        `${points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${pathNumber(x)},${pathNumber(y)}`).join("")}Z`
    )
    .join("");
}

/**
 * The radar line: the polygon through every vertex when each spoke holds a reading, and otherwise
 * the runs between missing spokes, a run that crosses 12 o'clock drawn whole. A lone vertex draws
 * no line, since a dot draws it.
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @returns The path data.
 */
export function radarLinePath(vertices: readonly (PolarPoint | null)[]): string {
  const count = vertices.length;
  const at = (point: PolarPoint) => `${pathNumber(point.x)},${pathNumber(point.y)}`;
  const whole = vertices.filter((vertex): vertex is PolarPoint => vertex !== null);
  if (count >= 3 && whole.length === count) {
    return `${whole.map((vertex, index) => `${index === 0 ? "M" : "L"}${at(vertex)}`).join("")}Z`;
  }
  // Start right after a missing spoke, so a run that crosses the last spoke stays whole.
  const gap = vertices.findIndex((vertex) => vertex === null);
  const order = Array.from({ length: count }, (_, step) => (gap + 1 + step) % count);
  const runs: PolarPoint[][] = [];
  let run: PolarPoint[] = [];
  for (const index of order) {
    const vertex = vertices[index];
    if (vertex === null || vertex === undefined) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else {
      run.push(vertex);
    }
  }
  if (run.length > 1) runs.push(run);
  return runs
    .map((points) => points.map((point, index) => `${index === 0 ? "M" : "L"}${at(point)}`).join(""))
    .join("");
}

/**
 * The spoke nearest a pointer's angle, by angular distance, a tie going to the lower index, so the
 * exact centre, whose angle reads 0, picks spoke 0.
 *
 * @param angle - The pointer's angle, as `pointerAngle` gives it.
 * @param count - The spoke count, at least 1.
 * @returns The spoke's index.
 */
export function spokeAt(angle: number, count: number): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < count; index += 1) {
    const raw = Math.abs(angle - spokeAngle(index, count)) % 360;
    const gap = Math.min(raw, 360 - raw);
    if (gap < distance - 1e-9) {
      best = index;
      distance = gap;
    }
  }
  return best;
}

/**
 * The series whose drawn vertex on a spoke lies nearest a pointer, skipping a series with no
 * reading there, a tie going to the earlier config key.
 *
 * @param pointer - The pointer's point from the centre.
 * @param vertices - Each series' vertex on the spoke, null for a missing one, in config order.
 * @returns The series' index, or null when no series holds a reading there.
 */
export function nearestVertex(pointer: PolarPoint, vertices: readonly (PolarPoint | null)[]): number | null {
  let best: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  vertices.forEach((vertex, index) => {
    if (vertex === null) return;
    const gap = Math.hypot(vertex.x - pointer.x, vertex.y - pointer.y);
    if (gap < distance) {
      best = index;
      distance = gap;
    }
  });
  return best;
}
