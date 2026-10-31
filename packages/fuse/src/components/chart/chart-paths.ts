"use client";

/**
 * The routes Root's lines, areas and path-form bars tween, by series and kind, so the marks attached
 * to a series join its tween. A path places its vertices under its anchor and records here the key
 * of each number pair the loop tweens, in order, which is the route of a data update while it runs.
 * A dot, a marker or the active dot then picks its own pair from the path's numbers in every frame,
 * so it sits on its vertex as the path slides, pairs or tweens. A series may draw a Line, an Area
 * and bars at once, so each kind keeps its own record and anchor, and `attachJoin` states which one
 * a follower prefers.
 */
import type { JoinLead, MarkValues } from "./chart-motion";

/** One series path's route, as its last placement left it. */
export type PathRoute = {
  /** The key of each vertex the loop holds for the path, in order. */
  readonly keys: readonly string[];
  /** Each held vertex's place in the window, in slots, ascending. */
  readonly positions: readonly number[];
  /** The key of each vertex the path rests on, in the order of its resting numbers. */
  readonly rest: readonly string[];
  /** Each resting vertex's place in the window, in slots, ascending. */
  readonly restPositions: readonly number[];
  /** The numbers per vertex: 2 for a Line, 3 for an Area, the first two its place and its value. */
  readonly stride: number;
  /** The keys a paired update adds past the old end, whose attached marks fade in where they rest. */
  readonly grown: ReadonlySet<string>;
  /**
   * The crossfade of the path commit that placed the route, one object per commit that
   * crossfades, which each attached mark follows once, or null.
   */
  readonly crossfade: object | null;
};

/** What draws a series path: a Line, an Area, or a Bar's columns in the path form. */
export type PathKind = "line" | "area" | "columns";

/**
 * What owns a route record: the placing mark's own path memory ref, which lives as long as the
 * mark does.
 */
export type PathOwner = { readonly current: unknown };

/** Root's record of series path routes. */
export type ChartPaths = {
  /** Record the route a mark placed for a series path, under the mark's own owner token. */
  readonly set: (series: number, kind: PathKind, owner: PathOwner, route: PathRoute) => void;
  /** Forget the route of a mark that unmounted, unless another mark has placed one since. */
  readonly delete: (series: number, kind: PathKind, owner: PathOwner) => void;
  /** The route of a series path, or undefined when nothing of that kind draws the series. */
  readonly get: (series: number, kind: PathKind) => PathRoute | undefined;
};

/**
 * Create a Root's path routes.
 *
 * @returns The record.
 */
export function createChartPaths(): ChartPaths {
  const routes = new Map<string, { readonly owner: PathOwner; readonly route: PathRoute }>();
  return {
    set: (series, kind, owner, route) => {
      routes.set(pathAnchor(series, kind), { owner, route });
    },
    delete: (series, kind, owner) => {
      const anchor = pathAnchor(series, kind);
      if (routes.get(anchor)?.owner === owner) routes.delete(anchor);
    },
    get: (series, kind) => routes.get(pathAnchor(series, kind))?.route,
  };
}

/**
 * The anchor a series path places its vertices under, which its attached marks join.
 *
 * @param seriesIndex - The series ordinal.
 * @param kind - What draws the path.
 * @returns The anchor.
 */
export function pathAnchor(seriesIndex: number, kind: PathKind): string {
  return `${kind} ${String(seriesIndex)}`;
}

/**
 * A path's place and value at a place in the window: its vertex's there, or a straight blend of
 * the two vertices around it, or its end vertex's past either end.
 */
function projectAt(
  values: MarkValues,
  stride: number,
  positions: readonly number[],
  position: number
): [number, number] {
  const vertex = (index: number): [number, number] => [
    values[index * stride] ?? 0,
    values[index * stride + 1] ?? 0,
  ];
  // The first vertex at or past the place, by bisection.
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((positions[middle] ?? 0) < position) low = middle + 1;
    else high = middle;
  }
  if (low >= positions.length) return vertex(positions.length - 1);
  if (low === 0 || positions[low] === position) return vertex(low);
  const [a, b] = [positions[low - 1] ?? 0, positions[low] ?? 0];
  const share = (position - a) / (b - a);
  const [from, to] = [vertex(low - 1), vertex(low)];
  return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share];
}

/** Each route's vertex index by key, held and resting, built once per route. */
const indexes = new WeakMap<
  PathRoute,
  { readonly held: ReadonlyMap<string, number>; readonly resting: ReadonlyMap<string, number> }
>();

/** A route's vertex index by key, held and resting, so a pointer step looks a mark up in O(1). */
function indexesOf(route: PathRoute) {
  const cached = indexes.get(route);
  if (cached !== undefined) return cached;
  const built = {
    held: new Map(route.keys.map((key, index) => [key, index])),
    resting: new Map(route.rest.map((key, index) => [key, index])),
  };
  indexes.set(route, built);
  return built;
}

/**
 * How attached marks join their series path, one lead per mark: each mark's place and value from
 * the path's numbers. On a line, a mark whose slot the path draws no vertex for, as decimation
 * leaves out, sits on the path between the vertices around its slot, in motion and at rest. A
 * decimated column stands for a bucket's extremes, not for one reading, so a mark on a slot the
 * columns draw no entry for keeps its own numbers and moves them on the columns' clock. A mark a
 * paired update grows past the old end keeps its own numbers in motion, so it fades in where it
 * rests.
 *
 * @param route - The series path's route.
 * @param seriesIndex - The series ordinal.
 * @param kind - What draws the path.
 * @param marks - Each attached mark's slot key and its place in the window, in the order of its numbers.
 * @param rest - The attached marks' resting numbers, a place and a value each.
 * @returns The leads for `useFollowerPlacement`, in the order of the marks.
 */
export function joinPath(
  route: PathRoute,
  seriesIndex: number,
  kind: PathKind,
  marks: readonly { readonly key: string; readonly position: number }[],
  rest: MarkValues
): JoinLead[] {
  const anchor = pathAnchor(seriesIndex, kind);
  const { held, resting } = indexesOf(route);
  const vertex = (values: MarkValues, index: number) => [
    values[index * route.stride] ?? 0,
    values[index * route.stride + 1] ?? 0,
  ];
  return marks.map(({ key, position }, mark): JoinLead => {
    const index = held.get(key);
    const restIndex = resting.get(key);
    if (kind === "columns" && (index === undefined || restIndex === undefined)) return { anchor, clock: 2 };
    const own = [rest[mark * 2] ?? 0, rest[mark * 2 + 1] ?? 0];
    return {
      anchor,
      pick: (values) =>
        route.grown.has(key)
          ? own
          : index === undefined
            ? projectAt(values, route.stride, route.positions, position)
            : vertex(values, index),
      rest: (values) =>
        restIndex === undefined
          ? projectAt(values, route.stride, route.restPositions, position)
          : vertex(values, restIndex),
    };
  });
}
