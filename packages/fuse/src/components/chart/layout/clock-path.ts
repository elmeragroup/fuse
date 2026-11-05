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
import { arcPath } from "./arc-path";
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
function runsOf(slots: ClockSlots): Run[] {
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

/** The radius of a sampled curve at an angle, by its two samples either side. */
function radiusAt(line: readonly ClockPoint[], angle: number): number {
  let index = 1;
  while (index < line.length - 1 && (line[index]?.angle ?? 0) < angle) index += 1;
  const a = line[index - 1] ?? { angle, radius: 0 };
  const b = line[index] ?? a;
  const span = b.angle - a.angle;
  return span === 0 ? b.radius : a.radius + ((b.radius - a.radius) * (angle - a.angle)) / span;
}

/** The part of a sampled curve between two angles, its ends cut where they fall. */
function clip(line: readonly ClockPoint[], from: number, to: number): ClockPoint[] {
  const kept: ClockPoint[] = [{ angle: from, radius: radiusAt(line, from) }];
  for (const point of line) if (point.angle > from && point.angle < to) kept.push(point);
  kept.push({ angle: to, radius: radiusAt(line, to) });
  return kept;
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

/** Split a sampled curve into its plain pieces and the pieces inside the marked ranges. */
function splitMarked(line: readonly ClockPoint[], ranges: readonly (readonly [number, number])[]) {
  const plain: ClockPoint[][] = [];
  const marked: ClockPoint[][] = [];
  if (line.length === 0) return { plain, marked };
  const isMarked = (angle: number): boolean => ranges.some(([from, to]) => angle >= from && angle <= to);
  // Every range edge inside the curve, where a piece ends and the next starts.
  const cuts = ranges.flat().toSorted((a, b) => a - b);
  let piece: ClockPoint[] = [];
  let pieceMarked = false;
  const flush = (): void => {
    if (piece.length > 1) (pieceMarked ? marked : plain).push(piece);
  };
  line.forEach((point, index) => {
    const previous = line[index - 1];
    if (previous !== undefined) {
      for (const cut of cuts) {
        // A cut that falls on a sample splits there, and one between two samples splits between them.
        if (cut <= previous.angle || cut > point.angle) continue;
        const at = { angle: cut, radius: radiusAt([previous, point], cut) };
        piece.push(at);
        flush();
        piece = [at];
        // The piece after the cut takes the mark of its first stretch past the cut, past a step's
        // edge too, whose samples all lie at the cut's angle.
        const ahead =
          point.angle > cut
            ? point.angle
            : (line.slice(index + 1).find(({ angle }) => angle > cut)?.angle ?? cut);
        pieceMarked = isMarked((cut + ahead) / 2);
      }
    } else {
      // The first piece takes the mark of its first stretch, past a step's edge at its start.
      const ahead = line.find(({ angle }) => angle > point.angle)?.angle ?? point.angle;
      pieceMarked = isMarked((point.angle + ahead) / 2);
    }
    piece.push(point);
  });
  flush();
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
    const { plain, marked } = splitMarked(line, ranges);
    for (const piece of plain) solid += polyline(piece, false);
    for (const piece of marked) dashed += polyline(piece, false);
  }
  return { solid, marked: dashed, lone };
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
 * @returns The paths.
 */
export function clockArea(values: readonly number[], slots: ClockSlots, curve: ChartCurve): ClockAreaPaths {
  let solid = "";
  let hatched = "";
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
    for (const [from, to] of markedRanges(
      run,
      angles,
      slots,
      bounds,
      stepsAcrossSlots(curve) ? edges : null
    )) {
      hatched += region(clip(top, from, to), clip(base, from, to));
    }
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
  for (const slot of shown) {
    if (slots.states[slot] !== "reading") continue;
    const [start, end, base, tip] = slotAt(values, slot);
    const [inner, outer] = span(slot, base, tip);
    if (!(outer > inner)) continue;
    const path = arcPath({
      innerRadius: inner,
      outerRadius: outer,
      startAngle: start,
      endAngle: end,
      padAngle: pad.padAngle,
      padRadius: pad.padRadius,
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
 * The points a follower rides along a series' curve from one slot's vertex to another's, the short
 * way round the dial, a tie going clockwise. The route starts and ends on the two vertices. Where
 * the curve does not run between them, across another run or past an open run's end, it goes
 * straight from one vertex to the other and never extrapolates the curve.
 *
 * @param values - The loop's numbers.
 * @param slots - Each slot's state and mark, and the missing rule.
 * @param curve - The curve.
 * @param from - The slot the follower showed on.
 * @param to - The active slot.
 * @returns The route's points in unrolled space, from the old vertex to the new.
 */
export function curveRoute(
  values: readonly number[],
  slots: ClockSlots,
  curve: ChartCurve,
  from: number,
  to: number
): ClockPoint[] {
  const count = slots.states.length;
  const run = runsOf(slots).find((each) => each.slots.includes(from) && each.slots.includes(to));
  const start = slotVertex(values, from);
  const end = slotVertex(values, to);
  if (run === undefined) return [start, end];
  const ahead = (((to - from) % count) + count) % count;
  const forward = ahead <= count - ahead;
  const line = runCurve(values, run, curve, "tip");
  // The curve's samples hold one turn from the run's first vertex, so each end finds its angle there.
  const first = line[0]?.angle ?? 0;
  const inTurn = (angle: number): number => first + ((((angle - first) % 360) + 360) % 360);
  const a = inTurn(start.angle);
  let b = inTurn(end.angle);
  if (forward && b < a) b += 360;
  if (!forward && b > a) b -= 360;
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  // A closed run repeats a turn either side, so a step back across the seam, which ends before the
  // run's first vertex, and a step forward past its last both read the curve. An open run's short
  // way can leave its samples, across midnight, and then the ride goes straight (B8).
  if (!run.closed && (low < first - 1e-9 || high > (line.at(-1)?.angle ?? first) + 1e-9)) return [start, end];
  const shift = (turn: number) => line.map((point) => ({ angle: point.angle + turn, radius: point.radius }));
  const twice = run.closed ? [...shift(-360), ...line, ...shift(360)] : line;
  const route = twice.filter((point) => point.angle > low && point.angle < high);
  const path = [
    { angle: a, radius: start.radius },
    ...(forward ? route : route.toReversed()),
    { angle: b, radius: end.radius },
  ];
  return path;
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
