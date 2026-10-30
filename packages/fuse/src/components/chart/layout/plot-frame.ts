/**
 * The measured plot in CSS pixels, and the one projection every SVG mark, the focus ring and the
 * tooltip anchor draw through. Root measures the plot box, and each mark asks this module where a
 * slot's band, a bar or a value lands. The browser draws an SVG layer's origin on the device pixel
 * nearest the plot's page position, and an HTML box's edge on the device pixel nearest its own page
 * position. Every edge here snaps the same way, as the page position's pixel less the origin's
 * pixel, so it is always a whole number of device pixels from the layer's origin and draws sharp,
 * and it lands on the pixel the browser gives the focused option's box. Sharing one snap is what
 * keeps a bar, its crosshair band and the focused option on one column.
 */
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

/** One layout drawn into the measured plot. */
export type PlotFrame = {
  readonly box: PlotBox;
  readonly orientation: "vertical" | "horizontal";
  /** The slots of the effective window, at least 1. */
  readonly count: number;
  /** The value domain mapped onto the screen coordinate along the value axis. */
  readonly value: LinearScale;
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
 * @param box - The measured plot box.
 * @param orientation - Root's orientation.
 * @param count - The effective window's slot count.
 * @param domain - The layout's value domain, lower bound first.
 * @returns The frame.
 */
export function plotFrame(
  box: PlotBox,
  orientation: "vertical" | "horizontal",
  count: number,
  domain: readonly [number, number]
): PlotFrame {
  const range: readonly [number, number] = orientation === "vertical" ? [box.height, 0] : [0, box.width];
  return { box, orientation, count: Math.max(1, count), value: linearScale(domain, range) };
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

/** The plot's length along the slot axis. */
function alongLength(frame: PlotFrame): number {
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
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @returns The band's start and end in CSS pixels.
 */
export function slotBand(frame: PlotFrame, position: number): readonly [number, number] {
  const step = alongLength(frame) / frame.count;
  return snapSpan(frame, position * step, (position + 1) * step);
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
  const length = alongLength(frame);
  if (xScale === "band") return ((position + 0.5) * length) / frame.count;
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
  const centre = centreOf(frame, position, xScale);
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
  const share = alongLength(frame) === 0 ? 0 : centre / alongLength(frame);
  const nearest =
    xScale === "band" ? Math.floor(share * frame.count) : Math.round(share * Math.max(0, frame.count - 1));
  const position = Math.min(Math.max(nearest, 0), frame.count - 1);
  const [start, end] = optionBand(frame, position, xScale);
  const at = Math.min(Math.max(snapAlong(frame, centre), start), end - width);
  return [at, at + width];
}

/**
 * The span a bar takes inside its slot's band, unsnapped. The band loses `bandGap` around its
 * bars, and a BarGroup splits the rest into sub-bands `barGap` apart. The gaps stay as requested
 * while they leave every bar a width. Gaps that would use up the band take half of it instead, so
 * a group in a band too narrow for its gaps still draws every bar, and the pixel floor gives each
 * one a device pixel.
 *
 * @param frame - The layout's frame.
 * @param position - The slot's place in the window, from 0.
 * @param metrics - The bar spacing.
 * @param sub - The Bar's sub-band.
 * @returns The bar's start and end along the slot axis in CSS pixels.
 */
export function barSpan(
  frame: PlotFrame,
  position: number,
  metrics: BarMetrics,
  sub: SubBand
): readonly [number, number] {
  const step = alongLength(frame) / frame.count;
  const inside = Math.max(0, step * (1 - metrics.bandGap));
  const gaps = sub.count - 1;
  const gap = gaps === 0 ? 0 : inside - gaps * metrics.barGap > 0 ? metrics.barGap : inside / (2 * gaps);
  const size = (inside - (sub.count - 1) * gap) / sub.count;
  const start = position * step + (step * metrics.bandGap) / 2 + sub.index * (size + gap);
  return [start, start + size];
}

/**
 * Snap a span along the slot axis. This is the one owner of the pixel floor, which every mark and
 * every interaction band takes: a span wider than zero keeps at least one device pixel, and an empty
 * span stays empty. A span narrower than a device pixel snaps both edges to one, and keeps the
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
 * Snap a mark's drawn body: its slot-axis edges through `snapSpan`, so it keeps the pixel floor,
 * and its value-axis edges onto the device pixels, so a zero value stays flat. Every rectangle a
 * bar, its look's parts, the active overlay, a path column or the tooltip row draws comes through
 * here, after any shaping, so nothing narrows a body after the floor.
 *
 * @param frame - The layout's frame.
 * @param rect - The unsnapped body.
 * @returns The snapped body.
 */
export function snapBody(frame: PlotFrame, rect: PlotRect): PlotRect {
  const vertical = frame.orientation === "vertical";
  const [alongStart, alongSize] = vertical ? [rect.x, rect.width] : [rect.y, rect.height];
  const [acrossStart, acrossSize] = vertical ? [rect.y, rect.height] : [rect.x, rect.width];
  const [a0, a1] = snapSpan(frame, alongStart, alongStart + Math.max(0, alongSize));
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
export function ruleAt(snapped: (at: number) => number, at: number, width = 1): number {
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
