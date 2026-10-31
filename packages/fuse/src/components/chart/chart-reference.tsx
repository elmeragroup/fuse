"use client";

import { useId, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement, RefCallback, RefObject } from "react";

import { usePlotLayout, useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import type { ChartLabels } from "./chart-labels";
import type { MarkValues } from "./chart-motion";
import { placementOf, useCommitMotion, useMotionMark } from "./chart-motion-mark";
import { useChartFrame } from "./chart-plot";
import type { ChartFrame } from "./chart-plot";
import { slotLabel } from "./chart-text";
import type { ChartLayerProps, ChartTone, ChartX, ValueFormat, XFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { formatValue } from "./format/value-format";
import { ChartCompositionError, isChartDevelopment } from "./layout/errors";
import {
  hairline,
  ruleAcross,
  wholeWidth,
  slotLine,
  slotLineAt,
  slotShare,
  snapAcross,
  snapAcrossSpan,
  snapAlong,
  snapSpan,
  snapY,
  valueShare,
} from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";
import { slotCentre, valueTop } from "./layout/plot-geometry";
import type { LabelSize } from "./layout/reference-labels";
import { stringOf } from "./layout/scalar";
import { slotOf } from "./layout/x-domain";

/**
 * Props for `Chart.ReferenceLine`, a closed part. It takes either `y` with a `ValueFormat` or `x`
 * with an `XFormat`. Without a format, a `y` line prints through the layout's first series' format
 * and an `x` line through the interval's label preset.
 *
 * @beta
 */
export type ChartReferenceLineProps = ChartLayerProps &
  (
    | {
        /** The value the line marks. */
        y: number;
        /** Not on a value line. */
        x?: never;
        /** How `{value}` in `label` prints, a `ValueFormat` on a `y` line and an `XFormat` on an `x` line. */
        format?: ValueFormat;
      }
    | {
        /** The x the line marks. An x string on a time axis throws `x-type-mismatch`. */
        x: ChartX;
        /** Not on an x line. */
        y?: never;
        /** How `{value}` in `label` prints, a `ValueFormat` on a `y` line and an `XFormat` on an `x` line. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the line's value. */
    label?: string;
    /** The line style. "solid" by default. */
    variant?: "solid" | "dashed";
    /** The line's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * Props for `Chart.ReferenceArea`, a closed part. It takes either `y1` and `y2` or `x1` and `x2`.
 *
 * @beta
 */
export type ChartReferenceAreaProps = ChartLayerProps &
  (
    | {
        /** The band's first value. */
        y1: number;
        /** The band's last value. */
        y2: number;
        /** Not on a value band. */
        x1?: never;
        /** Not on a value band. */
        x2?: never;
        /** How `{value}` in `label` prints the range, a `ValueFormat` for `y1` and `y2` and an `XFormat` for `x1` and `x2`. */
        format?: ValueFormat;
      }
    | {
        /** The band's first x. An x string on a time axis throws `x-type-mismatch`. */
        x1: ChartX;
        /** The band's last x. An x string on a time axis throws `x-type-mismatch`. */
        x2: ChartX;
        /** Not on an x band. */
        y1?: never;
        /** Not on an x band. */
        y2?: never;
        /** How `{value}` in `label` prints the range, a `ValueFormat` for `y1` and `y2` and an `XFormat` for `x1` and `x2`. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the range. */
    label?: string;
    /** The band's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * The slot a child x prop names. A string on a time axis, or a `Date` or number on a category axis,
 * throws `x-type-mismatch` in every build.
 */
export function childSlot(context: ChartRootContextValue, part: string, x: ChartX): number {
  const { domain } = context.model;
  const isString = stringOf(x) !== undefined;
  if ((domain.kind === "time") === isString) {
    throw new ChartCompositionError(
      part,
      "x-type-mismatch",
      domain.kind === "time"
        ? "received an x string on a time axis. Pass a Date or epoch milliseconds, because a date-only string parses as UTC midnight and lands on the wrong day."
        : "received a Date or a number on a category axis. Pass the category string."
    );
  }
  return slotOf(domain, x);
}

/** Fill `{value}` in a label, or join the label and the value, or use the dictionary's pattern. */
function sentence(
  label: string | undefined,
  value: FormattedText,
  pattern: (value: string) => string
): FormattedText {
  if (label === undefined) return { text: pattern(value.text), spoken: pattern(value.spoken) };
  if (label.includes("{value}")) {
    return {
      text: label.replaceAll("{value}", value.text),
      spoken: label.replaceAll("{value}", value.spoken),
    };
  }
  return { text: label, spoken: `${label}: ${value.spoken}` };
}

/** The value of a value-axis reference in the layout's first series' format. */
function valueText(
  context: ChartRootContextValue,
  keys: readonly string[],
  value: number,
  format: ValueFormat | undefined
): FormattedText {
  const first = keys[0];
  return formatValue(
    context.locale,
    value,
    format ?? (first === undefined ? {} : context.config[first]?.format) ?? {},
    "full"
  );
}

/** Warn once per Root in development when a reference sits outside the value domain. */
function warnOutside(
  context: ChartRootContextValue,
  part: string,
  values: readonly number[],
  domain: readonly [number, number]
): void {
  if (!isChartDevelopment()) return;
  if (values.every((value) => value >= domain[0] && value <= domain[1])) return;
  context.warnOnce(
    "reference-outside-domain",
    `${part} sits outside the value domain, so it renders clipped. Pass its value to yInclude on Chart.Root or the Panel, because Root never reads its children.`
  );
}

/** A value reference's label on a vertical chart, which stacks clear of the plot's other labels. */
type StackedLabel = {
  /** The label's node. */
  readonly ref: RefObject<HTMLSpanElement | null>;
  /** Hand the layout's label registry the guide a value reference draws now, or null while it hides. */
  readonly move: (span: readonly [number, number] | null) => void;
  /** Tell the layout's label registry whether a slot reference's guide shows in the plot now. */
  readonly show: (shown: boolean) => void;
};

/** A label's own size, from its text: one line high, its cut-area inset 0.25rem below that. */
function labelSize(node: HTMLElement): LabelSize {
  const style = getComputedStyle(node);
  const height = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2 || 0;
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return { height, inset: 0.25 * rem + height };
}

/**
 * Place a reference's label on a vertical chart through its layout's label registry, one per
 * Panel, so labels stack against their own Panel's plot and a slot label reserves a row there
 * alone. It places them from what the
 * reference draws. A value reference's label registers with its own size, and every frame its
 * writer hands over the guide it draws, so the registry places every value label from the drawn
 * guides alone. A slot reference's label registers in the row of slot labels above the plot, and
 * every frame its writer reports whether its guide shows, which reserves the row. The reference
 * places its guide on every commit, so a label that registers or changes size draws from the
 * guide's current position at once. Before the first frame, as on the server, a value label sits
 * on its own edge. A horizontal chart stacks nothing.
 */
function useStackedLabel(
  context: ChartRootContextValue,
  labels: ChartLabels,
  drawn: ChartFrame | null,
  labelled: boolean,
  kind: "line" | "area",
  axis: "value" | "slot"
): StackedLabel {
  const key = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const placed = labelled && context.orientation === "vertical";
  const stacks = placed && axis === "value";
  const row = placed && axis === "slot";
  useLayoutEffect(() => {
    const node = ref.current;
    if (!stacks || node === null) return;
    return labels.add(key, node, kind, labelSize(node));
  }, [labels, key, stacks, kind]);
  useLayoutEffect(() => {
    if (row) return labels.addSlot(key);
  }, [labels, key, row]);
  // The text and the plot can change with any commit, so the registry reads them before the
  // reference's writer places the guide again.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!stacks || node === null || drawn === null) return;
    const { box } = drawn.frame;
    labels.resize(key, labelSize(node));
    labels.measure({ end: snapY(box, box.height), pixel: 1 / box.dpr });
  });
  const move = (span: readonly [number, number] | null): void => {
    if (stacks) labels.move(key, span);
  };
  const show = (shown: boolean): void => {
    if (row) labels.showSlot(key, shown);
  };
  return { ref, move, show };
}

/** A range in visual form with a bare en dash, writing a shared unit once, such as `5–10 kWh`. */
function rangeText(
  from: FormattedText,
  to: FormattedText,
  join: (from: string, to: string) => string
): FormattedText {
  const fromParts = from.text.split("\u00a0");
  const toParts = to.text.split("\u00a0");
  const sharedUnit = fromParts.length > 1 && fromParts.at(-1) === toParts.at(-1);
  const head = sharedUnit ? fromParts.slice(0, -1).join("\u00a0") : from.text;
  return { text: `${head}\u2013${to.text}`, spoken: join(from.spoken, to.spoken) };
}

/**
 * Whether a reference on an axis runs across the plot at an x, as a slot reference on a vertical
 * chart and a value reference on a horizontal one do, rather than at a y.
 */
function atX(frame: PlotFrame, axis: "value" | "slot"): boolean {
  return (frame.orientation === "vertical") === (axis === "slot");
}

/**
 * The pixel coordinate of a share of the plot. A value share runs from the domain maximum, the
 * top or the right edge, and a slot share from the first slot, the left or the top edge.
 */
function plotCoordinate(frame: PlotFrame, axis: "value" | "slot", at: number): number {
  const length = atX(frame, axis) ? frame.box.width : frame.box.height;
  const share = (at / 100) * length;
  return axis === "value" && frame.orientation === "horizontal" ? length - share : share;
}

/**
 * Snap a reference's tweened coordinate where it draws, as a bar's edge or a slot's centre snaps,
 * so a guide at a bar's value meets the bar's edge. The loop tweens the unsnapped coordinate, so
 * whether a guide lies inside the plot never rests on a snap.
 */
function drawnPixel(frame: PlotFrame, axis: "value" | "slot", at: number): number {
  return axis === "value" ? snapAcross(frame, at) : snapAlong(frame, at);
}

/** The plot's length along the axis a reference's coordinate runs on, unsnapped. */
function plotLength(frame: PlotFrame, axis: "value" | "slot"): number {
  return atX(frame, axis) ? frame.box.width : frame.box.height;
}

/** The share of the plot a drawn coordinate stands for. */
function referenceShare(frame: PlotFrame, axis: "value" | "slot", at: number): number {
  return axis === "value" ? valueShare(frame, at) : slotShare(frame, at);
}

/** What a reference's writer reads besides its two numbers: the frame, its axis and its label. */
type ReferenceLook = {
  readonly kind: "line" | "area";
  readonly frame: PlotFrame | null;
  readonly axis: "value" | "slot";
  readonly xScale: "band" | "point";
  readonly label: StackedLabel;
};

/**
 * Move a reference with the bars. Its two numbers tween through Root's animation loop in the same
 * pixel space and on the same clock as the bars, so a resize during an update keeps a guide on its
 * bar. Its writer, at module scope, redraws the line or band, its label and its CSS shares from the
 * drawn numbers.
 *
 * @param axis - The axis the reference's coordinates run on. Its numbers mean pixels along that
 *   axis, so a change of axis is a change of coordinate space, which snaps.
 * @param target - The reference's two numbers in a frame: a line's coordinate and width, or an
 *   area's two edges, each unsnapped.
 * @param look - The writer's look, whose kind says whether the second number, a line's width, is a
 *   size, or an area's far edge, which runs on the same axis as its near one.
 * @returns The ref of the reference's wrapper.
 */
function useReferenceMark(
  context: ChartRootContextValue,
  drawn: ChartFrame | null,
  axis: "value" | "slot",
  target: (frame: PlotFrame) => readonly [number, number],
  look: ReferenceLook
): RefCallback<HTMLDivElement> {
  // The coordinates run along the axis's own direction, x or y.
  const direction = (context.orientation === "vertical") === (axis === "slot") ? "x" : "y";
  const axes = [direction, look.kind === "line" ? "size" : direction] as const;
  const { ref, place } = useMotionMark(context.motion, drawReference, look, axes);
  const commit = useCommitMotion(context.update, drawn?.plot ?? null, `${context.orientation} ${axis}`);
  // Every commit places the guide, as a bar places itself. A target the guide already heads for
  // lets a running tween run on and redraws what it draws, which hands its label the guide again.
  useLayoutEffect(() => {
    if (drawn === null) return;
    // A reference takes the bars' placement, so in the path form, whose paths draw new data at once,
    // a guide at a value snaps with them and stays on the paths' pixels.
    place(target(drawn.frame), placementOf(commit()));
  });
  return ref;
}

/**
 * A rule at a drawn coordinate, across the plot's whole length: a hairline on the value axis, and as
 * wide as the slot's line on the slot axis, its near edge at the coordinate.
 */
function lineAttributes(frame: PlotFrame, axis: "value" | "slot", at: number, width: number) {
  if (axis === "value") return ruleAcross(frame.box, atX(frame, axis) ? "vertical" : "horizontal", at);
  const centre = snapAlong(frame, at) + width / 2;
  return frame.orientation === "vertical"
    ? { x1: centre, y1: 0, x2: centre, y2: frame.box.height }
    : { x1: 0, y1: centre, x2: frame.box.width, y2: centre };
}

/**
 * What a reference draws now: whether it lies outside the plot, whether a value band runs past the
 * plot's maximum, and the span it draws, snapped. Every decision comes from the tweened, unsnapped
 * numbers against the unsnapped plot, before the pixel floor and the plot's snapped edges apply, so
 * no snap shows a reference past the plot or hides one inside it. The writer, the data attributes
 * and the label registry read nothing else.
 */
type ReferenceDrawn = {
  readonly outside: boolean;
  readonly clipped: boolean;
  /** The drawn span across the axis the reference runs on, its one coordinate twice for a line. */
  readonly span: readonly [number, number];
  /**
   * The guide its label follows, null while it hides: its edges snapped but not clipped, so a band
   * cut at the plot's top keeps the cut edge its label slides in from.
   */
  readonly guide: readonly [number, number] | null;
};

/**
 * A line's drawn state at a tweened, unsnapped coordinate: a value, or a slot's centre, which lies
 * outside the plot for a slot outside the window. A slot line inside the plot draws inside its
 * slot's band, as `slotLineAt` draws it, and its span starts where the rule does.
 */
function lineDrawn(
  frame: PlotFrame,
  axis: "value" | "slot",
  at: number,
  width: number,
  xScale: "band" | "point"
): ReferenceDrawn {
  const outside = at < 0 || at > plotLength(frame, axis);
  const start =
    axis === "slot" && !outside ? slotLineAt(frame, at, xScale, width)[0] : drawnPixel(frame, axis, at);
  const span = [start, start] as const;
  return { outside, clipped: false, span, guide: outside ? null : span };
}

/** Draw a line from the loop's numbers, its coordinate and its width. */
function drawLine(node: HTMLDivElement, look: ReferenceLook, values: MarkValues): void {
  const { frame, axis, xScale, label } = look;
  if (frame === null) return;
  const [pixel = 0, tweened = 1] = values;
  // The rule's width, which its stroke and its label's centring read, whole device pixels.
  const width = wholeWidth(frame.box, tweened);
  const state = lineDrawn(frame, axis, pixel, width, xScale);
  const share = referenceShare(frame, axis, state.span[0]);
  node.style.setProperty("--chart-at", `${String(share)}%`);
  node.style.setProperty("--chart-x", String(share / 100));
  // The line hides, label and all, while it lies outside the plot, and its label leaves the stack.
  toggle(node, "data-outside", state.outside);
  label.move(state.guide);
  label.show(!state.outside);
  node.style.setProperty("--_rule-width", `${String(width)}px`);
  writeAttributes(
    node.querySelector('[data-slot="chart-reference-rule"]'),
    lineAttributes(frame, axis, state.span[0], width)
  );
}

/** Draw a reference from the loop's numbers, as its kind draws it. */
function drawReference(node: HTMLDivElement, look: ReferenceLook, values: MarkValues): void {
  if (look.kind === "line") drawLine(node, look, values);
  else drawArea(node, look, values);
}

/** Draw a band from the loop's numbers, its two edges. */
function drawArea(node: HTMLDivElement, look: ReferenceLook, values: MarkValues): void {
  const { frame, axis, label } = look;
  if (frame === null) return;
  const [start = 0, end = 0] = values;
  // The band, its shares, its visibility, its clipping and its label all follow its drawn state.
  const state = bandDrawn(frame, axis, start, end);
  const [low, high] = state.span;
  const clamp = (share: number): number => Math.min(Math.max(share, 0), 100);
  // A value band's shares run from the edge at its `from` value to the one at its `to`.
  const [fromEdge, toEdge] = start <= end ? [low, high] : [high, low];
  const shownStart = axis === "slot" ? slotShare(frame, low) : clamp(referenceShare(frame, axis, fromEdge));
  const shownEnd = axis === "slot" ? slotShare(frame, high) : clamp(referenceShare(frame, axis, toEdge));
  node.style.setProperty("--chart-from", `${String(shownStart)}%`);
  node.style.setProperty("--chart-to", `${String(shownEnd)}%`);
  node.style.setProperty("--chart-x", String(shownStart / 100));
  toggle(node, "data-outside", state.outside);
  toggle(node, "data-clipped", state.clipped);
  label.move(state.guide);
  label.show(!state.outside);
  writeAttributes(
    node.querySelector('[data-slot="chart-reference-band"]'),
    bandAttributes(frame, axis, state.span)
  );
}

/** A band's drawn state between two tweened coordinates. */
function bandDrawn(frame: PlotFrame, axis: "value" | "slot", start: number, end: number): ReferenceDrawn {
  const low = Math.max(Math.min(start, end), 0);
  const high = Math.min(Math.max(start, end), plotLength(frame, axis));
  const outside = low >= high;
  const clipped = axis === "value" && referenceShare(frame, axis, start) < 0;
  if (outside) {
    const at = drawnPixel(frame, axis, low);
    return { outside, clipped, span: [at, at], guide: null };
  }
  // A band inside the plot keeps a device pixel, as the slots' own bars do, among the plot's pixels.
  const span = axis === "slot" ? snapSpan(frame, low, high) : snapAcrossSpan(frame, low, high);
  const near = drawnPixel(frame, axis, Math.min(start, end));
  const far = drawnPixel(frame, axis, Math.max(start, end));
  return { outside, clipped, span, guide: [near, far] };
}

/** The rectangle of a band's drawn span, across the plot's whole length. */
function bandAttributes(frame: PlotFrame, axis: "value" | "slot", [start, stop]: readonly [number, number]) {
  const { box } = frame;
  return atX(frame, axis)
    ? { x: start, width: stop - start, y: 0, height: box.height }
    : { x: 0, width: box.width, y: start, height: stop - start };
}

/** Set or remove a boolean data attribute. */
function toggle(node: Element, name: string, on: boolean): void {
  if (on) node.setAttribute(name, "");
  else node.removeAttribute(name);
}

/** Write a set of numeric attributes. */
function writeAttributes(node: Element | null, attributes: { readonly [name: string]: number }): void {
  if (node === null) return;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
}

/**
 * A line at one value or one x, such as a price cap. Readers hear it as a visually hidden sentence
 * that always carries the value, in the reference's own place after the plot. Pass the value to
 * Root's `yInclude` when it may sit outside the data, because Root never reads its children, and a
 * development build warns with `reference-outside-domain` when it does.
 *
 * @beta
 */
export function ChartReferenceLine({ style, ...props }: ChartReferenceLineProps): ReactElement {
  const { label, variant = "solid", tone = "default", className } = props;
  const context = useChartRoot("Chart.ReferenceLine");
  const layout = usePlotLayout("Chart.ReferenceLine");
  const strings = CHART_STRINGS[context.locale];
  let at: number;
  let value: FormattedText;
  let axis: "value" | "slot";
  // The line's place in the window when it marks a slot, which draws it inside the slot's band.
  let position: number | null = null;
  if (props.y === undefined) {
    const window = context.model.window;
    const slot = childSlot(context, "Chart.ReferenceLine", props.x);
    at = window === null || slot === -1 ? -1 : slotCentre(window, slot, context.xScale) * 100;
    position = window === null || slot === -1 ? null : slot - window.first;
    value = slot === -1 ? { text: "", spoken: "" } : slotLabel(context, slot, props.format);
    axis = "slot";
  } else {
    warnOutside(context, "Chart.ReferenceLine", [props.y], layout.y.domain);
    at = valueTop(layout.y.domain, props.y);
    value = valueText(context, layout.keys, props.y, props.format);
    axis = "value";
  }
  const text = sentence(label, value, strings.referenceLine);
  // A line outside the plot draws nothing and keeps its sentence.
  const outside = at < 0 || at > 100;
  const drawn = useChartFrame("Chart.ReferenceLine", layout);
  const stacked = useStackedLabel(
    context,
    layout.labels,
    drawn,
    label !== undefined && label !== "",
    "line",
    axis
  );
  const { ref: labelRef } = stacked;
  const frame = drawn?.frame ?? null;
  const look = useMemo(
    (): ReferenceLook => ({ kind: "line", frame, axis, xScale: context.xScale, label: stacked }),
    [frame, axis, context.xScale, stacked]
  );
  // A line tweens its unsnapped coordinate, a value's edge or its slot's centre, and its width, which
  // a slot line narrows to its band. A slot line draws inside its band, as the crosshair does.
  const ruleWidth = (measured: PlotFrame): number => {
    if (position === null) return hairline(measured.box);
    const [start, end] = slotLine(measured, position, context.xScale);
    return end - start;
  };
  const target = (measured: PlotFrame) => [plotCoordinate(measured, axis, at), ruleWidth(measured)] as const;
  const wrapper = useReferenceMark(context, drawn, axis, target, look);
  // The first render draws the line at rest, as its writer draws it.
  const rule = (measured: PlotFrame) => {
    const [coordinate, wide] = target(measured);
    const width = wholeWidth(measured.box, wide);
    return lineAttributes(
      measured,
      axis,
      lineDrawn(measured, axis, coordinate, width, context.xScale).span[0],
      width
    );
  };
  return (
    <div
      ref={wrapper}
      data-slot="chart-reference-line"
      data-axis={axis}
      data-outside={outside ? "" : undefined}
      data-variant={variant}
      data-tone={tone}
      className={className}
      style={{ "--chart-at": `${String(at)}%`, "--chart-x": at / 100, ...style }}>
      <svg aria-hidden="true">
        {frame === null ? null : <line data-slot="chart-reference-rule" {...rule(frame)} />}
      </svg>
      <span ref={labelRef} data-slot="chart-reference-label" aria-hidden="true">
        {label === undefined ? null : text.text}
      </span>
      <span data-slot="chart-reference-text">{text.spoken}</span>
    </div>
  );
}

/**
 * A band between two values or two x values, such as a tariff step. Readers hear it as a visually
 * hidden sentence with the range. Both ends are inclusive.
 *
 * @beta
 */
export function ChartReferenceArea({ style, ...props }: ChartReferenceAreaProps): ReactElement {
  const { label, tone = "default", className } = props;
  const context = useChartRoot("Chart.ReferenceArea");
  const layout = usePlotLayout("Chart.ReferenceArea");
  const strings = CHART_STRINGS[context.locale];
  let from: number;
  let to: number;
  let value: FormattedText;
  let axis: "value" | "slot";
  if (props.y1 === undefined) {
    const window = context.model.window;
    const a = childSlot(context, "Chart.ReferenceArea", props.x1);
    const b = childSlot(context, "Chart.ReferenceArea", props.x2);
    const count = window === null ? 1 : window.last - window.first + 1;
    const first = Math.min(a, b) - (window?.first ?? 0);
    const last = Math.max(a, b) - (window?.first ?? 0);
    from = (first / count) * 100;
    to = ((last + 1) / count) * 100;
    value =
      a === -1 || b === -1
        ? { text: "", spoken: "" }
        : rangeText(
            slotLabel(context, Math.min(a, b), props.format),
            slotLabel(context, Math.max(a, b), props.format),
            strings.valueRange
          );
    axis = "slot";
  } else {
    const low = Math.min(props.y1, props.y2);
    const high = Math.max(props.y1, props.y2);
    warnOutside(context, "Chart.ReferenceArea", [low, high], layout.y.domain);
    from = valueTop(layout.y.domain, high);
    to = valueTop(layout.y.domain, low);
    value = rangeText(
      valueText(context, layout.keys, low, props.format),
      valueText(context, layout.keys, high, props.format),
      strings.valueRange
    );
    axis = "value";
  }
  const text = sentence(label, value, strings.referenceArea);
  // The band clips to the plot, and a band wholly outside it draws nothing and keeps its sentence.
  const shownFrom = Math.min(Math.max(from, 0), 100);
  const shownTo = Math.min(Math.max(to, 0), 100);
  const outside = shownFrom >= shownTo;
  // A value band cut at the plot top keeps its label inside the band, below the cut.
  const clipped = axis === "value" && from < 0;
  const drawn = useChartFrame("Chart.ReferenceArea", layout);
  const stacked = useStackedLabel(
    context,
    layout.labels,
    drawn,
    label !== undefined && label !== "",
    "area",
    axis
  );
  const { ref: labelRef } = stacked;
  const frame = drawn?.frame ?? null;
  const look = useMemo(
    (): ReferenceLook => ({ kind: "area", frame, axis, xScale: context.xScale, label: stacked }),
    [frame, axis, context.xScale, stacked]
  );
  // A band keeps its edges unsnapped until it draws, so a band narrower than a device pixel keeps
  // one, and whether it lies inside the plot or past its top never rests on a snap.
  const target = (measured: PlotFrame) =>
    [plotCoordinate(measured, axis, from), plotCoordinate(measured, axis, to)] as const;
  const wrapper = useReferenceMark(context, drawn, axis, target, look);
  return (
    <div
      ref={wrapper}
      data-slot="chart-reference-area"
      data-axis={axis}
      data-outside={outside ? "" : undefined}
      data-clipped={clipped ? "" : undefined}
      data-tone={tone}
      className={className}
      style={{
        "--chart-from": `${String(shownFrom)}%`,
        "--chart-to": `${String(shownTo)}%`,
        "--chart-x": shownFrom / 100,
        ...style,
      }}>
      <svg aria-hidden="true">
        {frame === null ? null : (
          <rect
            data-slot="chart-reference-band"
            {...bandAttributes(frame, axis, bandDrawn(frame, axis, ...target(frame)).span)}
          />
        )}
      </svg>
      <span ref={labelRef} data-slot="chart-reference-label" aria-hidden="true">
        {label === undefined ? null : text.text}
      </span>
      <span data-slot="chart-reference-text">{text.spoken}</span>
    </div>
  );
}

Object.assign(ChartReferenceLine, { displayName: "Chart.ReferenceLine" });
Object.assign(ChartReferenceArea, { displayName: "Chart.ReferenceArea" });
