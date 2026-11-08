/**
 * The clock dial's paths. A curve runs through d3's curve in unrolled (θ, r) space, through a path
 * context that samples each segment into polar points, so a segment between two equal values is an
 * arc of a circle and the monotone and bump curves stay monotone along the dial. The loop closes
 * across 12 o'clock when both end slots hold readings (D16), and a missing or pending end leaves it
 * open. A wedge takes its slot's whole angle less a pad that keeps the gap one width from hole to
 * rim (D14). Every coordinate is in units of the outer radius and rounds through `pathNumber`.
 */
import { curveBasis, curveBumpX, curveLinear, curveMonotoneX, curveNatural, curveStep } from "d3-shape";
import type { CurveFactory } from "d3-shape";

import type { ChartCurve } from "../chart-types";
import { arcPath, arcWriter } from "./arc-path";
import type { PolarPoint } from "./polar-angle";
import { CLOCK_INTRO } from "./polar-motion";
import { pathNumber } from "./rounding";

/** The numbers one slot draws from: its start and end angle in degrees, its base radius and its tip. */
export const CLOCK_STRIDE = 4;

/**
 * How a slot draws: a reading, a missing reading, nothing yet, or nothing of its own, as a Root slot
 * a coarse slot covers from its first Root slot.
 */
export type ClockSlotState = "reading" | "missing" | "pending" | "covered";

/** A point in unrolled space: θ in degrees from 12 o'clock, r in units of the outer radius. */
export type ClockPoint = { readonly angle: number; readonly radius: number };

/** What a series' slots hold beside their numbers. */
export type ClockSlots = {
  readonly states: readonly ClockSlotState[];
  /** Whether each slot dashes or hatches: an estimated or projected reading. */
  readonly marked: readonly boolean[];
  /** How a missing reading draws: "gap" breaks the curve and "connect" bridges it, dashed. */
  readonly missing: "gap" | "connect";
};

/** A frame of the entrance: the numbers with each tip risen as far as it has, and the open wedge's angle. */
export type EntranceFrame = { readonly values: readonly number[]; readonly reveal: number };

/**
 * The entrance at the loop's progress, the list's first number: 0 before it starts, 1 at rest.
 *
 * @param values - The loop's numbers: the progress, then each slot's angles, base and tip.
 * @returns The numbers to draw and the wedge's angle in degrees, 360 once open.
 */
export function entranceFrame(values: readonly number[]): EntranceFrame {
  const progress = values[0] ?? 1;
  if (progress >= 1) return { values, reveal: 360 };
  const time = Math.max(0, progress) * CLOCK_INTRO.span;
  const reveal = Math.min(360, (360 * time) / CLOCK_INTRO.wedge);
  const risen = [...values];
  for (let at = 1; at + 3 < values.length; at += CLOCK_STRIDE) {
    const start = values[at] ?? 0;
    const base = values[at + 2] ?? 0;
    const tip = values[at + 3] ?? 0;
    const t = Math.min(1, Math.max(0, (time - (CLOCK_INTRO.wedge * start) / 360) / CLOCK_INTRO.rise));
    const eased = 1 - (1 - t) ** 3;
    risen[at + 3] = base + (tip - base) * eased;
  }
  return { values: risen, reveal };
}

/**
 * The open wedge of the entrance as path data, a sector from 12 o'clock past the rim, or empty once
 * it is whole.
 *
 * @param reveal - The wedge's angle in degrees.
 * @returns The path data.
 */
export function revealPath(reveal: number): string {
  if (reveal >= 360) return "";
  if (reveal <= 0) return "M0,0Z";
  return arcPath({ innerRadius: 0, outerRadius: 2, startAngle: 0, endAngle: reveal });
}

/** The largest angle one sampled step spans, in degrees, so an arc reads round. */
const STEP = 2;

/** The d3 curve of a ChartCurve in unrolled space, where θ runs along x. */
function factoryOf(curve: ChartCurve): CurveFactory {
  switch (curve) {
    case "monotone":
    case "monotone-y":
      return curveMonotoneX;
    case "natural":
      return curveNatural;
    case "step":
      return curveStep;
    case "bump":
      return curveBumpX;
    case "basis":
      return curveBasis;
    case "linear":
    case "step-after":
    case "step-before":
      return curveLinear;
  }
}

/**
 * A d3 path context that samples what a curve draws into points in unrolled space: each line, and
 * each cubic or quadratic segment, into steps of `STEP` degrees or less.
 */
class Sampler {
  readonly lines: ClockPoint[][] = [];
  private line: ClockPoint[] = [];
  private x = 0;
  private y = 0;

  moveTo(x: number, y: number): void {
    this.line = [{ angle: x, radius: y }];
    this.lines.push(this.line);
    this.x = x;
    this.y = y;
  }

  lineTo(x: number, y: number): void {
    const steps = Math.max(1, Math.ceil(Math.abs(x - this.x) / STEP));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      this.line.push({ angle: this.x + (x - this.x) * t, radius: this.y + (y - this.y) * t });
    }
    this.x = x;
    this.y = y;
  }

  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    const reach = Math.max(Math.abs(x1 - this.x), Math.abs(x2 - x1), Math.abs(x - x2));
    const steps = Math.max(1, Math.ceil((3 * reach) / STEP));
    const [x0, y0] = [this.x, this.y];
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      this.line.push({ angle: a * x0 + b * x1 + c * x2 + d * x, radius: a * y0 + b * y1 + c * y2 + d * y });
    }
    this.x = x;
    this.y = y;
  }

  quadraticCurveTo(x1: number, y1: number, x: number, y: number): void {
    this.bezierCurveTo(
      this.x + (2 / 3) * (x1 - this.x),
      this.y + (2 / 3) * (y1 - this.y),
      x + (2 / 3) * (x1 - x),
      y + (2 / 3) * (y1 - y),
      x,
      y
    );
  }

  closePath(): void {
    const [first] = this.line;
    if (first !== undefined) this.lineTo(first.angle, first.radius);
  }

  // No d3 curve draws arcs or rectangles, so these keep the context whole as straight steps.
  arcTo(_x1: number, _y1: number, x: number, y: number): void {
    this.lineTo(x, y);
  }

  arc(x: number, y: number): void {
    this.lineTo(x, y);
  }

  rect(x: number, y: number): void {
    this.moveTo(x, y);
  }

  toString(): string {
    return "";
  }
}

/**
 * Sample a curve through points in unrolled space.
 *
 * @param points - The points, θ ascending.
 * @param curve - The curve.
 * @returns The sampled points.
 */
export function sampleCurve(points: readonly ClockPoint[], curve: ChartCurve): ClockPoint[] {
  if (points.length === 0) return [];
  const sampler = new Sampler();
  const draw = factoryOf(curve)(sampler);
  draw.lineStart();
  for (const { angle, radius } of points) draw.point(angle, radius);
  draw.lineEnd();
  return sampler.lines.flat();
}

/** One run of a series: its slots in order, and whether it closes round the dial. */
type Run = { readonly slots: readonly number[]; readonly closed: boolean };

/**
 * The runs a series' curve draws. A pending slot always breaks a run, a missing one breaks it under
 * "gap", and a run that holds both end slots, either one through the coarse reading that covers it,
 * crosses 12 o'clock, closing when it holds every slot.
 */
function runsOf(slots: ClockSlots): readonly Run[] {
  const known = runsBySlots.get(slots);
  if (known !== undefined) return known;
  const runs = findRuns(slots);
  runsBySlots.set(slots, runs);
  return runs;
}

/** Each slots' runs, found once, since the Line, the Area and an ActiveDot read them every frame. */
const runsBySlots = new WeakMap<ClockSlots, readonly Run[]>();

/** The runs of `runsOf`, found anew. */
function findRuns(slots: ClockSlots): Run[] {
  const { states, missing } = slots;
  const count = states.length;
  const runs: number[][] = [];
  let run: number[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const state = states[slot];
    if (state === "reading") run.push(slot);
    else if (state === "covered") continue;
    else if (state === "pending" || missing === "gap") {
      if (run.length > 0) runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  // The last slot may be covered by a coarse reading that owns it, which counts as a reading there.
  const seam = count > 1 && states[0] === "reading" && states[ownerSlot(states, count - 1)] === "reading";
  if (!seam) return runs.map((slotsOf) => ({ slots: slotsOf, closed: false }));
  const [first] = runs;
  const last = runs.at(-1);
  if (first === undefined || last === undefined) return [];
  if (runs.length === 1) return [{ slots: first, closed: first.length > 2 }];
  // The run that ends the cycle carries on into the one that starts it, across the seam.
  return [
    { slots: [...last, ...first], closed: false },
    ...runs.slice(1, -1).map((slotsOf) => ({ slots: slotsOf, closed: false })),
  ];
}

/** A slot's numbers from the loop's list, after the leading progress. */
function slotAt(values: readonly number[], slot: number): readonly [number, number, number, number] {
  const at = 1 + slot * CLOCK_STRIDE;
  return [values[at] ?? 0, values[at + 1] ?? 0, values[at + 2] ?? 0, values[at + 3] ?? 0];
}

/**
 * Whether a curve draws each reading across its own slot: the cell steps by their points, and the
 * midpoint step because it turns halfway between two vertices, which on equal slots is their edge.
 */
function stepsAcrossSlots(curve: ChartCurve): boolean {
  return curve === "step" || curve === "step-after" || curve === "step-before";
}

/** A run's points in unrolled space, its angles kept ascending across the seam, and each slot's edges. */
function runPoints(values: readonly number[], run: Run, curve: ChartCurve, pick: "base" | "tip") {
  const points: ClockPoint[] = [];
  const angles: number[] = [];
  const edges: (readonly [number, number])[] = [];
  let turn = 0;
  let previous = Number.NEGATIVE_INFINITY;
  for (const slot of run.slots) {
    const [start, end, base, tip] = slotAt(values, slot);
    if ((start + end) / 2 + turn < previous) turn += 360;
    const radius = pick === "tip" ? tip : base;
    const centre = (start + end) / 2 + turn;
    angles.push(centre);
    edges.push([start + turn, end + turn]);
    previous = centre;
    if (curve === "step-after" || curve === "step-before") {
      // A cell step runs each reading across its whole slot.
      points.push({ angle: start + turn, radius }, { angle: end + turn, radius });
    } else points.push({ angle: centre, radius });
  }
  return { points, angles, edges };
}

/** A run's curve sampled in unrolled space, closed round the dial when the run closes. */
function runCurve(
  values: readonly number[],
  run: Run,
  curve: ChartCurve,
  pick: "base" | "tip"
): ClockPoint[] {
  const { points } = runPoints(values, run, curve, pick);
  if (!run.closed || points.length < 2) return sampleCurve(points, curve);
  const first = points[0];
  if (first === undefined) return [];
  // Two points either side of the seam give the curve its tangents there, and the sample keeps one turn.
  const shifted = (point: ClockPoint | undefined, by: number): ClockPoint[] =>
    point === undefined ? [] : [{ angle: point.angle + by, radius: point.radius }];
  const extended = [
    ...shifted(points.at(-2), -360),
    ...shifted(points.at(-1), -360),
    ...points,
    ...shifted(points[0], 360),
    ...shifted(points[1], 360),
  ];
  return clip(sampleCurve(extended, curve), first.angle, first.angle + 360);
}

/**
 * The radius a sampled curve reaches an angle at, from the index of its first sample at or past the
 * angle: the two samples either side, and on a step's edge, where several share the angle, the first.
 */
function reaching(line: readonly ClockPoint[], atOrPast: number, angle: number): number {
  const index = Math.min(Math.max(atOrPast, 1), line.length - 1);
  const a = line[index - 1] ?? { angle, radius: 0 };
  const b = line[index] ?? a;
  const span = b.angle - a.angle;
  return span === 0 ? b.radius : a.radius + ((b.radius - a.radius) * (angle - a.angle)) / span;
}

/**
 * The radius a sampled curve leaves an angle at, from the index of its first sample past the angle:
 * its last sample at the angle, where a step's edge stacks several, or the interpolation across it.
 */
function leaving(line: readonly ClockPoint[], past: number, angle: number): number {
  const index = Math.min(Math.max(past - 1, 0), line.length - 1);
  const a = line[index] ?? { angle, radius: 0 };
  const b = line[index + 1] ?? a;
  if (a.angle === angle || b.angle === a.angle) return a.radius;
  return a.radius + ((b.radius - a.radius) * (angle - a.angle)) / (b.angle - a.angle);
}

/**
 * The parts of a sampled curve between pairs of angles, ascending and apart, each with its ends cut
 * where they fall, in one pass along the curve. A cut on a step's edge keeps the side of the step
 * inside the part: the radius the curve leaves its start at, and the one it reaches its end at, so a
 * hatch over a step follows the step.
 */
function clipAll(
  line: readonly ClockPoint[],
  ranges: readonly (readonly [number, number])[]
): ClockPoint[][] {
  const parts: ClockPoint[][] = [];
  let index = 0;
  for (const [from, to] of ranges) {
    while (index < line.length && (line[index]?.angle ?? 0) <= from) index += 1;
    const kept: ClockPoint[] = [{ angle: from, radius: leaving(line, index, from) }];
    for (let point = line[index]; point !== undefined && point.angle < to; point = line[index]) {
      kept.push(point);
      index += 1;
    }
    kept.push({ angle: to, radius: reaching(line, index, to) });
    parts.push(kept);
  }
  return parts;
}

/** The part of a sampled curve between two angles, as `clipAll` cuts it. */
function clip(line: readonly ClockPoint[], from: number, to: number): ClockPoint[] {
  return clipAll(line, [[from, to]])[0] ?? [];
}

/**
 * A series' drawn curve indexed for `radiusInCurve`: each run's sampled tip line, or a lone
 * reading's slot and tip. It holds for one frame's numbers, so a reader that asks many angles of one
 * frame, as an ActiveDot does, builds it once.
 */
export type CurveIndex = readonly (
  | { readonly kind: "lone"; readonly start: number; readonly end: number; readonly tip: number }
  | { readonly kind: "line"; readonly line: readonly ClockPoint[] }
)[];

/**
 * Index a series' drawn curve in one frame's numbers, for `radiusInCurve`.
 *
 * @param values - The loop's numbers: the progress, then each slot's angles, base and tip.
 * @param slots - Each slot's state and mark, and the missing rule.
 * @param curve - The curve.
 * @returns The index.
 */
export function curveIndex(values: readonly number[], slots: ClockSlots, curve: ChartCurve): CurveIndex {
  return runsOf(slots).flatMap((run): CurveIndex => {
    if (run.slots.length < 2) {
      const [start, end, , tip] = slotAt(values, run.slots[0] ?? 0);
      return [{ kind: "lone" as const, start, end, tip }];
    }
    const line = runCurve(values, run, curve, "tip");
    return line.length === 0 ? [] : [{ kind: "line" as const, line }];
  });
}

/**
 * The radius an indexed curve reaches at an angle, or null where it draws nothing there, as
 * `curveRadiusAt` reads it.
 *
 * @param index - The curve, from `curveIndex`.
 * @param angle - The angle in degrees from 12 o'clock, in any turn.
 * @returns The radius, or null.
 */
export function radiusInCurve(index: CurveIndex, angle: number): number | null {
  for (const run of index) {
    if (run.kind === "lone") {
      // A lone reading draws a dot in its slot's middle, which the active dot covers at rest.
      const at = run.start + ((((angle - run.start) % 360) + 360) % 360);
      if (at <= run.end) return run.tip;
      continue;
    }
    const { line } = run;
    const first = line[0];
    const last = line.at(-1);
    if (first === undefined || last === undefined) continue;
    const at = first.angle + ((((angle - first.angle) % 360) + 360) % 360);
    if (at > last.angle) continue;
    // The last sample at or before the angle, by halves.
    let low = 0;
    let high = line.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if ((line[middle]?.angle ?? 0) <= at) low = middle;
      else high = middle;
    }
    return reaching(line, high, at);
  }
  return null;
}

/**
 * The radius a series' drawn curve reaches at an angle, or null where it draws nothing there: in a
 * gap or past an open run's end. The curve is the one the Line and Area draw from the same numbers,
 * read between its samples as the drawn polyline joins them, so a point at this radius lies on the
 * drawn path. A closed run reads the angle in its own turn, and a lone reading's slot reads its tip,
 * where its dot sits.
 *
 * @param values - The loop's numbers: the progress, then each slot's angles, base and tip.
 * @param slots - Each slot's state and mark, and the missing rule.
 * @param curve - The curve.
 * @param angle - The angle in degrees from 12 o'clock, in any turn.
 * @returns The radius, or null.
 */
export function curveRadiusAt(
  values: readonly number[],
  slots: ClockSlots,
  curve: ChartCurve,
  angle: number
): number | null {
  return radiusInCurve(curveIndex(values, slots, curve), angle);
}

/** Sampled points as path data in the dial's x and y, open or closed. */
function polyline(points: readonly ClockPoint[], closed: boolean): string {
  if (points.length === 0) return "";
  const body = points
    .map(({ angle, radius }, index) => {
      const radians = (angle * Math.PI) / 180;
      return `${index === 0 ? "M" : "L"}${pathNumber(radius * Math.sin(radians))},${pathNumber(-radius * Math.cos(radians))}`;
    })
    .join("");
  return closed ? `${body}Z` : body;
}

/**
 * The angle ranges a run dashes or hatches: each segment that touches a marked slot, and each
 * bridge, folded into the angles its curve samples and merged. A curve that steps draws each reading
 * across its own slot, so its marked range is that slot, from its start to its end, and its bridge
 * runs from one reading's end to the next one's start (section 8.7, Q3, B7). Any other curve draws
 * a reading as a vertex, so its range runs between the vertices beside it. A closed run's first and last readings
 * meet across midnight, so a range that reaches past one end of the sampled turn continues at the
 * other, and overlapping ranges, as two adjacent marked readings give, merge into one, so no piece is
 * drawn twice, extrapolated past the samples or cancelled by an even-odd fill.
 *
 * @param run - The run.
 * @param angles - Each of its slots' vertex angle, in the curve's unrolled turn.
 * @param slots - The slots' states and marks.
 * @param bounds - The first and last angle the run's curve samples.
 * @param edges - Each slot's start and end, in the same turn, for a curve that steps, or null.
 * @returns The merged ranges, ascending, each inside the bounds.
 */
function markedRanges(
  run: Run,
  angles: readonly number[],
  slots: ClockSlots,
  bounds: readonly [number, number],
  edges: readonly (readonly [number, number])[] | null
): [number, number][] {
  const raw: [number, number][] = [];
  const last = angles.length - 1;
  const wrapped = (index: number): number | undefined => {
    if (!run.closed) return angles[index];
    if (index < 0) return (angles[last] ?? 0) - 360;
    if (index > last) return (angles[0] ?? 0) + 360;
    return angles[index];
  };
  run.slots.forEach((slot, index) => {
    const here = angles[index] ?? 0;
    const before = wrapped(index - 1);
    const after = wrapped(index + 1);
    const cell = edges?.[index];
    const nextCell = edges?.[index + 1];
    if (slots.marked[slot] === true)
      raw.push(cell === undefined ? [before ?? here, after ?? here] : [cell[0], cell[1]]);
    const next = run.slots[index + 1];
    // A bridge crosses one or more missing slots between two readings, and a covered slot is none.
    if (next !== undefined && after !== undefined && bridges(slots.states, slot, next))
      raw.push(cell === undefined || nextCell === undefined ? [here, after] : [cell[1], nextCell[0]]);
  });
  const [low, high] = bounds;
  const shifts = run.closed ? [-360, 0, 360] : [0];
  const folded = raw
    .flatMap(([from, to]) =>
      shifts.map((shift): [number, number] => [Math.max(low, from + shift), Math.min(high, to + shift)])
    )
    .filter(([from, to]) => to > from)
    .toSorted((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of folded) {
    const previous = merged.at(-1);
    if (previous !== undefined && from <= previous[1]) previous[1] = Math.max(previous[1], to);
    else merged.push([from, to]);
  }
  return merged;
}

/** Whether a missing slot lies between two slots of a run, going round from the first. */
function bridges(states: readonly ClockSlotState[], from: number, to: number): boolean {
  const count = states.length;
  for (let slot = (from + 1) % count; slot !== to; slot = (slot + 1) % count) {
    if (states[slot] === "missing") return true;
  }
  return false;
}

/**
 * Split a sampled curve into its plain pieces and the pieces inside the marked ranges, in one pass:
 * the samples, the cuts and the ranges each advance a cursor, so an 8,760-hour year splits in about
 * the time it samples.
 *
 * @param line - The sampled curve, its angles ascending.
 * @param ranges - The marked ranges, ascending and apart, as `markedRanges` merges them.
 * @returns The plain and the marked pieces, each of two points or more.
 */
function splitMarked(line: readonly ClockPoint[], ranges: readonly (readonly [number, number])[]) {
  const plain: ClockPoint[][] = [];
  const marked: ClockPoint[][] = [];
  const first = line[0];
  const last = line.at(-1);
  if (first === undefined || last === undefined) return { plain, marked };
  // Every range edge strictly inside the curve, where a piece ends and the next starts. A cut at
  // either end would split off nothing.
  const cuts = ranges.flat().filter((cut) => cut > first.angle && cut < last.angle);
  let range = 0;
  // The probes rise along the curve, so the range that could hold one never moves back.
  const isMarked = (angle: number): boolean => {
    while ((ranges[range]?.[1] ?? Number.POSITIVE_INFINITY) < angle) range += 1;
    const [from, to] = ranges[range] ?? [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    return angle >= from && angle <= to;
  };
  // A piece takes the mark of its first stretch: from its start to the first angle past it, a
  // later sample past a step's edge, whose samples share the start's angle, or the next cut.
  const stretch = (start: number, from: number, next: number | undefined): number => {
    let ahead = from;
    while ((line[ahead]?.angle ?? Number.POSITIVE_INFINITY) <= start) ahead += 1;
    const end = Math.min(line[ahead]?.angle ?? start, next ?? Number.POSITIVE_INFINITY);
    return (start + end) / 2;
  };
  let piece: ClockPoint[] = [first];
  let pieceMarked = isMarked(stretch(first.angle, 1, cuts[0]));
  let cut = 0;
  for (let index = 1; index < line.length; index += 1) {
    const previous = line[index - 1] ?? first;
    const point = line[index] ?? previous;
    // A cut that falls on a sample splits there, and one between two samples splits between them.
    for (let at = cuts[cut]; at !== undefined && at <= point.angle; at = cuts[cut]) {
      cut += 1;
      const span = point.angle - previous.angle;
      const split = {
        angle: at,
        radius:
          span === 0
            ? point.radius
            : previous.radius + ((point.radius - previous.radius) * (at - previous.angle)) / span,
      };
      piece.push(split);
      if (piece.length > 1) (pieceMarked ? marked : plain).push(piece);
      piece = [split];
      pieceMarked = isMarked(stretch(at, index, cuts[cut]));
    }
    piece.push(point);
  }
  if (piece.length > 1) (pieceMarked ? marked : plain).push(piece);
  return { plain, marked };
}

/** A Line's paths: its plain runs, its dashed pieces, and a dot for each lone reading. */
export type ClockLinePaths = { readonly solid: string; readonly marked: string; readonly lone: string };

/**
 * A Line through a series' tips.
 *
 * @param values - The loop's numbers: the progress, then each slot's angles, base and tip.
 * @param slots - Each slot's state and mark, and the missing rule.
 * @param curve - The curve.
 * @returns The paths.
 */
export function clockLine(values: readonly number[], slots: ClockSlots, curve: ChartCurve): ClockLinePaths {
  let solid = "";
  let dashed = "";
  let lone = "";
  for (const run of runsOf(slots)) {
    if (run.slots.length === 1) {
      const [start, end, , tip] = slotAt(values, run.slots[0] ?? 0);
      lone += `${polyline([{ angle: (start + end) / 2, radius: tip }], false)}h0`;
      continue;
    }
    const { angles, edges } = runPoints(values, run, curve, "tip");
    const line = runCurve(values, run, curve, "tip");
    const ranges = markedRanges(
      run,
      angles,
      slots,
      [line[0]?.angle ?? 0, line.at(-1)?.angle ?? 0],
      stepsAcrossSlots(curve) ? edges : null
    );
    if (ranges.length === 0) {
      solid += polyline(line, run.closed);
      continue;
    }
    // A closed cell step's turn starts on slot 0's start, where it steps from the last reading to
    // the first. A whole loop's closing edge draws that step; a split one draws it at its start.
    const seam = line.at(-1);
    const start = line[0];
    const opened =
      run.closed && seam !== undefined && start !== undefined && seam.radius !== start.radius
        ? [{ angle: start.angle, radius: seam.radius }, ...line]
        : line;
    const { plain, marked } = splitMarked(opened, ranges);
    for (const piece of plain) solid += polyline(piece, false);
    for (const piece of marked) dashed += polyline(piece, false);
  }
  return { solid, marked: dashed, lone };
}

/**
 * Each slot's mark, taken from its pixel column round the rim when slots are narrower than a device
 * pixel: every slot in a column is marked when any one is. Slots take equal angles (D11), so slot i
 * of n lies in column ⌊(i + ½) · columns / n⌋.
 *
 * @param marked - Each slot's own mark.
 * @param columns - The device pixels round the rim.
 * @returns The marks to hatch by, the slots' own when each slot spans a pixel or more.
 */
export function pixelMarks(marked: readonly boolean[], columns: number): readonly boolean[] {
  const count = marked.length;
  if (columns <= 0 || count <= columns) return marked;
  const columnOf = (slot: number): number => Math.floor(((slot + 0.5) * columns) / count);
  const hatched = new Set<number>();
  marked.forEach((mark, slot) => {
    if (mark) hatched.add(columnOf(slot));
  });
  return marked.map((_, slot) => hatched.has(columnOf(slot)));
}

/** An Area's paths: its whole fill, and the hatched pieces over its marked ranges. */
export type ClockAreaPaths = { readonly solid: string; readonly marked: string };

/** The region between a top curve and a base curve, as one closed outline. */
function region(top: readonly ClockPoint[], base: readonly ClockPoint[]): string {
  if (top.length < 2) return "";
  return polyline([...top, ...base.toReversed()], true);
}

/**
 * An Area between a series' tips and its bases: the zero ring, or the stack under it. Filled
 * even-odd, the region changes side where the curve crosses its base, and a closed loop fills the
 * ring between two closed outlines.
 *
 * @param values - The loop's numbers: the progress, then each slot's angles, base and tip.
 * @param slots - Each slot's state and mark, and the missing rule.
 * @param curve - The curve.
 * @param columns - The device pixels round the rim, below which slots hatch by pixel column, or
 *   undefined before the dial is measured.
 * @returns The paths.
 */
export function clockArea(
  values: readonly number[],
  slots: ClockSlots,
  curve: ChartCurve,
  columns?: number
): ClockAreaPaths {
  let solid = "";
  let hatched = "";
  // Slots narrower than a device pixel hatch by pixel column, as the columns decimate: a column is
  // hatched when any reading in it is marked, so the hatch draws one region per run of columns.
  const hatching = columns === undefined ? slots : { ...slots, marked: pixelMarks(slots.marked, columns) };
  for (const run of runsOf(slots)) {
    if (run.slots.length < 2) continue;
    const top = runCurve(values, run, curve, "tip");
    const base = runCurve(values, run, curve, "base");
    if (run.closed) solid += polyline(top, true) + polyline(base, true);
    else solid += region(top, base);
    const { angles, edges } = runPoints(values, run, curve, "tip");
    // The ranges lie inside both curves' samples, merged, so each hatch region is drawn once.
    const bounds: [number, number] = [
      Math.max(top[0]?.angle ?? 0, base[0]?.angle ?? 0),
      Math.min(top.at(-1)?.angle ?? 0, base.at(-1)?.angle ?? 0),
    ];
    const ranges = markedRanges(run, angles, hatching, bounds, stepsAcrossSlots(curve) ? edges : null);
    const bases = clipAll(base, ranges);
    clipAll(top, ranges).forEach((part, index) => {
      hatched += region(part, bases[index] ?? []);
    });
  }
  return { solid, marked: hatched };
}

/** How one wedge's radial span draws: its inner and outer radius, after any floor. */
export type WedgeSpan = (slot: number, base: number, tip: number) => readonly [number, number];

/**
 * A series' columns: one wedge per reading, from its base to its tip, over its slot's angle less
 * the pad, each in the path of its group, such as its paint step, so each wedge paints its own
 * value's side of a threshold (D23).
 *
 * @param values - The loop's numbers: the progress, then each slot's angles, base and tip.
 * @param slots - Each slot's state.
 * @param shown - The slots to draw, every slot or M4's decimated set.
 * @param pad - The pad angle in degrees and the radius it is measured at, from `wedgePad`.
 * @param span - The span a wedge draws, its floor applied.
 * @param groupOf - The group a slot's wedge draws in.
 * @returns Each group's path data.
 */
export function clockWedges(
  values: readonly number[],
  slots: ClockSlots,
  shown: readonly number[],
  pad: { readonly padAngle: number; readonly padRadius: number },
  span: WedgeSpan,
  groupOf: (slot: number) => string
): Map<string, string> {
  const groups = new Map<string, string>();
  // Every wedge shares the pad radius, so one generator draws them all.
  const wedge = arcWriter({ padRadius: pad.padRadius });
  for (const slot of shown) {
    if (slots.states[slot] !== "reading") continue;
    const [start, end, base, tip] = slotAt(values, slot);
    const [inner, outer] = span(slot, base, tip);
    if (!(outer > inner)) continue;
    const path = wedge({
      innerRadius: inner,
      outerRadius: outer,
      startAngle: start,
      endAngle: end,
      padAngle: pad.padAngle,
    });
    const group = groupOf(slot);
    groups.set(group, (groups.get(group) ?? "") + path);
  }
  return groups;
}

/**
 * A series' dots, one zero-length subpath per reading at its vertex, whose round caps draw each dot,
 * each in the path of its group.
 *
 * @param values - The loop's numbers.
 * @param slots - Each slot's state.
 * @param groupOf - The group a slot's dot draws in.
 * @returns Each group's path data.
 */
export function clockDots(
  values: readonly number[],
  slots: ClockSlots,
  groupOf: (slot: number) => string
): Map<string, string> {
  const groups = new Map<string, string>();
  slots.states.forEach((state, slot) => {
    if (state !== "reading") return;
    const { x, y } = clockXY(slotVertex(values, slot));
    const group = groupOf(slot);
    groups.set(group, `${groups.get(group) ?? ""}M${pathNumber(x)},${pathNumber(y)}h0`);
  });
  return groups;
}

/**
 * The slot that owns a slot's reading: its own, or for a slot a coarse series covers, the first
 * slot of its coarse slot, where the reading, its wedge and its vertex sit.
 *
 * @param states - The series' slot states.
 * @param slot - The slot.
 * @returns The owning slot.
 */
export function ownerSlot(states: readonly ClockSlotState[], slot: number): number {
  let at = slot;
  while (at > 0 && states[at] === "covered") at -= 1;
  return at;
}

/**
 * The vertex a slot's curve passes, where its dots and its active dot sit.
 *
 * @param values - The loop's numbers.
 * @param slot - The slot.
 * @returns The vertex in unrolled space.
 */
export function slotVertex(values: readonly number[], slot: number): ClockPoint {
  const [start, end, , tip] = slotAt(values, slot);
  return { angle: (start + end) / 2, radius: tip };
}

/**
 * A point in unrolled space as the dial's x and y.
 *
 * @param point - The point.
 * @returns The x and y in units of the outer radius.
 */
export function clockXY(point: ClockPoint): PolarPoint {
  const radians = (point.angle * Math.PI) / 180;
  return { x: point.radius * Math.sin(radians), y: -point.radius * Math.cos(radians) };
}

/**
 * The ring a value draws at, as path data: a full circle of one radius.
 *
 * @param radius - The ring's radius.
 * @returns The path data, empty for a radius of 0.
 */
export function ringPath(radius: number): string {
  if (!(radius > 0)) return "";
  const r = pathNumber(radius);
  return `M0,${pathNumber(-radius)}A${r},${r} 0 1 1 0,${r}A${r},${r} 0 1 1 0,${pathNumber(-radius)}Z`;
}

/**
 * A sector of the dial between two angles and two radii, as `ReferenceArea` and the band Scrubber
 * draw it.
 *
 * @param start - The start angle in degrees.
 * @param end - The end angle.
 * @param inner - The inner radius.
 * @param outer - The outer radius.
 * @returns The path data.
 */
export function sectorPath(start: number, end: number, inner: number, outer: number): string {
  return arcPath({ innerRadius: inner, outerRadius: outer, startAngle: start, endAngle: end });
}
