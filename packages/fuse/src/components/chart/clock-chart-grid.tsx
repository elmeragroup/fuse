"use client";

/**
 * The clock's frame of reference and its hands. The Grid draws rings at the value ticks, spokes at
 * the label ticks and a solid zero ring when the domain spans 0. The AngleAxis prints the cycle's
 * hours, weekdays or months past the rim, thinned by stride to the dial's width, and the RadiusAxis
 * the ring values along the 12 o'clock spoke. A reference `y` draws a ring or an annulus, and an `x`
 * a spoke or a sector. The Scrubber marks the active slot with a hand or its sector and turns to the
 * next slot the short way round on 420/42, and Now's hand points at the exact minute. The first paint
 * draws all of it at rest (D18), and none of it scales out.
 */
import { useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { viewBoxOf } from "./chart-pie-frame";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ClockDrawing } from "./chart-polar-context";
import { springTiming } from "./chart-spring";
import type { ChartLayerProps, ChartTone, ChartX, ValueFormat, XFormat } from "./chart-types";
import { formatSlot } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { slotAngles } from "./layout/clock";
import { ringPath, sectorPath } from "./layout/clock-path";
import { ChartCompositionError } from "./layout/errors";
import { CHART_SPRINGS } from "./layout/motion";
import { polarPoint } from "./layout/polar-angle";
import type { SweepBox } from "./layout/polar-angle";
import { angleLabel } from "./layout/polar-labels";
import { pathNumber } from "./layout/rounding";

/** The radius a cycle label sits at, as a share of the outer radius. */
const LABEL_REACH = 1.1;

/**
 * Props for `ClockChart.Grid`, a closed part.
 *
 * @beta
 */
export type ClockChartGridProps = ChartLayerProps & {
  /** The rings' and spokes' line style. "solid" by default. The zero ring stays solid. */
  variant?: "solid" | "dashed";
};

/**
 * Props for `ClockChart.AngleAxis`, a closed part.
 *
 * @beta
 */
export type ClockChartAngleAxisProps = ChartLayerProps & {
  /** The label format. The cycle's own, hours, weekdays or months, is the default. */
  format?: XFormat;
};

/**
 * Props for `ClockChart.RadiusAxis`, a closed part.
 *
 * @beta
 */
export type ClockChartRadiusAxisProps = ChartLayerProps & {
  /** The tick label format. The first series' `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `ClockChart.ReferenceLine`, a closed part. It takes either `y` or `x`.
 *
 * @beta
 */
export type ClockChartReferenceLineProps = ChartLayerProps &
  (
    | {
        /** The value the ring marks. */
        y: number;
        /** Not on a value ring. */
        x?: never;
        /** How `{value}` in `label` prints. */
        format?: ValueFormat;
      }
    | {
        /** The instant the spoke marks. A string throws `x-type-mismatch`. */
        x: ChartX;
        /** Not on a spoke. */
        y?: never;
        /** How `{value}` in `label` prints. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the ring's or the spoke's value. */
    label?: string;
    /** The line style. "solid" by default. */
    variant?: "solid" | "dashed";
    /** The line's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * Props for `ClockChart.ReferenceArea`, a closed part. It takes either `y1` and `y2` or `x1` and `x2`.
 *
 * @beta
 */
export type ClockChartReferenceAreaProps = ChartLayerProps &
  (
    | {
        /** The annulus's first value. */
        y1: number;
        /** Its last value. */
        y2: number;
        /** Not on an annulus. */
        x1?: never;
        /** Not on an annulus. */
        x2?: never;
        /** How `{value}` in `label` prints the range. */
        format?: ValueFormat;
      }
    | {
        /** The sector's first instant. A string throws `x-type-mismatch`. */
        x1: ChartX;
        /** Its last instant. */
        x2: ChartX;
        /** Not on a sector. */
        y1?: never;
        /** Not on a sector. */
        y2?: never;
        /** How `{value}` in `label` prints the range. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the range. */
    label?: string;
    /** The band's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * Props for `ClockChart.Scrubber`, a closed part.
 *
 * @beta
 */
export type ClockChartScrubberProps = ChartLayerProps & {
  /** "line" draws a hand through the active slot, "band" its whole sector. "line" by default. */
  variant?: "line" | "band";
};

/**
 * Props for `ClockChart.Now`, a closed part.
 *
 * @beta
 */
export type ClockChartNowProps = ChartLayerProps & {
  /** The visible label past the hand's tip, such as "Nå". */
  label?: string;
  /** The hand's tone. "default" by default. */
  tone?: ChartTone;
};

/** A point's place in the cell, as percentages of the sweep's box. */
function percent(box: SweepBox, x: number, y: number): readonly [string, string] {
  const left = ((x - box.left) / (box.right - box.left)) * 100;
  const top = ((y - box.top) / (box.bottom - box.top)) * 100;
  return [`${left.toFixed(3)}%`, `${top.toFixed(3)}%`];
}

/** A label's place past the rim at an angle, reading away from the centre: its point and its alignment. */
type LabelPlace = {
  readonly x: string;
  readonly y: string;
  readonly alignX: string;
  readonly alignY: string;
};

/** A label's place past the rim at an angle, reading away from the centre. */
function labelPlace(box: SweepBox, angle: number, reach: number): LabelPlace {
  const { point, alignX, alignY } = angleLabel(angle, reach);
  const [x, y] = percent(box, point.x, point.y);
  return { x, y, alignX: `${String(-alignX * 100)}%`, alignY: `${String(-alignY * 100)}%` };
}

/** A label placed past the rim, its place written as the stylesheet's custom properties. */
function PlacedLabel({
  place,
  dataSlot,
  min,
  hidden,
  children,
}: {
  readonly place: LabelPlace;
  readonly dataSlot?: string;
  readonly min?: number | undefined;
  readonly hidden?: boolean;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <span
      data-slot={dataSlot}
      data-part={dataSlot === undefined ? "label" : undefined}
      data-min={min}
      data-hidden={hidden === true ? "" : undefined}
      style={{ "--_x": place.x, "--_y": place.y, "--_align-x": place.alignX, "--_align-y": place.alignY }}>
      {children}
    </span>
  );
}

/** The narrowest width a label or its spoke shows at, for the stylesheet's container rules. */
function minOf(visibility: number | "always" | "none"): number | undefined {
  return visibility === "always" || visibility === "none" ? undefined : visibility;
}

/** A spoke from the hole to the rim at an angle. */
function spokePath(angle: number, inner: number, outer: number): string {
  const a = polarPoint(angle, inner);
  const b = polarPoint(angle, outer);
  return `M${pathNumber(a.x)},${pathNumber(a.y)}L${pathNumber(b.x)},${pathNumber(b.y)}`;
}

/** The slot of an instant, rejecting a string x, which a dial cannot read. */
function slotOfX(clock: ClockDrawing, part: string, x: ChartX): number {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: an x is a string, a number or a Date
  if (typeof x === "string") {
    throw new ChartCompositionError(
      part,
      "x-type-mismatch",
      "received a string x on a clock dial. Pass a Date or epoch milliseconds, because a date-only string parses as UTC midnight and lands on the wrong day."
    );
  }
  return clock.slotOf(x);
}

/**
 * The rings at the value ticks, the spokes at the cycle's labels, and a solid zero ring when the
 * domain spans 0. Every stroke keeps 1 px at any dial size.
 *
 * @beta
 */
export function ClockChartGrid({ variant = "solid", className, style }: ClockChartGridProps): ReactElement {
  const { model, box } = usePolarContext("ClockChart.Grid", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.Grid");
  const rings = clock.ticks.flatMap((tick) => {
    const radius = clock.radius(tick);
    return radius > clock.inner + 1e-9 && radius <= 1 + 1e-9 ? [{ tick, radius }] : [];
  });
  return (
    <svg
      data-slot="clock-chart-grid"
      data-variant={variant}
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={style}>
      <path data-slot="clock-chart-grid-ring" data-part="hole" d={ringPath(clock.inner)} />
      {rings.map(({ tick, radius }) => (
        <path
          key={tick}
          data-slot="clock-chart-grid-ring"
          data-zero={clock.zero !== null && tick === 0 ? "" : undefined}
          d={ringPath(radius)}
        />
      ))}
      {clock.labels.map((label) => (
        <path
          key={label.start}
          data-slot="clock-chart-spoke"
          data-min={minOf(label.visibility)}
          data-hidden={label.visibility === "none" ? "" : undefined}
          d={spokePath(label.angle, clock.inner, 1)}
        />
      ))}
    </svg>
  );
}

/**
 * The cycle's labels past the rim: hours on their slot's start round a day, weekdays and months
 * centred on their span. They never rotate, they thin by stride as the dial narrows, keeping the
 * cycle's first, and they take the frame's gutter beside the dial.
 *
 * @beta
 */
export function ClockChartAngleAxis({ format, className, style }: ClockChartAngleAxisProps): ReactElement {
  const { model, box, kernel } = usePolarContext("ClockChart.AngleAxis", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.AngleAxis");
  const timeZone = clock.text.model.domain.kind === "time" ? clock.text.model.domain.timeZone : "UTC";
  return (
    <div
      data-slot="clock-chart-angle-axis"
      data-polar-layer=""
      data-outside=""
      aria-hidden="true"
      className={className}
      style={style}>
      {clock.labels.map((label) => (
        <PlacedLabel
          key={label.start}
          dataSlot="clock-chart-angle-label"
          min={minOf(label.visibility)}
          hidden={label.visibility === "none"}
          place={labelPlace(box, label.angle, LABEL_REACH)}>
          {format === undefined
            ? label.text.text
            : formatSlot(kernel.locale, timeZone, label.start, label.unit, format, "tick").text}
        </PlacedLabel>
      ))}
    </div>
  );
}

/**
 * The ring values along the 12 o'clock spoke, each beside its ring.
 *
 * @beta
 */
export function ClockChartRadiusAxis({ format, className, style }: ClockChartRadiusAxisProps): ReactElement {
  const { model, box } = usePolarContext("ClockChart.RadiusAxis", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.RadiusAxis");
  const { locale } = useLocale();
  return (
    <div
      data-slot="clock-chart-radius-axis"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {clock.ticks.flatMap((tick) => {
        const radius = clock.radius(tick);
        if (radius < clock.inner - 1e-9 || radius > 1 + 1e-9) return [];
        const [left, top] = percent(box, 0, -radius);
        return [
          <span key={tick} data-slot="clock-chart-radius-label" style={{ "--_x": left, "--_y": top }}>
            {formatValue(locale, tick, format ?? clock.format, "tick").text}
          </span>,
        ];
      })}
    </div>
  );
}

/**
 * A ring at a value, as `y`, or a spoke at an instant's slot start, as `x`, with an optional label.
 * A `y` at a series' threshold draws the ring the threshold paints at.
 *
 * @beta
 */
export function ClockChartReferenceLine({ style, ...props }: ClockChartReferenceLineProps): ReactElement {
  const { label, variant = "solid", tone = "default", className } = props;
  const { model, box, kernel } = usePolarContext("ClockChart.ReferenceLine", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.ReferenceLine");
  const timeZone = clock.text.model.domain.kind === "time" ? clock.text.model.domain.timeZone : "UTC";
  let d: string;
  let text: string | undefined;
  let place: LabelPlace;
  if (props.y !== undefined) {
    const radius = clock.radius(props.y);
    d = ringPath(radius);
    text = label?.replace(
      "{value}",
      formatValue(kernel.locale, props.y, props.format ?? clock.format, "full").text
    );
    place = labelPlace(box, 0, radius);
  } else {
    const slot = slotOfX(clock, "ClockChart.ReferenceLine", props.x);
    const angle = slot === -1 ? 0 : slotAngles(slot, clock.count).start;
    d = slot === -1 ? "" : spokePath(angle, clock.inner, 1);
    const start = clock.starts[slot];
    text =
      start === undefined
        ? label
        : label?.replace(
            "{value}",
            formatSlot(
              kernel.locale,
              timeZone,
              start,
              clock.text.model.domain.kind === "time" ? clock.text.model.domain.interval : "hour",
              props.format ?? "time",
              "full"
            ).text
          );
    place = labelPlace(box, angle, 1.02);
  }
  return (
    <div
      data-slot="clock-chart-reference-line"
      data-variant={variant}
      data-tone={tone}
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      <svg viewBox={viewBoxOf(box)} focusable="false">
        <path data-slot="clock-chart-reference-path" data-part="line" d={d} />
      </svg>
      {text === undefined ? null : <PlacedLabel place={place}>{text}</PlacedLabel>}
    </div>
  );
}

/**
 * An annulus between two values, as `y1` and `y2`, or a sector from one instant's slot to another's,
 * as `x1` and `x2`, with an optional label.
 *
 * @beta
 */
export function ClockChartReferenceArea({ style, ...props }: ClockChartReferenceAreaProps): ReactElement {
  const { label, tone = "default", className } = props;
  const { model, box, kernel } = usePolarContext("ClockChart.ReferenceArea", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.ReferenceArea");
  let d: string;
  let text: string | undefined;
  let place: LabelPlace;
  if (props.y1 !== undefined) {
    const [a, b] = [clock.radius(props.y1), clock.radius(props.y2)];
    d = sectorPath(0, 360, Math.min(a, b), Math.max(a, b));
    const valueFormat = props.format ?? clock.format;
    text = label?.replace(
      "{value}",
      `${formatValue(kernel.locale, props.y1, valueFormat, "full").text}–${formatValue(kernel.locale, props.y2, valueFormat, "full").text}`
    );
    place = labelPlace(box, 0, Math.max(a, b));
  } else {
    const first = slotOfX(clock, "ClockChart.ReferenceArea", props.x1);
    const last = slotOfX(clock, "ClockChart.ReferenceArea", props.x2);
    const ok = first !== -1 && last !== -1;
    const start = ok ? slotAngles(Math.min(first, last), clock.count).start : 0;
    const end = ok ? slotAngles(Math.max(first, last), clock.count).end : 0;
    d = ok ? sectorPath(start, end, clock.inner, 1) : "";
    text = label;
    place = labelPlace(box, (start + end) / 2, 1.02);
  }
  return (
    <div
      data-slot="clock-chart-reference-area"
      data-tone={tone}
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      <svg viewBox={viewBoxOf(box)} focusable="false">
        <path data-slot="clock-chart-reference-path" data-part="area" d={d} />
      </svg>
      {text === undefined ? null : <PlacedLabel place={place}>{text}</PlacedLabel>}
    </div>
  );
}

/** The angle a hand shows now, a running glide included, in its rest's turn. */
function shownAngle(node: SVGElement, rest: number): number {
  const shown = Number.parseFloat(getComputedStyle(node).rotate);
  if (!Number.isFinite(shown)) return rest;
  return rest + ((((shown - rest) % 360) + 540) % 360) - 180;
}

/**
 * The active slot's hand, or its whole sector under "band", which turns to the next slot the short
 * way round on 420/42, through 12 o'clock when that is shorter.
 *
 * @beta
 */
export function ClockChartScrubber({
  variant = "line",
  className,
  style,
}: ClockChartScrubberProps): ReactElement {
  const { model, box, motion } = usePolarContext("ClockChart.Scrubber", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.Scrubber");
  const hand = useRef<SVGGElement>(null);
  const turned = useRef<number | null>(null);
  const { count } = clock;
  useChartFollower("ClockChart.Scrubber", (active, cause) => {
    const node = hand.current;
    if (node === null) return;
    writeAttribute(node, "data-shown", active === null ? null : "");
    if (active === null || count === 0) return;
    const { start, centre } = slotAngles(active.slot, count);
    const target = variant === "band" ? start : centre;
    const from = turned.current;
    const shown = from === null ? null : shownAngle(node, from);
    for (const animation of node.getAnimations()) animation.cancel();
    const rest = shown === null ? target : shown + ((((target - shown) % 360) + 540) % 360) - 180;
    turned.current = rest;
    writeStyle(node, "rotate", `${String(rest)}deg`);
    if (shown === null || cause !== "step" || motion.reduced() || Math.abs(rest - shown) < 1e-6) return;
    const timing = springTiming(CHART_SPRINGS.hand);
    if (!timing.spring) return;
    node.animate([{ rotate: `${String(shown)}deg` }, { rotate: `${String(rest)}deg` }], {
      duration: timing.duration,
      easing: timing.easing,
    });
  });
  const width = count === 0 ? 0 : 360 / count;
  return (
    <svg
      data-slot="clock-chart-scrubber"
      data-variant={variant}
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={style}>
      <g ref={hand} data-part="hand">
        <path
          data-slot="clock-chart-scrubber-path"
          data-part={variant === "band" ? "band" : "line"}
          d={variant === "band" ? sectorPath(0, width, clock.inner, 1) : spokePath(0, clock.inner, 1)}
        />
      </g>
    </svg>
  );
}

/**
 * A hand at Root's `now`, to the minute, with a ping at its tip and an optional label past the rim.
 * It draws nothing when `now` lies outside the cycle.
 *
 * @beta
 */
export function ClockChartNow({
  label,
  tone = "default",
  className,
  style,
}: ClockChartNowProps): ReactElement {
  const { model, box } = usePolarContext("ClockChart.Now", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.Now");
  const now = clock.now;
  const tip = now === null ? null : polarPoint(now.angle, 1);
  return (
    <div
      data-slot="clock-chart-now"
      data-tone={tone}
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {now === null || tip === null ? null : (
        <>
          <svg viewBox={viewBoxOf(box)} focusable="false">
            <path
              data-slot="clock-chart-now-path"
              data-part="hand"
              d={spokePath(now.angle, clock.inner, 1)}
            />
            <path
              data-slot="clock-chart-now-path"
              data-part="ping"
              d={`M${pathNumber(tip.x)},${pathNumber(tip.y)}h0`}
            />
            <path
              data-slot="clock-chart-now-path"
              data-part="dot"
              d={`M${pathNumber(tip.x)},${pathNumber(tip.y)}h0`}
            />
          </svg>
          {label === undefined ? null : (
            <PlacedLabel place={labelPlace(box, now.angle, LABEL_REACH)}>{label}</PlacedLabel>
          )}
        </>
      )}
    </div>
  );
}

Object.assign(ClockChartGrid, { displayName: "ClockChart.Grid" });
Object.assign(ClockChartAngleAxis, { displayName: "ClockChart.AngleAxis" });
Object.assign(ClockChartRadiusAxis, { displayName: "ClockChart.RadiusAxis" });
Object.assign(ClockChartReferenceLine, { displayName: "ClockChart.ReferenceLine" });
Object.assign(ClockChartReferenceArea, { displayName: "ClockChart.ReferenceArea" });
Object.assign(ClockChartScrubber, { displayName: "ClockChart.Scrubber" });
Object.assign(ClockChartNow, { displayName: "ClockChart.Now" });
