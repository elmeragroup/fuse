/**
 * Path data for a Line or an Area from drawn vertices, after CONTRACT sections 8.6 and 8.7 and the
 * parity ledger's L17 to L19. Each vertex is a pixel along the slot axis and one or two across the
 * value axis. The curves are d3-shape's, except step-after and step-before, which run from cell edge
 * to cell edge so the last slot keeps its run. A run of readings draws one subpath, a lone reading
 * draws a dot, and the spans that draw dashed or hatched come back beside the path: a segment that
 * touches an estimated reading, a bridge over a missing one and the projected tail. Both the chart's
 * writers and the server-drawn Sparkline call this module, so a resting path is one string.
 */
import {
  area,
  curveBasis,
  curveBumpX,
  curveBumpY,
  curveLinear,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  line,
} from "d3-shape";
import type { CurveFactory } from "d3-shape";

import type { ChartCurve } from "../chart-types";
import { pathNumber } from "./rounding";
import type { PathVertex, VertexState } from "./series-path";

/** What a path's vertices are, beyond where they lie: the topology a writer draws them in. */
export type PathTopology = {
  /** How many vertices the topology describes. */
  readonly count: number;
  readonly states: readonly VertexState[];
  /** Whether each vertex is an estimated reading, whose segments draw dashed. */
  readonly estimated: readonly boolean[];
  /** The first vertex of the projected tail, or `count` when nothing is projected. */
  readonly projectedFrom: number;
  /** How the path crosses a missing reading: a gap, or a dashed bridge. */
  readonly missing: "gap" | "connect";
  /**
   * The side of zero each stacked reading stacks on, null for a loose series. A run breaks where
   * the side changes, so a stacked series that changes sign draws a broken band, as CONTRACT
   * section 8.9 says, and never a band across the series below it.
   */
  readonly sides: readonly ("positive" | "negative" | null)[];
  /**
   * How many of the window's Root cells each vertex's own slot covers: 1, or a coarse series' Root
   * slots, so a step run spans its whole hour on a quarter-hour grid.
   */
  readonly cells: readonly number[];
};

/** How a path's numbers land on screen. */
export type PathPlacement = {
  readonly orientation: "vertical" | "horizontal";
  readonly curve: ChartCurve;
  /** Places a vertex along the slot axis, snapped onto the column the slot's crosshair draws in. */
  readonly along: (at: number) => number;
  /**
   * The span a step run takes around its own slot's centre, from cell edge to cell edge over the
   * slot's Root cells, snapped.
   */
  readonly run: (centre: number, cells: number) => readonly [number, number];
  /**
   * Places a plain step curve's riser, from the unsnapped place halfway between two vertices,
   * snapped as a cell edge is, so a stroked riser covers whole device pixels.
   */
  readonly edge: (at: number) => number;
  /** Snaps a coordinate along the value axis, or passes it through. */
  readonly across: (at: number) => number;
  /**
   * How a lone reading's dot draws: "arc" as a ring the round stroke fills, or "cap" as a subpath of
   * no length whose round cap the stroke draws, which keeps its topology in a stretched viewBox.
   */
  readonly lone?: "arc" | "cap";
  /**
   * The digits a coordinate keeps, or null for every one. A chart's coordinates already lie on the
   * device pixel grid, which rounding would move them off at a fractional pixel ratio, so they keep
   * every digit, and a Sparkline's viewBox coordinates keep `PATH_DIGITS`.
   */
  readonly digits: number | null;
};

/** A span along the slot axis, start first. */
export type Span = readonly [start: number, end: number];

/** A Line's path data. */
export type LinePaths = {
  /** Every run of readings as a subpath, and every lone reading as a dot. */
  readonly line: string;
  /** The spans that draw dashed instead of solid, sorted and disjoint. */
  readonly dashed: readonly Span[];
};

/** An Area's path data. */
export type AreaPaths = {
  /** Every run of readings as a closed subpath between the value and the base. */
  readonly area: string;
  /**
   * Every lone reading as a dot at its value, which a fill cannot paint, so the part strokes it
   * apart, as a Line draws its lone readings. A step curve fills a lone reading's cell instead.
   */
  readonly dots: string;
  /** The spans that draw hatched over the fill, sorted and disjoint. */
  readonly hatched: readonly Span[];
};

/** The radius of a lone reading's dot, which the line's stroke draws round, so the dot reads at 7 px. */
const LONE_DOT_RADIUS = 2.5;

/** The numbers each vertex of a Line holds: its place along the slot axis and its value. */
export const LINE_STRIDE = 2;

/** The numbers each vertex of an Area holds: its place along the slot axis, its value and its base. */
export const AREA_STRIDE = 3;

/**
 * A topology from laid-out vertices.
 *
 * @param vertices - The series path's vertices.
 * @param missing - Config `missing`.
 * @returns The topology.
 */
export function topologyOf(vertices: readonly PathVertex[], missing: "gap" | "connect"): PathTopology {
  const projected = vertices.findIndex((vertex) => vertex.projected);
  return {
    count: vertices.length,
    states: vertices.map((vertex) => vertex.state),
    estimated: vertices.map((vertex) => vertex.state === "reading" && vertex.quality === "estimated"),
    projectedFrom: projected === -1 ? vertices.length : projected,
    missing,
    sides: vertices.map((vertex) => vertex.side),
    cells: vertices.map((vertex) => vertex.cells),
  };
}

/**
 * A path's numbers at rest: each vertex's place along the slot axis, then its value, then for an
 * Area its base, unsnapped, in CSS pixels.
 *
 * @param vertices - The vertices.
 * @param stride - `LINE_STRIDE` or `AREA_STRIDE`.
 * @param along - A window position's centre along the slot axis.
 * @param across - A value's coordinate along the value axis.
 * @returns The numbers the loop tweens.
 */
export function pathValues(
  vertices: readonly PathVertex[],
  stride: number,
  along: (position: number) => number,
  across: (value: number) => number
): number[] {
  const values: number[] = [];
  for (const vertex of vertices) {
    values.push(along(vertex.position), across(vertex.top));
    if (stride === AREA_STRIDE) values.push(across(vertex.base));
  }
  return values;
}

/** Whether a curve runs from cell edge to cell edge. */
function isCellStep(curve: ChartCurve): boolean {
  return curve === "step-after" || curve === "step-before";
}

/** The d3 curve of a ChartCurve, monotone and bump along the slot axis of the orientation. */
function factoryOf(curve: ChartCurve, orientation: "vertical" | "horizontal"): CurveFactory {
  const vertical = orientation === "vertical";
  switch (curve) {
    case "linear":
      return curveLinear;
    case "monotone":
      return vertical ? curveMonotoneX : curveMonotoneY;
    case "monotone-y":
      return curveMonotoneY;
    case "natural":
      return curveNatural;
    case "step":
      return curveStep;
    case "bump":
      return vertical ? curveBumpX : curveBumpY;
    case "basis":
      return curveBasis;
    case "step-after":
    case "step-before":
      return curveLinear;
  }
}

/** The runs a path draws: lists of vertex indexes, each one subpath. */
function runsOf(topology: PathTopology): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  for (let index = 0; index < topology.count; index += 1) {
    const state = topology.states[index];
    const last = run.at(-1);
    if (state === "reading" && last !== undefined && topology.sides[index] !== topology.sides[last]) {
      runs.push(run);
      run = [index];
    } else if (state === "reading") run.push(index);
    // A bridge crosses a missing reading under "connect", and never a slot still to come.
    else if (state === "missing" && topology.missing === "connect") continue;
    else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** Sort spans and merge the ones that touch. */
function merged(spans: Span[]): Span[] {
  const sorted = spans.filter(([start, end]) => end > start).toSorted((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = out.at(-1);
    if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}

/** Reads the numbers of one vertex, snapped. */
type Reader = {
  readonly along: (index: number) => number;
  readonly top: (index: number) => number;
  readonly base: (index: number) => number;
  /** A step run's start and end along the slot axis, snapped. */
  readonly start: (index: number) => number;
  readonly end: (index: number) => number;
  /** A plain step's riser between two vertices along the slot axis, snapped. */
  readonly riser: (from: number, to: number) => number;
};

function readerOf(
  values: readonly number[],
  stride: number,
  place: PathPlacement,
  topology: PathTopology
): Reader {
  const raw = (index: number) => values[index * stride] ?? 0;
  const run = (index: number) => place.run(raw(index), topology.cells[index] ?? 1);
  return {
    along: (index) => place.along(raw(index)),
    top: (index) => place.across(values[index * stride + 1] ?? 0),
    base: (index) => place.across(values[index * stride + 2] ?? 0),
    start: (index) => run(index)[0],
    end: (index) => run(index)[1],
    riser: (from, to) => place.edge((raw(from) + raw(to)) / 2),
  };
}

/**
 * The spans a path draws dashed or hatched: the segments that touch an estimated reading, or a step
 * run of one, each bridge over missing readings, and the projected tail.
 */
function spansOf(topology: PathTopology, runs: readonly number[][], read: Reader, step: boolean): Span[] {
  const spans: Span[] = [];
  for (const run of runs) {
    run.forEach((index, at) => {
      const next = run[at + 1];
      // Readings in one run that are not neighbours have missing readings between them, bridged.
      if (
        next !== undefined &&
        next > index + 1 &&
        topology.states.slice(index + 1, next).includes("missing")
      ) {
        spans.push(step ? [read.end(index), read.start(next)] : [read.along(index), read.along(next)]);
      }
      if (topology.estimated[index] !== true) return;
      if (step) {
        spans.push([read.start(index), read.end(index)]);
        return;
      }
      const before = run[at - 1] ?? index;
      const after = next ?? index;
      // A lone reading's dot dashes its own outline.
      spans.push(
        before === after
          ? [read.along(index) - LONE_DOT_RADIUS - 2, read.along(index) + LONE_DOT_RADIUS + 2]
          : [read.along(before), read.along(after)]
      );
    });
  }
  const tail = runs.flat().find((index) => index >= topology.projectedFrom);
  if (tail !== undefined) {
    spans.push([step ? read.start(tail) : read.along(tail), Number.POSITIVE_INFINITY]);
  }
  return merged(spans);
}

/** A path coordinate, rounded to the placement's digits or kept whole. */
function numberOf(value: number, digits: number | null): string {
  return digits === null ? String(value + 0) : pathNumber(value, digits);
}

/** A point on screen from a coordinate along the slot axis and one along the value axis. */
function point(
  orientation: "vertical" | "horizontal",
  along: number,
  across: number,
  digits: number | null
): string {
  return orientation === "vertical"
    ? `${numberOf(along, digits)},${numberOf(across, digits)}`
    : `${numberOf(across, digits)},${numberOf(along, digits)}`;
}

/** A step run's path from cell edge to cell edge, with risers on the shared edges. */
function stepLine(
  run: readonly number[],
  read: Reader,
  orientation: "vertical" | "horizontal",
  digits: number | null
): string {
  const parts: string[] = [];
  run.forEach((index, at) => {
    const start = read.start(index);
    const end = read.end(index);
    const value = read.top(index);
    if (at === 0) parts.push(`M${point(orientation, start, value, digits)}`);
    else parts.push(`L${point(orientation, start, value, digits)}`);
    parts.push(`L${point(orientation, end, value, digits)}`);
  });
  return parts.join("");
}

/**
 * A plain step's points through a run, d3's curveStep with its risers placed by the placement:
 * each vertex's value runs to the riser halfway to the next vertex, and the last runs to its own
 * vertex.
 */
function stepPoints(run: readonly number[], read: Reader, at: (index: number) => number): [number, number][] {
  const points: [number, number][] = [];
  run.forEach((index, position) => {
    const before = run[position - 1];
    if (before === undefined) {
      points.push([read.along(index), at(index)]);
      return;
    }
    const riser = read.riser(before, index);
    points.push([riser, at(before)], [riser, at(index)]);
  });
  const last = run.at(-1) ?? 0;
  if (run.length > 1) points.push([read.along(last), at(last)]);
  return points;
}

/** A lone reading's dot as two arcs, which the line's round stroke draws. */
function dot(
  read: Reader,
  index: number,
  orientation: "vertical" | "horizontal",
  digits: number | null
): string {
  const along = read.along(index);
  const across = read.top(index);
  const r = LONE_DOT_RADIUS;
  const [x, y] = orientation === "vertical" ? [along, across] : [across, along];
  return `M${numberOf(x - r, digits)},${numberOf(y, digits)}a${String(r)},${String(r)} 0 1,0 ${String(2 * r)},0a${String(r)},${String(r)} 0 1,0 -${String(2 * r)},0`;
}

/**
 * A Line's path data.
 *
 * @param values - The drawn numbers, `LINE_STRIDE` per vertex.
 * @param topology - The topology of those vertices.
 * @param place - The curve, the orientation and the snap.
 * @returns The path and its dashed spans.
 */
export function linePaths(
  values: readonly number[],
  topology: PathTopology,
  place: PathPlacement
): LinePaths {
  const read = readerOf(values, LINE_STRIDE, place, topology);
  const runs = runsOf(topology);
  const step = isCellStep(place.curve);
  const vertical = place.orientation === "vertical";
  const generator = line<number>()
    .x((index) => (vertical ? read.along(index) : read.top(index)))
    .y((index) => (vertical ? read.top(index) : read.along(index)))
    .curve(factoryOf(place.curve, place.orientation))
    .digits(place.digits);
  const parts = runs.map((run) => {
    if (step) return stepLine(run, read, place.orientation, place.digits);
    if (place.curve === "step" && run.length > 1) {
      const points = stepPoints(run, read, read.top);
      return `M${points.map(([along, across]) => point(place.orientation, along, across, place.digits)).join("L")}`;
    }
    if (run.length === 1) {
      const index = run[0] ?? 0;
      return place.lone === "cap"
        ? `M${point(place.orientation, read.along(index), read.top(index), place.digits)}Z`
        : dot(read, index, place.orientation, place.digits);
    }
    return generator(run) ?? "";
  });
  return { line: parts.join(""), dashed: spansOf(topology, runs, read, step) };
}

/**
 * An Area's path data.
 *
 * @param values - The drawn numbers, `AREA_STRIDE` per vertex.
 * @param topology - The topology of those vertices.
 * @param place - The curve, the orientation and the snap.
 * @returns The path and its hatched spans.
 */
export function areaPaths(
  values: readonly number[],
  topology: PathTopology,
  place: PathPlacement
): AreaPaths {
  const read = readerOf(values, AREA_STRIDE, place, topology);
  const runs = runsOf(topology);
  const step = isCellStep(place.curve);
  const vertical = place.orientation === "vertical";
  const generator = vertical
    ? area<number>()
        .x((index) => read.along(index))
        .y0((index) => read.base(index))
        .y1((index) => read.top(index))
    : area<number>()
        .y((index) => read.along(index))
        .x0((index) => read.base(index))
        .x1((index) => read.top(index));
  generator.curve(factoryOf(place.curve, place.orientation)).digits(place.digits);
  const lone = (index: number) =>
    place.lone === "cap"
      ? `M${point(place.orientation, read.along(index), read.top(index), place.digits)}Z`
      : dot(read, index, place.orientation, place.digits);
  const dots = step ? [] : runs.flatMap((run) => (run.length === 1 ? [lone(run[0] ?? 0)] : []));
  const parts = runs.map((run) => {
    if (place.curve === "step" && run.length > 1) {
      // The top runs forward and the base back, each through the same placed risers.
      const top = stepPoints(run, read, read.top);
      const base = stepPoints(run.toReversed(), read, read.base);
      return `M${[...top, ...base].map(([along, across]) => point(place.orientation, along, across, place.digits)).join("L")}Z`;
    }
    if (!step) return run.length < 2 ? "" : (generator(run) ?? "");
    const top = run.flatMap((index) => [
      point(place.orientation, read.start(index), read.top(index), place.digits),
      point(place.orientation, read.end(index), read.top(index), place.digits),
    ]);
    const base = run
      .toReversed()
      .flatMap((index) => [
        point(place.orientation, read.end(index), read.base(index), place.digits),
        point(place.orientation, read.start(index), read.base(index), place.digits),
      ]);
    return `M${[...top, ...base].join("L")}Z`;
  });
  return { area: parts.join(""), dots: dots.join(""), hatched: spansOf(topology, runs, read, step) };
}
