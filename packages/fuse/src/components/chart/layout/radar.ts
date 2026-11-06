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
 * Where the ray at an angle meets a series' polygon: on the straight edge between the present
 * vertices either side of the angle, skipping a missing vertex as a ride between spokes does. An
 * angle on a present vertex's spoke lands on that vertex. The active dot rides here, so it stays on
 * the polygon however far the angle has turned between spokes.
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @param angle - The angle in degrees from 12 o'clock, in any turn.
 * @returns The point, or null when no vertex is present.
 */
export function edgePoint(vertices: readonly (PolarPoint | null)[], angle: number): PolarPoint | null {
  const count = vertices.length;
  if (count === 0) return null;
  const step = 360 / count;
  const turned = ((angle % 360) + 360) % 360;
  const below = Math.floor(turned / step + 1e-9) % count;
  // The present vertex at or before the angle, and the next present one after it.
  let before = below;
  while (vertices[before] == null) {
    before = (before - 1 + count) % count;
    if (before === below) return null;
  }
  let after = (below + 1) % count;
  while (vertices[after] == null) after = (after + 1) % count;
  const a = vertices[before];
  const b = vertices[after];
  if (a == null || b == null) return null;
  if (Math.abs(turned - spokeAngle(before, count)) < 1e-9 || before === after) return a;
  const radians = (turned * Math.PI) / 180;
  const ray = { x: Math.sin(radians), y: -Math.cos(radians) };
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const across = ray.x * edge.y - ray.y * edge.x;
  if (Math.abs(across) < 1e-12) return a;
  const reach = (a.x * edge.y - a.y * edge.x) / across;
  return { x: ray.x * reach, y: ray.y * reach };
}

/** A series' drawing split by quality (R5): the plain and the marked parts, each one path. */
export type RadarSplit = { readonly plain: string; readonly marked: string };

/** The edges a ring of n spokes draws: n closing edges from 3 spokes, one for 2, none for 1. */
function edgeCount(count: number): number {
  return count < 2 ? 0 : count === 2 ? 1 : count;
}

/**
 * The Line's edges, split by quality (R5): an edge that touches an estimated spoke is marked, and
 * dashes, and one that touches a missing spoke draws nothing. Consecutive edges of one kind join
 * into one run, and a ring whose every edge is plain, or every edge marked, closes.
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @param marked - Whether each spoke's reading is estimated.
 * @returns The plain runs' path and the marked runs' path, each empty for none.
 */
export function radarEdges(vertices: readonly (PolarPoint | null)[], marked: readonly boolean[]): RadarSplit {
  const count = vertices.length;
  const edges = edgeCount(count);
  const kinds = Array.from({ length: edges }, (_, index): "plain" | "marked" | null => {
    const next = (index + 1) % count;
    if (vertices[index] === null || vertices[next] === null) return null;
    return marked[index] === true || marked[next] === true ? "marked" : "plain";
  });
  const at = (index: number): string => {
    const point = vertices[index % count];
    return point === null || point === undefined ? "" : `${pathNumber(point.x)},${pathNumber(point.y)}`;
  };
  const paths = { plain: "", marked: "" };
  const [first] = kinds;
  if (first !== undefined && first !== null && edges === count && kinds.every((kind) => kind === first)) {
    paths[first] =
      `${Array.from({ length: count }, (_, index) => `${index === 0 ? "M" : "L"}${at(index)}`).join("")}Z`;
    return paths;
  }
  // Start at an edge whose kind differs from the one before it, so no run is cut at 12 o'clock.
  const start =
    edges === count
      ? Math.max(
          0,
          kinds.findIndex((kind, index) => kind !== kinds.at(index - 1))
        )
      : 0;
  // Each run joins consecutive edges of one kind, from its first edge to its last.
  const runs: { kind: "plain" | "marked"; from: number; to: number }[] = [];
  for (let step = 0; step < edges; step += 1) {
    const index = start + step;
    const kind = kinds[index % edges] ?? null;
    if (kind === null) continue;
    const last = runs.at(-1);
    if (last?.kind === kind && last.to === index - 1) last.to = index;
    else runs.push({ kind, from: index, to: index });
  }
  for (const { kind, from, to } of runs) {
    paths[kind] += Array.from(
      { length: to - from + 2 },
      (_, step) => `${step === 0 ? "M" : "L"}${at(from + step)}`
    ).join("");
  }
  return paths;
}

/**
 * The Area's quadrilaterals, split by quality (R5): a quadrilateral beside an estimated spoke is
 * marked, and hatches. A missing spoke removes both beside it, as `radarQuads` does.
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @param zero - The zero polygon.
 * @param marked - Whether each spoke's reading is estimated.
 * @returns The plain quadrilaterals' path and the marked ones', each empty for none.
 */
export function radarAreas(
  vertices: readonly (PolarPoint | null)[],
  zero: readonly PolarPoint[],
  marked: readonly boolean[]
): RadarSplit {
  const count = vertices.length;
  const plain: PolarPoint[][] = [];
  const hatched: PolarPoint[][] = [];
  for (let index = 0; index < edgeCount(count); index += 1) {
    const next = (index + 1) % count;
    const [quad] = radarQuads(
      [vertices[index] ?? null, vertices[next] ?? null],
      [zero[index] ?? { x: 0, y: 0 }, zero[next] ?? { x: 0, y: 0 }]
    );
    if (quad === undefined) continue;
    (marked[index] === true || marked[next] === true ? hatched : plain).push([...quad]);
  }
  return { plain: polygonsPath(plain), marked: polygonsPath(hatched) };
}

/**
 * The vertices no edge reaches: a reading whose neighbours on both sides are missing, or the only
 * spoke. The Line draws each as a dot (R5).
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @returns The lone vertices.
 */
export function loneVertices(vertices: readonly (PolarPoint | null)[]): readonly PolarPoint[] {
  const count = vertices.length;
  return vertices.flatMap((vertex, index) => {
    if (vertex === null) return [];
    const before = count < 2 ? null : vertices[(index - 1 + count) % count];
    const after = count < 2 ? null : vertices[(index + 1) % count];
    return (before ?? null) === null && (after ?? null) === null ? [vertex] : [];
  });
}

/**
 * Dots as one path of zero-length subpaths, whose round caps draw each dot at the stroke's width.
 *
 * @param points - The dots' centres.
 * @returns The path data, empty for none.
 */
export function dotsPath(points: readonly PolarPoint[]): string {
  return points.map(({ x, y }) => `M${pathNumber(x)},${pathNumber(y)}h0`).join("");
}
