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
import { ChartCompositionError } from "./layout/errors";

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
  /**
   * Hold a series as the one path of a kind that a mounted part draws, so its route and the anchor
   * its followers join have one owner. The result lets it go.
   *
   * @throws {ChartCompositionError} `series-drawn-twice` when another mounted part holds it.
   */
  readonly claim: (part: string, kind: PathKind, dataKey: string) => () => void;
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
  // The part holding each series and kind, by kind and config key.
  const claims = new Map<string, object>();
  return {
    claim: (part, kind, dataKey) => {
      const name = `${kind} ${dataKey}`;
      if (claims.has(name)) {
        throw new ChartCompositionError(
          part,
          "series-drawn-twice",
          `draws ${JSON.stringify(dataKey)}, which another ${part} in this Chart.Root draws too, so two marks would move one series and its followers could join either. Draw each series with one ${part}.`
        );
      }
      const token = {};
      claims.set(name, token);
      return () => {
        if (claims.get(name) === token) claims.delete(name);
      };
    },
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

/**
 * Each key list's vertex index by key. A route's lists are the series path's own key arrays, which
 * the series-path cache keeps across commits that settle, so a resize or a legend toggle reuses the
 * index a pointer sweep built.
 */
const indexes = new WeakMap<readonly string[], ReadonlyMap<string, number>>();

/** A key list's vertex index by key, so a pointer step looks a mark up in O(1). */
function indexOf(keys: readonly string[]): ReadonlyMap<string, number> {
  const cached = indexes.get(keys);
  if (cached !== undefined) return cached;
  const built = new Map(keys.map((key, index) => [key, index]));
  indexes.set(keys, built);
  return built;
}

/**
 * The index of a key's vertex among a route's held vertices.
 *
 * @param route - The series path's route.
 * @param key - The slot key.
 * @returns The index, or undefined when the route holds no vertex for the key.
 */
export function routeIndex(route: PathRoute, key: string): number | undefined {
  return indexOf(route.keys).get(key);
}

/**
 * How attached marks join their series path: one lead per run of marks, which reads each mark's
 * place and value from the path's numbers in one pass. On a line, a mark whose slot the path draws
 * no vertex for, as decimation leaves out, sits on the path between the vertices around its slot,
 * in motion and at rest. A decimated column stands for a bucket's extremes, not for one reading,
 * so a run of marks on slots the columns draw no entry for keeps its own numbers and moves them on
 * the columns' clock. A mark a paired update grows past the old end keeps its own numbers in
 * motion, so it fades in where it rests.
 *
 * @param route - The series path's route.
 * @param seriesIndex - The series ordinal.
 * @param kind - What draws the path.
 * @param marks - Each attached mark's slot key and its place in the window, in the order of its numbers.
 * @param rest - The attached marks' resting numbers, a place and a value each.
 * @returns The leads for `useFollowerPlacement`, which cover the marks' numbers in order.
 */
export function joinPath(
  route: PathRoute,
  seriesIndex: number,
  kind: PathKind,
  marks: readonly { readonly key: string; readonly position: number }[],
  rest: MarkValues
): JoinLead[] {
  const anchor = pathAnchor(seriesIndex, kind);
  const held = indexOf(route.keys);
  const resting = indexOf(route.rest);
  const joined = marks.map(({ key, position }, mark) => ({
    key,
    position,
    index: held.get(key),
    restIndex: resting.get(key),
    own: [rest[mark * 2] ?? 0, rest[mark * 2 + 1] ?? 0] as const,
  }));
  type Joined = (typeof joined)[number];
  const free = ({ index, restIndex }: Joined) =>
    kind === "columns" && (index === undefined || restIndex === undefined);
  // Write one mark's place and value from the path's numbers at its vertex.
  const vertexInto = (out: number[], values: MarkValues, index: number): void => {
    out.push(values[index * route.stride] ?? 0, values[index * route.stride + 1] ?? 0);
  };
  const leadOf = (clocked: boolean, run: readonly Joined[]): JoinLead =>
    clocked
      ? { anchor, clock: run.length * 2 }
      : {
          anchor,
          size: run.length * 2,
          pick: (values) => {
            const out: number[] = [];
            for (const { key, position, index, own } of run) {
              if (route.grown.has(key)) out.push(...own);
              else if (index === undefined)
                out.push(...projectAt(values, route.stride, route.positions, position));
              else vertexInto(out, values, index);
            }
            return out;
          },
          rest: (values) => {
            const out: number[] = [];
            for (const { position, restIndex } of run) {
              if (restIndex === undefined)
                out.push(...projectAt(values, route.stride, route.restPositions, position));
              else vertexInto(out, values, restIndex);
            }
            return out;
          },
        };
  // Consecutive marks that join alike share one lead.
  const leads: JoinLead[] = [];
  let start = 0;
  joined.forEach((mark, index) => {
    const next = joined[index + 1];
    if (next !== undefined && free(next) === free(mark)) return;
    leads.push(leadOf(free(mark), joined.slice(start, index + 1)));
    start = index + 1;
  });
  return leads;
}
