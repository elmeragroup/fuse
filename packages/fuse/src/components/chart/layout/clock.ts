/**
 * The clock dial's layout. A cycle, a day, an ISO week or a year in the data's zone, runs once
 * around the dial from 12 o'clock, and every slot takes an equal angle, so a 25-hour day draws
 * 25 equal slots and the labels follow their slots. The radius is area-true by default, a
 * threshold rings the dial at its value's radius, and a column keeps one device pixel along
 * its radius, which `floor-settle.ts` settles for a stack.
 */
import type { FloorAxis, FloorSpan } from "./floor-settle";
import { toDegrees } from "./polar-angle";
import { valueFloor } from "./value-floor";

/** The cycles a dial runs. */
export type ClockCycle = "day" | "week" | "year";

/** One slot's angles in degrees: where it starts, where it ends and where its vertex sits. */
export type SlotAngles = { readonly start: number; readonly end: number; readonly centre: number };

/**
 * The angles of slot i of n. Slot i spans `[360·i/n, 360·(i+1)/n)` clockwise from 12 o'clock, and its
 * vertex sits in the middle.
 *
 * @param index - The slot's index.
 * @param count - The cycle's slot count.
 * @returns The slot's angles.
 */
export function slotAngles(index: number, count: number): SlotAngles {
  const step = 360 / count;
  return { start: step * index, end: step * (index + 1), centre: step * (index + 0.5) };
}

/**
 * The angle of an instant inside a slot, where Now's hand points: the slot's start plus the share of
 * the slot that has passed.
 *
 * @param index - The slot's index.
 * @param passed - The share of the slot that has passed, 0 to 1.
 * @param count - The cycle's slot count.
 * @returns Degrees from 12 o'clock.
 */
export function instantAngle(index: number, passed: number, count: number): number {
  return (360 * (index + Math.min(1, Math.max(0, passed)))) / count;
}

/** How a value's radius grows: "radial" keeps area true, "linear" keeps radius true. */
export type RadiusScale = "radial" | "linear";

/** The dial's radii and value domain. */
export type ClockRadii = {
  /** The hole's radius, where the domain's minimum sits. */
  readonly inner: number;
  /** The rim's radius, where the domain's maximum sits. */
  readonly outer: number;
  readonly domain: readonly [number, number];
  readonly scale: RadiusScale;
};

/**
 * The radius of a value. Under "radial", r = √(lerp(inner², outer², t)), so the ring a value fills
 * from the hole grows in area as the value does. Under "linear", r = lerp(inner, outer, t). A value
 * outside the domain extrapolates, as a cartesian scale does.
 *
 * @param radii - The dial's radii, domain and scale.
 * @returns The map from a value to its radius.
 */
export function clockRadius(radii: ClockRadii): (value: number) => number {
  const { inner, outer, domain, scale } = radii;
  const [lo, hi] = domain;
  const span = hi - lo;
  return (value) => {
    const t = span === 0 ? 0 : (value - lo) / span;
    if (scale === "linear") return inner + (outer - inner) * t;
    const square = inner * inner + (outer * outer - inner * inner) * t;
    return Math.sqrt(Math.max(0, square));
  };
}

/** A wedge's pad: the pad angle and the radius d3's arc measures its width at. */
export type WedgePad = { readonly padAngle: number; readonly padRadius: number };

/**
 * The pad that cuts a constant-width gap between two wedges. d3's arc keeps its pad's width
 * `2·padRadius·sin(padAngle / 2)` at every radius, so the gap reads one width from hole to rim and
 * every wedge keeps an identical angle. The cut-off is measured at the rim, where a wedge is widest:
 * the gap stays while the rim arc leaves at least one device pixel of wedge after it, and vanishes
 * below that, where a gap would leave nothing to see. A wedge whose inner arc is narrower than the
 * gap tapers to a point at the hole, as a week of hours does. This is the dial's pad: `clockWedges`
 * narrows it for a short wedge whose outer arc the gap would erase, so the wedge keeps one device
 * pixel of arc at its tip.
 *
 * @param count - The cycle's slot count.
 * @param outer - The rim's radius in CSS pixels.
 * @param gap - The gap's width in CSS pixels.
 * @param dpr - Device pixels per CSS pixel.
 * @returns The pad, with a pad angle of 0 where the gap vanishes.
 */
export function wedgePad(count: number, outer: number, gap: number, dpr: number): WedgePad {
  const rimArc = (2 * Math.PI * outer) / count;
  if ((rimArc - gap) * dpr < 1 || !(gap > 0) || !(outer > 0)) return { padAngle: 0, padRadius: outer };
  return { padAngle: toDegrees(2 * Math.asin(Math.min(1, gap / (2 * outer)))), padRadius: outer };
}

/** The radius a dial's columns floor along: a floor axis that grows outward, its pixel ratio and its rim. */
export type ColumnAxis = FloorAxis & { readonly dpr: number; readonly outer: number };

/** A radius snapped to the device pixel grid. */
function snapRadius(radius: number, dpr: number): number {
  return Math.round(radius * dpr) / dpr;
}

/**
 * The axis a dial's columns floor along, their radius. It grows outward as a horizontal frame's
 * value axis grows to the right, so `floor-settle.ts` reads a wedge's radial span as it reads a
 * bar's, and the floor stays inside the rim. It reads no plot geometry.
 *
 * @param outer - The rim's radius in CSS pixels.
 * @param dpr - Device pixels per CSS pixel.
 * @returns The axis.
 */
export function columnAxis(outer: number, dpr: number): ColumnAxis {
  const limit = snapRadius(outer, dpr);
  return {
    orientation: "horizontal",
    dpr,
    outer,
    floorAcross: (from, to, [base, tip]) =>
      valueFloor(from, to, Math.abs(tip - base), tip < base ? "start" : "end", dpr, limit),
  };
}

/**
 * A column's radial span with the floor: its base and tip snapped to device pixels, widened to one
 * device pixel away from its base when a non-zero value would snap to nothing, and kept inside the
 * dial.
 *
 * @param axis - The dial's column axis.
 * @param base - The column's base radius in CSS pixels, the zero ring or the stack below it.
 * @param tip - Its tip radius.
 * @returns The span's inner and outer radius.
 */
export function columnSpan(axis: ColumnAxis, base: number, tip: number): readonly [number, number] {
  const { dpr } = axis;
  const [from, to] = [snapRadius(Math.min(base, tip), dpr), snapRadius(Math.max(base, tip), dpr)];
  return axis.floorAcross(from, to, [base, tip]);
}

/**
 * The span a stacked column hands the stack floors, which settle which segment keeps the floor on
 * each side of the zero ring through `settleFloors`. Its slot stands for its device pixel columns,
 * since every wedge of a dial takes an equal angle and no two slots share one.
 *
 * @param axis - The dial's column axis.
 * @param slot - The column's slot.
 * @param series - The series it draws, by config key.
 * @param base - The segment's base radius in CSS pixels.
 * @param tip - Its tip radius.
 * @returns The span.
 */
export function columnFloorSpan(
  axis: ColumnAxis,
  slot: number,
  series: string,
  base: number,
  tip: number
): FloorSpan {
  const { dpr } = axis;
  return {
    from: slot,
    to: slot + 1,
    series,
    segment: {
      base,
      tip,
      plainFrom: snapRadius(Math.min(base, tip), dpr),
      plainTo: snapRadius(Math.max(base, tip), dpr),
    },
  };
}
