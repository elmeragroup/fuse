/**
 * The measured plot in CSS pixels, and the one projection every SVG mark, the focus ring and the
 * tooltip anchor draw through. Root measures the plot box, and each mark asks this module where a
 * slot's band, a bar or a value lands. The browser draws an SVG layer's origin on the device pixel
 * nearest the plot's page position, and an HTML box's edge on the device pixel nearest its own page
 * position. Every edge here snaps the same way, as the page position's pixel less the origin's
 * pixel, so it is always a whole number of device pixels from the layer's origin and draws sharp,
 * and it lands on the pixel the browser gives the focused option's box. Sharing one snap is what
 * keeps a bar, its crosshair band and the focused option on one column. Each frame also holds one
 * slot grid, which places every slot band, slot centre and bar, so every gap between bars draws
 * the same whole device pixels.
 */
import { DECIMATE_ABOVE } from "./decimate";
import { linearScale, scaleValue } from "./linear-scale";
import type { LinearScale } from "./linear-scale";

/** The plot box as Root measured it. */
export type PlotBox = {
  /** The box's width in CSS pixels. */
  readonly width: number;
  /** The box's height in CSS pixels. */
  readonly height: number;
  /** Device pixels per CSS pixel, which browser zoom changes too. */
  readonly dpr: number;
  /** The box's left edge in viewport CSS pixels, which rounds the way the browser rounds a box. */
  readonly left: number;
  /** The box's top edge in viewport CSS pixels. */
  readonly top: number;
};

/** The bar spacing a theme or a consumer sets through `--chart-band-gap`, `--chart-bar-gap` and `--chart-bar-seam`. */
export type BarMetrics = {
  /** The share of each band left empty between categories, 0 to 1. */
  readonly bandGap: number;
  /** The gap between the bars of a BarGroup, in CSS pixels. */
  readonly barGap: number;
  /** The gap between two segments of one stack, in CSS pixels. */
  readonly seam: number;
};

/** A Bar's sub-band inside a BarGroup: its place and the group's count of sub-bands. */
export type SubBand = { readonly index: number; readonly count: number };

/** The whole band, for a Bar outside a BarGroup. */
export const WHOLE_BAND: SubBand = { index: 0, count: 1 };

/**
 * Where a layout's slot bands lie along the slot axis, worked out once per frame so every lookup
 * is arithmetic. Under `"exact"` every band is the same whole number of device pixels, and the
 * bands start where the leftover pixels centre. Under `"spread"` each band edge snaps on its own,
 * so neighbouring bands share their edge and differ by at most a device pixel.
 */
export type SlotGrid = {
  /** How the bands divide the plot. */
  readonly rule: "exact" | "spread";
  /** The first band's start in CSS pixels from the plot's drawn origin, 0 under `"spread"`. */
  readonly start: number;
  /**
   * One band's length in CSS pixels: whole device pixels under `"exact"`, and the plot's length over
   * the count under `"spread"`.
   */
  readonly step: number;
  /** One slot's whole device pixels, its pitch rounded down, which a bar gap rounds from. */
  readonly whole: number;
};

/** One layout drawn into the measured plot. */
export type PlotFrame = {
  readonly box: PlotBox;
  readonly orientation: "vertical" | "horizontal";
  /** The slots of the effective window, at least 1. */
  readonly count: number;
  /** The value domain mapped onto the screen coordinate along the value axis. */
  readonly value: LinearScale;
  /** The slot bands every slot-axis lookup reads. */
  readonly grid: SlotGrid;
};

/** A rectangle in CSS pixels from the plot's top left. */
export type PlotRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Build the frame of one layout. Under `orientation="vertical"` slots run left to right and the
 * domain's maximum sits at the top. Under `"horizontal"` slots run top to bottom and the maximum
 * sits at the right.
 *
 * Under a band x scale every slot takes the same whole device pixels, at least one, from a start
 * that splits the leftover between both ends: the `"exact"` grid. A point scale, a window too
 * dense for a device pixel per slot and a decimated window spread instead.
 *
 * @param box - The measured plot box.
 * @param orientation - Root's orientation.
 * @param count - The effective window's slot count.
 * @param domain - The layout's value domain, lower bound first.
 * @param xScale - Root's x scale, "band" by default.
 * @returns The frame.
 */
export function plotFrame(
  box: PlotBox,
  orientation: "vertical" | "horizontal",
  count: number,
  domain: readonly [number, number],
  xScale: "band" | "point" = "band"
): PlotFrame {
  const range: readonly [number, number] = orientation === "vertical" ? [box.height, 0] : [0, box.width];
  const slots = Math.max(1, count);
  const length = orientation === "vertical" ? box.width : box.height;
  const origin = orientation === "vertical" ? box.left : box.top;
  const { dpr } = box;
  // The drawn plot's whole device pixels, so the last band ends on the plot's drawn edge.
  const pixels = Math.round(snapFrom(origin, dpr, length) * dpr);
  const whole = Math.floor(pixels / slots);
  const leftover = pixels - slots * whole;
  const exact = xScale === "band" && slots <= DECIMATE_ABOVE && whole >= 1;
  const grid: SlotGrid = exact
    ? { rule: "exact", start: Math.floor(leftover / 2) / dpr, step: whole / dpr, whole }
    : { rule: "spread", start: 0, step: length / slots, whole: Math.floor((length * dpr) / slots) };
  return { box, orientation, count: slots, value: linearScale(domain, range), grid };
}

/** How far from a tie, in device pixels, a coordinate still counts as the tie. */
const TIE = 1e-6;

/**
 * Round a page coordinate to a device pixel. A coordinate exactly between two device pixels rounds
 * toward the top left, as the browser snaps a box's edge. A snapped coordinate on a plot whose
 * origin lies on such a tie lies on one too, give or take float error, so a coordinate within `TIE`
 * of a tie counts as the tie, and snapping a snapped coordinate returns it.
 */
function pixel(dpr: number, at: number): number {
  // Adding 0 turns the -0 that rounding -0.5 up gives into 0.
  return (Math.ceil(at * dpr - 0.5 - TIE) + 0) / dpr;
}

/** Where a page coordinate falls inside its device pixel, from 0 up to 1. */
function pixelPhase(dpr: number, at: number): number {
  const device = at * dpr;
  return device - Math.floor(device);
}

/** Whether two page coordinates fall at the same place inside their device pixels, within `TIE`. */
function samePhase(dpr: number, a: number, b: number): boolean {
  const apart = Math.abs(pixelPhase(dpr, a) - pixelPhase(dpr, b));
  return Math.min(apart, 1 - apart) <= TIE;
}

/**
 * Whether two plot boxes snap every coordinate alike. Each snapped coordinate is a difference from
 * the origin's own device pixel, so only the size, the pixel ratio and where the origin falls inside
 * its device pixel count. A move by whole device pixels, as most scrolls are, changes nothing drawn.
 *
 * @param a - One box.
 * @param b - The other.
 * @param within - How far two sizes may lie apart and count as one, as a size serialized to three
 *   decimals and the same size in full precision do. 0 by default.
 * @returns Whether every mark draws the same in both.
 */
export function sameSnapping(a: PlotBox, b: PlotBox, within = 0): boolean {
  return (
    Math.abs(a.width - b.width) <= within &&
    Math.abs(a.height - b.height) <= within &&
    a.dpr === b.dpr &&
    samePhase(a.dpr, a.left, b.left) &&
    samePhase(a.dpr, a.top, b.top)
  );
}

/** Snap a coordinate measured from an origin at a page position. */
function snapFrom(origin: number, dpr: number, at: number): number {
  return pixel(dpr, origin + at) - pixel(dpr, origin);
}

/**
 * Snap a horizontal coordinate to the device pixel the browser gives a box edge there.
 *
 * @param box - The measured plot box.
 * @param x - CSS pixels from the plot's left edge.
 * @returns A whole number of device pixels from the plot's drawn origin.
 */
export function snapX(box: PlotBox, x: number): number {
  return snapFrom(box.left, box.dpr, x);
}

/**
 * Snap a vertical coordinate to the device pixel the browser gives a box edge there.
 *
 * @param box - The measured plot box.
 * @param y - CSS pixels from the plot's top edge.
 * @returns A whole number of device pixels from the plot's drawn origin.
 */
export function snapY(box: PlotBox, y: number): number {
  return snapFrom(box.top, box.dpr, y);
}

/**
 * Snap a coordinate along the slot axis: an x under a vertical frame and a y under a horizontal one.
 *
 * @param frame - The layout's frame.
 * @param at - CSS pixels from the plot's left or top edge.
 * @returns The snapped coordinate.
 */
export function snapAlong(frame: PlotFrame, at: number): number {
  return frame.orientation === "vertical" ? snapX(frame.box, at) : snapY(frame.box, at);
}

/**
 * Snap a coordinate along the value axis: a y under a vertical frame and an x under a horizontal one.
 *
 * @param frame - The layout's frame.
 * @param at - CSS pixels from the plot's top or left edge.
 * @returns The snapped coordinate.
 */
export function snapAcross(frame: PlotFrame, at: number): number {
  return frame.orientation === "vertical" ? snapY(frame.box, at) : snapX(frame.box, at);
}

/**
 * The plot's length along the slot axis.
 *
 * @param frame - The layout's frame.
 * @returns The width under a vertical frame, the height under a horizontal one, CSS pixels.
 */
export function alongLength(frame: PlotFrame): number {
  return frame.orientation === "vertical" ? frame.box.width : frame.box.height;
}

/** The plot's length along the value axis. */
function acrossLength(frame: PlotFrame): number {
  return frame.orientation === "vertical" ? frame.box.height : frame.box.width;
}

/**
 * A coordinate along the value axis as the share of the plot from the axis maximum, as CSS places
 * a value's HTML: down from the top under a vertical frame, in from the right under a horizontal one.
 *
 * @param frame - The layout's frame.
 * @param at - CSS pixels from the plot's top or left edge.
 * @returns The share in percent, 0 at the maximum.
 */
export function valueShare(frame: PlotFrame, at: number): number {
  const length = acrossLength(frame);
  if (length === 0) return 0;
  return ((frame.orientation === "vertical" ? at : length - at) / length) * 100;
}

/**
 * A coordinate along the slot axis as the share of the plot from its first slot.
 *
 * @param frame - The layout's frame.
 * @param at - CSS pixels from the plot's left or top edge.
 * @returns The share in percent.
 */
export function slotShare(frame: PlotFrame, at: number): number {
  const length = alongLength(frame);
  return length === 0 ? 0 : (at / length) * 100;
}

/**
 * Where a value lands along the value axis, unsnapped: its y under a vertical frame and its x
 * under a horizontal one.
 *
 * @param frame - The layout's frame.
 * @param value - The value.
 * @returns CSS pixels from the plot's top or left edge.
 */
export function valueAt(frame: PlotFrame, value: number): number {
  return scaleValue(frame.value, value);
}

/**
 * The band a slot takes along the slot axis, snapped, so neighbouring bands share their edge.
 * Under the `"exact"` grid every band takes the same whole device pixels.
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @returns The band's start and end in CSS pixels.
 */
export function slotBand(frame: PlotFrame, position: number): readonly [number, number] {
  const { grid } = frame;
  if (grid.rule === "exact") return [slotEdge(frame, position), slotEdge(frame, position + 1)];
  return snapSpan(frame, position * grid.step, (position + 1) * grid.step);
}

/** A band edge of the `"exact"` grid: whole device pixels from the drawn origin. */
function slotEdge(frame: PlotFrame, position: number): number {
  const { grid, box } = frame;
  return Math.round((grid.start + position * grid.step) * box.dpr) / box.dpr;
}

/**
 * The run the slot bands take along the slot axis, as a share of the plot's length: the first
 * band's start and the last band's end. HTML placed by slot shares, such as the x axis labels and
 * the pointer's slot, maps a share inside this run, so it keeps to the bands under the `"exact"`
 * grid, whose leftover pixels lie at both ends.
 *
 * @param frame - The layout's frame.
 * @returns The run's start and end, each from 0 to 1.
 */
export function slotRun(frame: PlotFrame): readonly [number, number] {
  // A spread grid's run is the whole plot.
  const length = alongLength(frame) || 1;
  return [slotAxisAt(frame, 0) / length, slotAxisAt(frame, 1) / length];
}

/**
 * The plot's leftover pixels before and after the run the slot bands take, which the x axis's
 * margins and the Line and Area layers' clips read as `--_run-before` and `--_run-after`.
 *
 * @param frame - The layout's frame, or null before the plot is measured.
 * @returns The two lengths in CSS pixels, both 0 where the run spans the whole plot or before
 *   the plot is measured.
 */
export function runMargins(frame: PlotFrame | null): readonly [number, number] {
  if (frame === null) return [0, 0];
  const [from, to] = slotRun(frame);
  const length = alongLength(frame);
  return [from * length, (1 - to) * length];
}

/**
 * Whether a coordinate along the slot axis lies outside the run the slot bands take, as a sliding
 * vertex's does, in the plot's leftover pixels or past its ends.
 */
function outsideRun(frame: PlotFrame, at: number): boolean {
  return at < slotAxisAt(frame, 0) || at > slotAxisAt(frame, 1);
}

/**
 * Where a share of the slot axis lands, in the run the slot bands take, as a slot reference's
 * coordinate does.
 *
 * @param frame - The layout's frame.
 * @param share - The share of the slot axis from its first slot, 0 to 1.
 * @returns CSS pixels from the plot's left or top edge, unsnapped.
 */
export function slotAxisAt(frame: PlotFrame, share: number): number {
  const { start, step } = frame.grid;
  return start + share * frame.count * step;
}

/**
 * The centre of a slot along the slot axis, unsnapped, the number a slot reference tweens. Band
 * slots centre in their band, and point slots run from the first edge to the last. A position
 * outside the window lies outside the plot.
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @param xScale - Root's x scale.
 * @returns The centre in CSS pixels.
 */
export function slotCentreAt(frame: PlotFrame, position: number, xScale: "band" | "point"): number {
  if (xScale === "band") return frame.grid.start + (position + 0.5) * frame.grid.step;
  const length = alongLength(frame);
  return frame.count === 1 ? length / 2 : (position * length) / (frame.count - 1);
}

/**
 * The centre of a slot along the slot axis, snapped.
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @param xScale - Root's x scale.
 * @returns The centre in CSS pixels.
 */
export function centreOf(frame: PlotFrame, position: number, xScale: "band" | "point"): number {
  return snapAlong(frame, slotCentreAt(frame, position, xScale));
}

/**
 * The pixel columns a slot owns for focus and the tooltip: its band under a band scale, and a
 * band-wide cell centred on the point under a point scale, clipped to the plot.
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @param xScale - Root's x scale.
 * @returns The start and end along the slot axis in CSS pixels, snapped.
 */
export function optionBand(
  frame: PlotFrame,
  position: number,
  xScale: "band" | "point"
): readonly [number, number] {
  if (xScale === "band") return slotBand(frame, position);
  const length = alongLength(frame);
  // The unsnapped centre, which lies inside the plot. The last point's snapped centre can lie past
  // the plot's end, which would leave the clipped band empty.
  const centre = slotCentreAt(frame, position, xScale);
  const half = length / frame.count / 2;
  return snapSpan(frame, Math.max(0, centre - half), Math.min(length, centre + half));
}

/**
 * The width every rule draws at: 1 px rounded down to whole device pixels, at least one, as the
 * browser draws a 1 px CSS border. Grid lines, reference lines, the active value line and the line
 * crosshair all take it, so both edges of every rule lie on the device pixel grid at any pixel
 * ratio, and each rule's stroke and its label's offset read it.
 *
 * @param box - The measured plot box.
 * @returns The width in CSS pixels: 1 at 1x, 2x and 3x, 0.8 at 1.25x and 2/3 at 1.5x.
 */
export function hairline(box: PlotBox): number {
  return Math.max(1, Math.floor(box.dpr)) / box.dpr;
}

/**
 * A missing tick's width: 2 px rounded down to whole device pixels, at least one, so the tick draws
 * crisp at any pixel ratio, as a rule does.
 *
 * @param box - The measured plot box.
 * @returns The width in CSS pixels: 2 at 1x, 1.5x and 2x, 1.6 at 1.25x.
 */
export function tickWidth(box: PlotBox): number {
  return Math.max(1, Math.floor(2 * box.dpr)) / box.dpr;
}

/**
 * A rule's width as a tween frame draws it: rounded down to whole device pixels, at least one, so
 * a width moving between two hairlines stays crisp in every frame.
 *
 * @param box - The measured plot box.
 * @param width - The tweened width in CSS pixels.
 * @returns The width in CSS pixels.
 */
export function wholeWidth(box: PlotBox, width: number): number {
  return Math.max(1, Math.floor(width * box.dpr + 1e-6)) / box.dpr;
}

/**
 * Where a point mark lands along the slot axis: a line's vertex, a dot, a marker or the active dot.
 * Inside the slot run it is the centre of the hairline `slotLineAt` draws for the slot the
 * coordinate lies in, the column the line crosshair takes, so the active dot sits on the crosshair
 * and every dot on its line's vertex, at any pixel ratio and however dense the slots. A coordinate
 * outside the run, as a sliding vertex takes, snaps where it is, so vertices that slide in or out
 * keep their own places.
 *
 * @param frame - The layout's frame.
 * @param at - The unsnapped coordinate along the slot axis.
 * @param xScale - Root's x scale.
 * @returns The point's coordinate in CSS pixels.
 */
export function pointAlong(frame: PlotFrame, at: number, xScale: "band" | "point"): number {
  const width = hairline(frame.box);
  if (outsideRun(frame, at)) return snapAlong(frame, at) + width / 2;
  // The hairline `slotLineAt` draws here, no wider than the band it sits in.
  const band = slotBandAt(frame, at, xScale);
  const line = Math.min(width, band[1] - band[0]);
  const start = lineStart(frame, at, band, line);
  return (start + (start + line)) / 2;
}

/**
 * Move a snapped coordinate of a straight stroke's centre line so the stroke covers whole device
 * pixels: a stroke an odd number of device pixels wide centres on the middle of a device pixel,
 * half a device pixel past the snapped edge, and an even one, or a fill, on the edge itself.
 *
 * @param frame - The layout's frame.
 * @param snapped - The coordinate, on a device pixel edge.
 * @param width - The stroke's width in CSS pixels, 0 for a fill.
 * @returns The coordinate the stroke's centre line takes.
 */
export function strokeCentre(frame: PlotFrame, snapped: number, width: number): number {
  const { dpr } = frame.box;
  return Math.round(width * dpr) % 2 === 1 ? snapped + 0.5 / dpr : snapped;
}

/**
 * The span a step run takes along the slot axis around its own slot's centre: the bands of the
 * slot's cells, with the pixel floor, so neighbouring runs share their edges, and the run snapped
 * where its centre lies outside the slot run, as a sliding vertex's does. A coarse series' slot covers
 * several of Root's cells, such as an hour's 4 quarters.
 *
 * @param frame - The layout's frame.
 * @param centre - The own slot's unsnapped centre.
 * @param cells - How many of Root's cells the own slot covers, 1 by default.
 * @returns The run's start and end in CSS pixels.
 */
export function cellRun(frame: PlotFrame, centre: number, cells = 1): readonly [number, number] {
  const { step, start } = frame.grid;
  const half = (step * cells) / 2;
  if (outsideRun(frame, centre)) return [snapAlong(frame, centre - half), snapAlong(frame, centre + half)];
  // The first cell: the one the centre lies in for one cell, and for several, the one the run's
  // start lies in, which the centre's half a run before rounds to.
  // A plot of no length spreads its cells over nothing, so a run starts at the first.
  const first =
    step === 0
      ? 0
      : cells === 1
        ? Math.floor((centre - start) / step)
        : Math.round((centre - half - start) / step);
  const position = Math.min(Math.max(first, 0), frame.count - cells);
  const band: readonly [number, number] = [
    slotBand(frame, position)[0],
    slotBand(frame, Math.min(position + cells - 1, frame.count - 1))[1],
  ];
  return snapSpan(frame, centre - half, centre + half, band);
}

/**
 * The hairline that marks a slot, as a line crosshair and a slot reference line draw it: the rules'
 * `hairline`, no wider than the slot's option band. It starts at the slot's snapped centre, moved
 * inside the band's device pixels, so the line marks the band it stands for at either end of the
 * plot, however dense the slots and at any pixel ratio.
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @param xScale - Root's x scale.
 * @returns The line's start and end along the slot axis, snapped.
 */
export function slotLine(
  frame: PlotFrame,
  position: number,
  xScale: "band" | "point"
): readonly [number, number] {
  const [start, end] = optionBand(frame, position, xScale);
  const width = Math.min(hairline(frame.box), end - start);
  return slotLineAt(frame, slotCentreAt(frame, position, xScale), xScale, width);
}

/**
 * The hairline a slot reference draws at a tweened, unsnapped centre inside the plot: from the
 * centre, snapped, moved inside the device pixels of the band of the slot the centre lies in, as
 * `slotLine` draws it at rest. Whether the line shows is decided before this, from the centre, so
 * the band only ever contains a line that lies in the plot.
 *
 * @param frame - The layout's frame.
 * @param centre - The tweened centre along the slot axis, inside the plot.
 * @param xScale - Root's x scale.
 * @param width - The line's width, whole device pixels.
 * @returns The line's start and end along the slot axis, snapped.
 */
export function slotLineAt(
  frame: PlotFrame,
  centre: number,
  xScale: "band" | "point",
  width: number
): readonly [number, number] {
  const at = lineStart(frame, centre, slotBandAt(frame, centre, xScale), width);
  return [at, at + width];
}

/**
 * The band of the slot a coordinate along the slot axis lies in, as `optionBand` gives it: the
 * nearest point, or the band that holds it, the first or last band past either end of the grid.
 *
 * @param frame - The layout's frame.
 * @param at - CSS pixels from the plot's left or top edge, unsnapped.
 * @param xScale - Root's x scale.
 * @returns The band's start and end along the slot axis, snapped.
 */
export function slotBandAt(
  frame: PlotFrame,
  at: number,
  xScale: "band" | "point"
): readonly [number, number] {
  const { grid, count } = frame;
  const length = alongLength(frame);
  // A plot of no length spreads its bands over nothing, so every coordinate takes the first band.
  const nearest =
    xScale === "band"
      ? grid.step > 0
        ? Math.floor((at - grid.start) / grid.step)
        : 0
      : Math.round((length === 0 ? 0 : at / length) * Math.max(0, count - 1));
  return optionBand(frame, Math.min(Math.max(nearest, 0), count - 1), xScale);
}

/** Where a line `width` wide starts: at its snapped centre, moved inside the band's device pixels. */
function lineStart(frame: PlotFrame, centre: number, band: readonly [number, number], width: number): number {
  return Math.min(Math.max(snapAlong(frame, centre), band[0]), band[1] - width);
}

/**
 * The span a bar draws inside its slot's band: the band less one bar gap, every edge a whole
 * number of device pixels from the plot's drawn origin. On the `"exact"` grid every band is the
 * same, so every bar of a layout is the same width and every gap the same. The gap is `bandGap` of
 * a band's device pixels, rounded and at least one, split with the smaller half before the bar. A
 * band of one device pixel, or a `bandGap` of 0, has none. A BarGroup splits the rest into
 * sub-bands of the same whole device pixels, `barGap` apart, rounded to whole device pixels and at
 * least one, and its remainder splits between both ends. A band too narrow for a device pixel per
 * bar, as a window denser than the device pixels draws, keeps the ideal shares and the pixel floor
 * instead, and gaps that would use up the band take half of it, so every bar still draws a device
 * pixel among its band's.
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @param metrics - The bar spacing.
 * @param sub - The Bar's sub-band.
 * @param span - How many slots the band covers, more than 1 for a coarse series' slot, whose bands
 *   lose the gap once around its bar, so an hourly bar on a quarter-hour grid fills its hour.
 * @returns The bar's start and end along the slot axis in CSS pixels, on the device pixel grid.
 */
export function barSpan(
  frame: PlotFrame,
  position: number,
  metrics: BarMetrics,
  sub: SubBand,
  span = 1
): readonly [number, number] {
  const { dpr } = frame.box;
  const { grid } = frame;
  // The run's own edges in device pixels, which the next run shares even where slots are narrower
  // than a device pixel and their floored bands overlap.
  const edge = (at: number) =>
    grid.rule === "exact"
      ? Math.round(grid.start * dpr) + at * grid.whole
      : Math.round(snapAlong(frame, at * grid.step) * dpr);
  // A band of one device pixel has no room for a gap.
  const gap =
    metrics.bandGap > 0 && grid.whole > 1 ? Math.max(1, Math.round(grid.whole * metrics.bandGap)) : 0;
  const from = edge(position) + Math.floor(gap / 2);
  const to = edge(position + span) - Math.ceil(gap / 2);
  const between = sub.count > 1 && metrics.barGap > 0 ? Math.max(1, Math.round(metrics.barGap * dpr)) : 0;
  const free = to - from - (sub.count - 1) * between;
  // Every sub-band takes the same whole device pixels, and the remainder splits between both ends.
  const each = Math.floor(free / sub.count);
  if (each >= 1) {
    const start = from + Math.floor((free - sub.count * each) / 2) + sub.index * (each + between);
    return [start / dpr, (start + each) / dpr];
  }
  const band = grid.step * span;
  const inside = band * (1 - metrics.bandGap);
  const gaps = sub.count - 1;
  // Gaps that would leave the bars less than a device pixel each take half the band.
  const subGap =
    gaps && (inside - gaps * metrics.barGap >= sub.count / dpr ? metrics.barGap : inside / (2 * gaps));
  const size = (inside - gaps * subGap) / sub.count;
  const start = slotAxisAt(frame, position / frame.count) + (band - inside) / 2 + sub.index * (size + subGap);
  // A bar keeps its pixels among its bands', so the crosshair band and the focused option cover it.
  return snapBarSpan(frame, start, start + size, [
    slotBand(frame, position)[0],
    slotBand(frame, position + span - 1)[1],
  ]);
}

/**
 * Snap a bar body's span along the slot axis, as a tween frame between two resting bars draws it.
 * The width snaps once, rounded down to whole device pixels. Only the start snaps after that. It
 * starts the rounded width centred on the span's middle and moves to its device pixel, so the body
 * keeps its middle within half a device pixel and a frame never widens a bar past its unsnapped
 * width. A span already on the device pixel grid, as `barSpan` gives every resting bar, snaps to
 * itself, so a tween's first and last frames draw the resting edges. A span narrower than a device
 * pixel, or an empty one, takes `snapSpan`'s pixel floor.
 *
 * @param frame - The layout's frame.
 * @param start - The span's start along the slot axis.
 * @param end - The span's end, at or after its start.
 * @param within - A snapped container the span lies in, such as the bar's band, whose pixels a
 *   span narrower than a device pixel keeps its pixel among.
 * @returns The snapped start and end.
 */
export function snapBarSpan(
  frame: PlotFrame,
  start: number,
  end: number,
  within?: readonly [number, number]
): readonly [number, number] {
  const { dpr } = frame.box;
  // A width already on the grid, as a tween between two snapped bars carries, stays whole.
  const pixels = Math.floor((end - start) * dpr + TIE);
  if (pixels < 1) return floorSpan(frame, "along", start, end, within);
  const width = pixels / dpr;
  const from = snapAlong(frame, (start + end - width) / 2);
  return [from, from + width];
}

/**
 * Snap a span along the slot axis, each edge to its own device pixel, so neighbouring spans share
 * their edges, as slot bands, step runs and slot references do. A bar's body takes `snapBarSpan`,
 * which snaps its width once instead. This is the one owner of the pixel floor, which every mark
 * and every interaction band takes: a span wider than zero keeps at least one device pixel, and an
 * empty span stays empty. A span narrower than a device pixel snaps both edges to one, and keeps the
 * device pixel on the side of that edge where its middle lies, so a bar and the band around it
 * take the same pixel. At the plot's ends the pixel stays inside the plot, and inside `within`
 * when the span lies in a snapped container, such as a bar in its band.
 *
 * @param frame - The layout's frame.
 * @param start - The span's start along the slot axis.
 * @param end - The span's end, at or after its start.
 * @param within - A snapped container the span lies in, whose pixels a kept pixel stays among.
 * @returns The snapped start and end.
 */
export function snapSpan(
  frame: PlotFrame,
  start: number,
  end: number,
  within?: readonly [number, number]
): readonly [number, number] {
  return floorSpan(frame, "along", start, end, within);
}

/**
 * Snap a span across the value axis with the same pixel floor, as a value reference band takes it,
 * so a band inside the plot narrower than a device pixel keeps the pixel its middle lies in.
 *
 * @param frame - The layout's frame.
 * @param start - The span's start along the value axis.
 * @param end - The span's end, at or after its start.
 * @returns The snapped start and end, inside the plot.
 */
export function snapAcrossSpan(frame: PlotFrame, start: number, end: number): readonly [number, number] {
  return floorSpan(frame, "across", start, end);
}

/** The pixel floor on either axis, which `snapSpan` and `snapAcrossSpan` describe. */
function floorSpan(
  frame: PlotFrame,
  axis: "along" | "across",
  start: number,
  end: number,
  within?: readonly [number, number]
): readonly [number, number] {
  const snap = axis === "along" ? snapAlong : snapAcross;
  const from = snap(frame, start);
  const to = snap(frame, end);
  if (to > from || end <= start) return [from, to];
  const { box } = frame;
  const device = 1 / box.dpr;
  const onX = (axis === "along") === (frame.orientation === "vertical");
  const origin = onX ? box.left : box.top;
  // The shared edge's page position against the span's middle, both on the page.
  const before = origin + (start + end) / 2 < pixel(box.dpr, origin) + from;
  const length = axis === "along" ? alongLength(frame) : acrossLength(frame);
  const [low, high] = within ?? [0, snap(frame, length)];
  // Snapped edges are differences of page pixels, off by float error, so the bounds allow it.
  const kept = (before && from - device >= low - TIE) || from + device > high + TIE ? from - device : from;
  // A span narrower than a pixel inside a container's pixels keeps one of them.
  const shifted = Math.min(Math.max(kept, low), Math.max(low, high - device));
  return [shifted, shifted + device];
}

/**
 * Snap a mark's drawn body: its slot-axis edges through `snapBarSpan`, so a body on the grid draws
 * as it is and a narrower one keeps the pixel floor, and its value-axis edges onto the device
 * pixels, so a zero value stays flat. Every rectangle a bar, its look's parts, the active overlay,
 * a path column or the tooltip row draws comes through here, after any shaping, so nothing narrows
 * a body after the floor.
 *
 * @param frame - The layout's frame.
 * @param rect - The unsnapped body.
 * @param within - The snapped span of the bar a shaped part lies in, which its floor keeps its
 *   pixel inside, as a strip narrower than a device pixel inside a one-pixel bar takes that pixel.
 * @returns The snapped body.
 */
export function snapBody(frame: PlotFrame, rect: PlotRect, within?: readonly [number, number]): PlotRect {
  const vertical = frame.orientation === "vertical";
  const [alongStart, alongSize] = vertical ? [rect.x, rect.width] : [rect.y, rect.height];
  const [acrossStart, acrossSize] = vertical ? [rect.y, rect.height] : [rect.x, rect.width];
  const [a0, a1] = snapBarSpan(frame, alongStart, alongStart + Math.max(0, alongSize), within);
  const c0 = snapAcross(frame, Math.min(acrossStart, acrossStart + acrossSize));
  const c1 = snapAcross(frame, Math.max(acrossStart, acrossStart + acrossSize));
  return vertical
    ? { x: a0, y: c0, width: a1 - a0, height: c1 - c0 }
    : { x: c0, y: a0, width: c1 - c0, height: a1 - a0 };
}

/**
 * A snapped rectangle from a span along the slot axis and two coordinates along the value axis.
 *
 * @param frame - The layout's frame.
 * @param along - The start and end along the slot axis.
 * @param across - Two coordinates along the value axis, in either order.
 * @returns The rectangle, every edge on the device pixel grid, through `snapBody`.
 */
export function frameRect(
  frame: PlotFrame,
  along: readonly [number, number],
  across: readonly [number, number]
): PlotRect {
  const start = Math.min(across[0], across[1]);
  const size = Math.abs(across[1] - across[0]);
  const span = Math.max(0, along[1] - along[0]);
  return snapBody(
    frame,
    frame.orientation === "vertical"
      ? { x: along[0], width: span, y: start, height: size }
      : { x: start, width: size, y: along[0], height: span }
  );
}

/**
 * The centre of a stroke whose near edge sits at a coordinate, snapped, so both edges of a rule
 * land on device pixels and it draws sharp at 1x, 2x and every zoom. A rule starts at its
 * coordinate, as a CSS border does, so the zero line runs just past the bars' base.
 *
 * @param snapped - The snap of the rule's axis, `snapX` or `snapY` bound to a box.
 * @param at - The rule's unsnapped near edge.
 * @param width - The stroke width in CSS pixels, 1 by default.
 * @returns The stroke's centre coordinate.
 */
function ruleAt(snapped: (at: number) => number, at: number, width = 1): number {
  return snapped(at) + width / 2;
}

/** A rule's two endpoints in CSS pixels from the plot's top left, as SVG `line` attributes. */
export type PlotRule = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/**
 * A `hairline` rule across the whole plot: a horizontal one at a y, a vertical one at an x. Every
 * placement sets all four endpoints, so a rule that changes direction keeps none of the old ones.
 *
 * @param box - The measured plot box.
 * @param direction - Which way the rule runs on screen.
 * @param at - The rule's unsnapped near edge.
 * @returns The rule's endpoints, its centre on the snapped coordinate plus half a hairline.
 */
export function ruleAcross(box: PlotBox, direction: "horizontal" | "vertical", at: number): PlotRule {
  const width = hairline(box);
  if (direction === "horizontal") {
    const y = ruleAt((value) => snapY(box, value), at, width);
    return { x1: 0, y1: y, x2: box.width, y2: y };
  }
  const x = ruleAt((value) => snapX(box, value), at, width);
  return { x1: x, y1: 0, x2: x, y2: box.height };
}
