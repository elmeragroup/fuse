/**
 * The model of a scatter chart: long rows with a number x, a number y and a series column, read
 * once per data change into typed arrays. Each series keeps its points sorted by x, then y, then
 * row, and the model keeps one walk order over every series, by x, then y, then series in config
 * order, then row. A point's id is its place in the concatenation of the sorted series, so every
 * structure that follows a point, the walk, the spatial index and the marks, shares one number.
 * The domains are d3-niced extents with no baseline: a scatter usually leaves 0 out.
 */
import type { ChartRow } from "../chart-types";
import type { PointShares } from "./point-index";
import { numberOf, stringOf } from "./scalar";
import { valueDomain } from "./value-domain";
import type { ValueDomain } from "./value-domain";

/** What Root reads the model from. */
export type ScatterModelInput = {
  readonly rows: readonly ChartRow[];
  /** The number column the x axis reads. */
  readonly xKey: string;
  /** The number column the y axis reads. */
  readonly yKey: string;
  /** The string column that names each row's series, a config key. */
  readonly seriesKey: string;
  /** The config keys in config order. */
  readonly keys: readonly string[];
  /** Values the x domain must reach. */
  readonly xInclude: readonly number[];
  /** Values the y domain must reach. */
  readonly yInclude: readonly number[];
};

/** One series' points, sorted by x, then y, then row. */
export type ScatterSeries = {
  readonly key: string;
  /** The series' place in config order. */
  readonly seriesIndex: number;
  /** The id of the series' first point. */
  readonly offset: number;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Each point's row index in `data`. */
  readonly rows: Uint32Array;
};

/** A row the model skipped, with the column that broke the rule. */
export type ScatterIssue = {
  readonly rule: "non-finite-x" | "non-finite-y" | "unknown-series";
  readonly row: number;
  /** The column the rule is about. */
  readonly subject: string;
};

/** The model of a scatter chart. */
export type ScatterModel = {
  /** Every config key's series, in config order, empty ones included. */
  readonly series: readonly ScatterSeries[];
  readonly x: ValueDomain;
  readonly y: ValueDomain;
  /** The number of points. */
  readonly count: number;
  /** Every point id in the all-series walk order. */
  readonly order: Uint32Array;
  /** Each point id's place in `order`. */
  readonly rank: Uint32Array;
  /** Whether the chart has no point. */
  readonly empty: boolean;
  /** The rows the model skipped, in data order. */
  readonly issues: readonly ScatterIssue[];
};

/** One point as the parts print it. */
export type ScatterPoint = {
  readonly id: number;
  readonly key: string;
  readonly seriesIndex: number;
  /** The point's place in its series' order. */
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly row: number;
};

/** A point's place in a walk, 1-based, and the walk's length. */
export type WalkPosition = { readonly position: number; readonly size: number };

/** A key step through a walk. */
export type ScatterStep = "next" | "previous" | "first" | "last";

/** The x axis aims for d3's default of 10 ticks, since it runs along the plot's long side. */
const X_TICKS = 10;

/** The y axis aims for the value axis's 5 ticks. */
const Y_TICKS = 5;

/** A larger magnitude breaks d3's nice step, as the value axis rules it. */
const LIMIT = 1e15;

/** A cell's number, null for a quiet skip, or undefined for a cell that breaks the rule. */
function coordinate(cell: ChartRow[string]): number | null | undefined {
  if (cell === null || cell === undefined) return null;
  const value = numberOf(cell);
  return value !== undefined && Number.isFinite(value) && Math.abs(value) <= LIMIT ? value : undefined;
}

/**
 * Build the model of a scatter chart. A null or undefined x or y skips its row quietly, since the
 * row has no point. A cell that is not a finite number within ±1e15 and a series cell that names
 * no config key skip the row too, and report an issue, which Root throws in development.
 *
 * @param input - Root's rows, columns, config keys and includes.
 * @returns The model with every issue it met.
 */
export function buildScatterModel(input: ScatterModelInput): ScatterModel {
  const { rows, xKey, yKey, seriesKey, keys } = input;
  const slotOf = new Map(keys.map((key, index) => [key, index] as const));
  const members: number[][] = keys.map(() => []);
  const issues: ScatterIssue[] = [];
  const xAt = new Float64Array(rows.length);
  const yAt = new Float64Array(rows.length);
  rows.forEach((row, index) => {
    const x = coordinate(row[xKey]);
    const y = coordinate(row[yKey]);
    if (x === undefined) {
      issues.push({ rule: "non-finite-x", row: index, subject: xKey });
      return;
    }
    if (y === undefined) {
      issues.push({ rule: "non-finite-y", row: index, subject: yKey });
      return;
    }
    if (x === null || y === null) return;
    const name = stringOf(row[seriesKey]);
    const slot = name === undefined ? undefined : slotOf.get(name);
    if (slot === undefined) {
      issues.push({ rule: "unknown-series", row: index, subject: seriesKey });
      return;
    }
    xAt[index] = x;
    yAt[index] = y;
    members[slot]?.push(index);
  });
  let offset = 0;
  const series = keys.map((key, seriesIndex): ScatterSeries => {
    const own = Uint32Array.from(members[seriesIndex] ?? []);
    // Rows enter in data order, so equal points keep their row order.
    own.sort((a, b) => (xAt[a] ?? 0) - (xAt[b] ?? 0) || (yAt[a] ?? 0) - (yAt[b] ?? 0) || a - b);
    const entry: ScatterSeries = {
      key,
      seriesIndex,
      offset,
      xs: Float64Array.from(own, (row) => xAt[row] ?? 0),
      ys: Float64Array.from(own, (row) => yAt[row] ?? 0),
      rows: own,
    };
    offset += own.length;
    return entry;
  });
  const count = offset;
  const order = mergeOrder(series, count);
  const rank = new Uint32Array(count);
  order.forEach((id, place) => {
    rank[id] = place;
  });
  return {
    series,
    x: valueDomain({
      values: extent(series, "xs"),
      baseline: "none",
      include: input.xInclude,
      count: X_TICKS,
    }),
    y: valueDomain({
      values: extent(series, "ys"),
      baseline: "none",
      include: input.yInclude,
      count: Y_TICKS,
    }),
    count,
    order,
    rank,
    empty: count === 0,
    issues,
  };
}

/** The lowest and highest coordinate of every series along one axis, which is all a domain reads. */
function extent(series: readonly ScatterSeries[], axis: "xs" | "ys"): number[] {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const entry of series) {
    for (const value of entry[axis]) {
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }
  return low > high ? [] : [low, high];
}

/**
 * Merge the sorted series into the all-series order, by x, then y, then series, then row. A chart
 * has few series, so each step scans every series' head.
 */
function mergeOrder(series: readonly ScatterSeries[], count: number): Uint32Array {
  const order = new Uint32Array(count);
  const heads = series.map(() => 0);
  for (let place = 0; place < count; place += 1) {
    let best = -1;
    let bestX = 0;
    let bestY = 0;
    series.forEach(({ xs, ys }, index) => {
      const head = heads[index] ?? 0;
      if (head >= xs.length) return;
      const x = xs[head] ?? 0;
      const y = ys[head] ?? 0;
      // Series come in config order, so a tie keeps the earlier one.
      if (best === -1 || x < bestX || (x === bestX && y < bestY)) {
        best = index;
        bestX = x;
        bestY = y;
      }
    });
    const chosen = series[best];
    if (chosen === undefined) break;
    const head = heads[best] ?? 0;
    order[place] = chosen.offset + head;
    heads[best] = head + 1;
  }
  return order;
}

/**
 * The series a point id belongs to.
 *
 * @param model - The model.
 * @param id - A point id.
 * @returns The series, or undefined for an id outside the model.
 */
export function seriesOfPoint(model: ScatterModel, id: number): ScatterSeries | undefined {
  if (id < 0 || id >= model.count) return undefined;
  return model.series.find(({ offset, xs }) => id >= offset && id < offset + xs.length);
}

/**
 * A point by id.
 *
 * @param model - The model.
 * @param id - A point id inside the model.
 * @returns The point.
 * @throws When the id names no point, which is a defect in the caller.
 */
export function pointOf(model: ScatterModel, id: number): ScatterPoint {
  const series = seriesOfPoint(model, id);
  if (series === undefined) throw new Error(`Scatter point ${String(id)} is outside the model.`);
  const index = id - series.offset;
  return {
    id,
    key: series.key,
    seriesIndex: series.seriesIndex,
    index,
    x: series.xs[index] ?? 0,
    y: series.ys[index] ?? 0,
    row: series.rows[index] ?? 0,
  };
}

/**
 * The first index of a sorted series whose point is not before (x, y).
 *
 * @param series - The series.
 * @param x - The x to find.
 * @param y - The y to find.
 * @returns The index, the series' length when every point is before.
 */
function lowerBound(series: ScatterSeries, x: number, y: number): number {
  let low = 0;
  let high = series.xs.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const mx = series.xs[middle] ?? 0;
    const my = series.ys[middle] ?? 0;
    if (mx < x || (mx === x && my < y)) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * The index of a series' point nearest (x, y): the nearest x, then the nearer y, then the earlier
 * point. It is the one rule a series focus change and a data update both resolve by. The nearest x
 * lies in the run of equal x values on either side of where (x, y) sorts, so it reads only those.
 *
 * @param series - The series, sorted by x, then y.
 * @param x - The x to be near.
 * @param y - The y to be near.
 * @returns The index, or -1 for an empty series.
 */
function nearestInSeries(series: ScatterSeries, x: number, y: number): number {
  const at = lowerBound(series, x, y);
  let best = -1;
  let bestX = Number.POSITIVE_INFINITY;
  let bestY = Number.POSITIVE_INFINITY;
  const consider = (index: number): void => {
    const dx = Math.abs((series.xs[index] ?? 0) - x);
    const dy = Math.abs((series.ys[index] ?? 0) - y);
    // A tie in both distances goes to the earlier point, whatever order the runs are read in.
    if (dx < bestX || (dx === bestX && (dy < bestY || (dy === bestY && index < best)))) {
      best = index;
      bestX = dx;
      bestY = dy;
    }
  };
  const after = series.xs[at];
  if (after !== undefined) {
    for (let index = at; index < series.xs.length && series.xs[index] === after; index += 1) consider(index);
  }
  const before = series.xs[at - 1];
  if (before !== undefined) {
    for (let index = at - 1; index >= 0 && series.xs[index] === before; index -= 1) consider(index);
  }
  return best;
}

/**
 * The point a series focus moves to: the given point under "all series", and otherwise the
 * series' point `nearestInSeries` picks.
 *
 * @param model - The model.
 * @param id - The active point.
 * @param focus - The focused series' index, or -1 for all series.
 * @returns The point id, or the given id when the series has no point.
 */
export function focusPoint(model: ScatterModel, id: number, focus: number): number {
  const series = model.series[focus];
  if (focus === -1 || series === undefined || series.xs.length === 0) return id;
  const { x, y } = pointOf(model, id);
  const best = nearestInSeries(series, x, y);
  return best === -1 ? id : series.offset + best;
}

/**
 * The point a key step reaches, inside the focused series or through every series.
 *
 * @param model - The model.
 * @param id - The active point, which lies in the focused series.
 * @param focus - The focused series' index, or -1 for all series.
 * @param step - The step.
 * @returns The point id. A step past either end stays put.
 */
export function stepPoint(model: ScatterModel, id: number, focus: number, step: ScatterStep): number {
  const series = model.series[focus];
  if (focus !== -1 && series !== undefined && series.xs.length > 0) {
    const last = series.xs.length - 1;
    const index = id - series.offset;
    const next =
      step === "first"
        ? 0
        : step === "last"
          ? last
          : step === "next"
            ? Math.min(last, index + 1)
            : Math.max(0, index - 1);
    return series.offset + next;
  }
  const last = model.count - 1;
  const place = model.rank[id] ?? 0;
  const next =
    step === "first"
      ? 0
      : step === "last"
        ? last
        : step === "next"
          ? Math.min(last, place + 1)
          : Math.max(0, place - 1);
  return model.order[next] ?? id;
}

/**
 * A point's place in the walk the focus sets, 1-based, and the walk's length.
 *
 * @param model - The model.
 * @param id - The point.
 * @param focus - The focused series' index, or -1 for all series.
 * @returns The position and the size, which the option's `aria-posinset` and `aria-setsize` read.
 */
export function walkPosition(model: ScatterModel, id: number, focus: number): WalkPosition {
  const series = model.series[focus];
  if (focus !== -1 && series !== undefined) {
    return { position: id - series.offset + 1, size: series.xs.length } satisfies WalkPosition;
  }
  return { position: (model.rank[id] ?? 0) + 1, size: model.count } satisfies WalkPosition;
}

/**
 * Every point as shares of the domains, x from the left and y from the bottom, with its walk rank,
 * by point id, which the pointer's spatial index reads.
 *
 * @param model - The model.
 * @returns The shares.
 */
export function pointShares(model: ScatterModel): PointShares {
  const xs = new Float64Array(model.count);
  const ys = new Float64Array(model.count);
  const [x0, x1] = model.x.domain;
  const [y0, y1] = model.y.domain;
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || 1;
  for (const series of model.series) {
    series.xs.forEach((value, index) => {
      xs[series.offset + index] = (value - x0) / spanX;
    });
    series.ys.forEach((value, index) => {
      ys[series.offset + index] = (value - y0) / spanY;
    });
  }
  return { xs, ys, rank: model.rank };
}

/**
 * The walk's state, every point an id in one model: the active point, the keyboard's place, the
 * point a dismissal closed, and the focused series.
 */
export type WalkState = {
  readonly active: number | null;
  /** The point the plot's option names, null only for an empty model. */
  readonly place: number | null;
  readonly dismissed: number | null;
  /** The focused series' index in config order, or -1 for all series. */
  readonly focus: number;
};

/** A point's place among the points of its series that share its x and y, from 0. */
function duplicateRank(model: ScatterModel, id: number): number {
  const point = pointOf(model, id);
  const series = model.series[point.seriesIndex];
  return series === undefined ? 0 : point.index - lowerBound(series, point.x, point.y);
}

/**
 * A point of an earlier model in a later one: the same series' point at the same x and y. Repeated
 * points keep their rank among their twins, and a rank the later model lacks takes its last twin.
 * Without such a point, `exact` gives null, and otherwise the series' point `nearestInSeries` picks.
 * A series that is gone or has no point gives null.
 */
function carryPoint(
  previous: ScatterModel,
  next: ScatterModel,
  id: number | null,
  exact: boolean
): number | null {
  if (id === null || id < 0 || id >= previous.count) return null;
  const point = pointOf(previous, id);
  const series = next.series.find((entry) => entry.key === point.key);
  if (series === undefined || series.xs.length === 0) return null;
  const at = lowerBound(series, point.x, point.y);
  let twins = 0;
  while (series.xs[at + twins] === point.x && series.ys[at + twins] === point.y) twins += 1;
  if (twins > 0) return series.offset + at + Math.min(duplicateRank(previous, id), twins - 1);
  if (exact) return null;
  return series.offset + nearestInSeries(series, point.x, point.y);
}

/**
 * The walk's state across a data update, in one step, so the active point, the keyboard's place
 * and the series focus never disagree. Each point keeps its series, x and y, as `carryPoint` rules,
 * and a dismissed point is kept only where it is still exactly there. The focus keeps its config
 * key, and a focused series that is gone or has no point gives way to all series. The place falls
 * back to the walk's first point, and under a kept focus it moves into the focused series.
 *
 * @param previous - The model the state's ids belong to.
 * @param next - The model to carry it into.
 * @param state - The state.
 * @returns The state in `next`'s ids.
 */
export function carryWalk(previous: ScatterModel, next: ScatterModel, state: WalkState): WalkState {
  // Only the walk's own fields leave, so a caller that spreads the result writes back no other.
  if (previous === next)
    return { active: state.active, place: state.place, dismissed: state.dismissed, focus: state.focus };
  const key = previous.series[state.focus]?.key;
  const focusIndex = key === undefined ? -1 : next.series.findIndex((series) => series.key === key);
  const focus = (next.series[focusIndex]?.xs.length ?? 0) > 0 ? focusIndex : -1;
  const first = next.empty ? null : (next.order[0] ?? null);
  const carried = carryPoint(previous, next, state.place, false) ?? first;
  const place = carried === null || focus === -1 ? carried : focusPoint(next, carried, focus);
  return {
    active: carryPoint(previous, next, state.active, false),
    place,
    dismissed: carryPoint(previous, next, state.dismissed, true),
    focus,
  };
}
