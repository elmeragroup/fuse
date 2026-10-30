"use client";

import { createContext, use, useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { attachJoin, placeAttached } from "./chart-attached";
import type { AttachedShown, FollowerJoin } from "./chart-attached";
import { assertKnownKey, useChartLayout, useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { useChartFollower } from "./chart-followers";
import { ChartHeadlineContext } from "./chart-headline";
import type { JoinLead, MarkValues } from "./chart-motion";
import { useFollowerPlacement, useMotionMark } from "./chart-motion-mark";
import { useChartFrame } from "./chart-plot";
import { fallbackSlot, readingAt, useActivePoint } from "./chart-readout";
import type { ChartFallback, ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { barCellAt, barEndValue, barTip } from "./layout/bar-geometry";
import type { BarCell } from "./layout/bar-geometry";
import { centreOf, hairline, ruleAcross, slotShare, snapAcross, valueShare } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";
import { slotCentre, valueTop } from "./layout/plot-geometry";

/**
 * Props for `Chart.ActiveValue`, a closed part.
 *
 * @beta
 */
export type ChartActiveValueProps = ChartLayerProps & {
  /** The series to print. */
  dataKey: string;
  /** The datum to print when nothing is active. "last" by default. */
  fallback?: ChartFallback;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `Chart.ActiveValueLine`, a closed part.
 *
 * @beta
 */
export type ChartActiveValueLineProps = ChartLayerProps & {
  /** The series whose active value the line marks. */
  dataKey: string;
  /** A `ValueLabel` adds the value as a pill at the value axis. */
  children?: ReactNode;
};

/**
 * The datum a ValueLabel prints, which the enclosing ActiveValueLine or Marker provides: a key and
 * a slot, or the active slot when `slot` is null.
 */
export const ChartDatumContext = createContext<{ readonly key: string; readonly slot: number | null } | null>(
  null
);

/** The bar a series draws at a slot, whose end the value followers sit at. Null where it draws none. */
function cellAt(context: ChartRootContextValue, dataKey: string, slot: number | null): BarCell | null {
  const series = context.model.series.find(({ key }) => key === dataKey);
  return series === undefined || slot === null ? null : barCellAt(context.model, series, slot);
}

/**
 * The value at the active slot, or the `fallback` value when nothing is active, "last" by default.
 * Inside a Headline it is exposed text, with a visually hidden spoken twin wherever the spoken form
 * differs, such as a negative price. Anywhere else it is plot output that readers skip.
 *
 * @beta
 */
export function ChartActiveValue({
  dataKey,
  fallback = "last",
  format,
  className,
  style,
}: ChartActiveValueProps): ReactElement {
  const context = useChartRoot("Chart.ActiveValue");
  const layout = useChartLayout("Chart.ActiveValue");
  assertKnownKey("Chart.ActiveValue", context.config, dataKey);
  const exposed = use(ChartHeadlineContext);
  const point = useActivePoint(context, true);
  const slot = point.slot ?? fallbackSlot(context, dataKey, fallback);
  const reading = slot === null ? undefined : readingAt(context, dataKey, slot);
  const label =
    reading?.kind === "reading"
      ? formatValue(context.locale, reading.value, format ?? context.config[dataKey]?.format ?? {}, "full")
      : null;
  if (!exposed)
    return (
      <PlotValue
        context={context}
        dataKey={dataKey}
        slot={slot}
        label={label?.text}
        className={className}
        style={style}
        y={layout.y.domain}
      />
    );
  return (
    <span data-slot="chart-active-value" className={className} style={style}>
      {label === null || label.text === label.spoken ? (
        label?.text
      ) : (
        <>
          <span aria-hidden="true">{label.text}</span>
          <span data-spoken="">{label.spoken}</span>
        </>
      )}
    </span>
  );
}

/**
 * How a value follower joins what it marks: the bar at its series and slot, or a Bar's columns in
 * the path form, and the series' line where no Bar draws it, so every coordinate it draws is the
 * bar's or the vertex's, at rest and in a tween. Inside a BarGroup it centres over its own bar, as
 * a Marker does.
 */
function joinValue(
  context: ChartRootContextValue,
  dataKey: string,
  slot: number | null,
  fromPoint: (point: MarkValues) => MarkValues,
  rest: MarkValues
): FollowerJoin | undefined {
  const series = context.model.series.find((candidate) => candidate.key === dataKey);
  if (series === undefined || slot === null) return undefined;
  const join = attachJoin(context, series, [slot], rest, "bar");
  return join === undefined
    ? undefined
    : {
        leads: join.leads.map((lead): JoinLead => {
          // A lead that lends its clock moves the follower's own numbers, as many as it reads.
          if ("clock" in lead) return { anchor: lead.anchor, clock: fromPoint([0, 0]).length };
          const { anchor, pick, rest: resting } = lead;
          return {
            anchor,
            pick: (values: MarkValues) => fromPoint(pick(values)),
            rest: resting === undefined ? undefined : (values: MarkValues) => fromPoint(resting(values)),
          };
        }),
        crossfade: join.crossfade,
      };
}

/** What a value follower's writer reads: the frame it draws in, or null before Root measures it. */
type FollowerLook = { readonly frame: PlotFrame | null };

/** Draw ActiveValue at the loop's numbers: its centre along the slot axis and its tip. */
function drawValue(span: HTMLSpanElement, look: FollowerLook, values: MarkValues): void {
  const { frame } = look;
  if (frame === null) return;
  const [centre = 0, end = 0] = values;
  span.style.setProperty("--chart-value-at", String(slotShare(frame, centre) / 100));
  // The tip tweens unsnapped, as the bar's does, and draws on the pixel the bar's edge takes.
  span.style.setProperty("--chart-value-top", `${String(valueShare(frame, snapAcross(frame, end)))}%`);
}

/** Draw the active value line at the loop's number, the tip, across the whole plot. */
function drawValueLine(box: HTMLDivElement, look: FollowerLook, values: MarkValues): void {
  const { frame } = look;
  if (frame === null) return;
  const [end = 0] = values;
  // The pill reads the drawn end as its share of the plot from the value axis's maximum. The tip
  // tweens unsnapped, as the bar's does, and draws on the pixel the bar's edge takes.
  box.style.setProperty("--chart-line-top", `${String(valueShare(frame, snapAcross(frame, end)))}%`);
  // The rule's width, which its stroke and the pill's centring read.
  box.style.setProperty("--_rule-width", `${String(hairline(frame.box))}px`);
  const line = box.querySelector<SVGLineElement>(':scope > svg > [data-slot="chart-active-value-rule"]');
  if (line === null) return;
  const direction = frame.orientation === "vertical" ? "horizontal" : "vertical";
  for (const [name, value] of Object.entries(ruleAcross(frame.box, direction, end))) {
    line.setAttribute(name, String(value));
  }
}

/**
 * An ActiveValue placed directly in Root: plot output above the active bar's far end, or above the
 * fallback datum while nothing is active. Root moves it with the pointer, and it moves with the
 * bars on a data update.
 */
function PlotValue({
  context,
  dataKey,
  slot,
  label,
  y,
  className,
  style,
}: {
  readonly context: ChartRootContextValue;
  readonly dataKey: string;
  /** The fallback datum's slot, which React renders. */
  readonly slot: number | null;
  readonly label: string | undefined;
  readonly y: readonly [number, number];
  readonly className: string | undefined;
  readonly style: ChartActiveValueProps["style"];
}): ReactElement {
  const window = context.model.window;
  const drawn = useChartFrame("Chart.ActiveValue");
  // Before the plot is measured, as on the server, the value sits at its datum's shares of the plot.
  const resting = cellAt(context, dataKey, slot);
  const at = window === null || slot === null ? 0 : slotCentre(window, slot, context.xScale);
  const top = resting === null ? 0 : valueTop(y, barEndValue(resting));
  // Once measured, it moves in the bars' pixels, over the slot's centre at the bar's drawn end.
  const frame = drawn?.frame ?? null;
  const look = useMemo((): FollowerLook => ({ frame }), [frame]);
  // Its centre along the slot axis, then its tip across the value axis.
  const {
    ref: valueRef,
    node: valueNode,
    drawn: valueDrawn,
    place: placeValue,
  } = useMotionMark(
    context.motion,
    drawValue,
    look,
    context.orientation === "vertical" ? (["x", "y"] as const) : (["y", "x"] as const)
  );
  const placeFor = useFollowerPlacement(context.update, drawn?.plot ?? null, context.orientation);
  const outgoing = useRef<HTMLDivElement>(null);
  const last = useRef<AttachedShown<FollowerLook> | null>(null);
  useChartFollower("Chart.ActiveValue", (active, cause) => {
    const shown = active?.slot ?? slot;
    const centre =
      drawn === null || window === null || shown === null
        ? 0
        : centreOf(drawn.frame, shown - window.first, context.xScale);
    // The value joins what draws its slot, so a step onto a bar mid-update draws at that bar's tip.
    const cell = cellAt(context, dataKey, shown);
    const tip = drawn === null || cell === null ? 0 : barTip(drawn.frame, cell);
    const join = joinValue(context, dataKey, shown, (point) => point, [centre, tip]);
    const placement = placeFor(cause, join);
    if (drawn === null || window === null || shown === null || cell === null) return;
    // The value crossfades with the path it sits on, its old text included.
    placeAttached({
      motion: context.motion,
      cause,
      join,
      placement,
      place: (next) => placeValue([centre, tip], next),
      node: valueNode(),
      outgoing: outgoing.current,
      before: valueDrawn(),
      look,
      shown: last,
      draw: (copy, old, values) => {
        if (copy instanceof HTMLSpanElement) drawValue(copy, old, values);
      },
    });
  });
  return (
    <>
      <span
        ref={valueRef}
        data-slot="chart-active-value"
        aria-hidden="true"
        className={className}
        style={{ "--chart-value-at": at, "--chart-value-top": `${String(top)}%`, ...style }}>
        {label}
      </span>
      <div ref={outgoing} data-part="outgoing" />
    </>
  );
}

/**
 * A line across the plot at the active value. A `ValueLabel` child adds the value as a pill at the
 * value axis. Root moves it with the pointer, and it moves with the bars on a data update.
 *
 * @beta
 */
export function ChartActiveValueLine({
  dataKey,
  className,
  style,
  children,
}: ChartActiveValueLineProps): ReactElement {
  const context = useChartRoot("Chart.ActiveValueLine");
  assertKnownKey("Chart.ActiveValueLine", context.config, dataKey);
  const drawn = useChartFrame("Chart.ActiveValueLine");
  const frame = drawn?.frame ?? null;
  const look = useMemo((): FollowerLook => ({ frame }), [frame]);
  // Its tip across the value axis.
  const {
    ref: lineRef,
    node,
    drawn: lineDrawn,
    place,
  } = useMotionMark(context.motion, drawValueLine, look, [
    context.orientation === "vertical" ? "y" : "x",
  ] as const);
  const placeFor = useFollowerPlacement(context.update, drawn?.plot ?? null, context.orientation);
  const outgoing = useRef<HTMLDivElement>(null);
  const shown = useRef<AttachedShown<FollowerLook> | null>(null);
  useChartFollower("Chart.ActiveValueLine", (active, cause) => {
    // The line joins what draws its slot, so a step onto a bar mid-update draws at that bar's tip.
    const cell = active === null ? null : cellAt(context, dataKey, active.slot);
    const tip = drawn === null || cell === null ? 0 : barTip(drawn.frame, cell);
    const join = joinValue(context, dataKey, active?.slot ?? null, (point) => [point[1] ?? 0], [0, tip]);
    const placement = placeFor(cause, join);
    const box = node();
    if (box === null) return;
    // The line shows only while the series draws a value at the active slot.
    if (cell === null || drawn === null) {
      box.removeAttribute("data-value");
      return;
    }
    box.setAttribute("data-value", "");
    // The line and its pill crossfade with the path they sit on, the pill's old text included.
    placeAttached({
      motion: context.motion,
      cause,
      join,
      placement,
      place: (next) => place([tip], next),
      node: box,
      outgoing: outgoing.current,
      before: lineDrawn(),
      look,
      shown,
      draw: (copy, old, values) => {
        if (copy instanceof HTMLDivElement) drawValueLine(copy, old, values);
      },
    });
  });
  // The old line and pill fade out beside the live ones, so the live fade-in never reaches them.
  return (
    <>
      <div
        ref={lineRef}
        data-slot="chart-active-value-line"
        aria-hidden="true"
        className={className}
        style={style}>
        <svg aria-hidden="true">
          {drawn === null ? null : <line data-slot="chart-active-value-rule" x1="0" y1="0" x2="0" y2="0" />}
        </svg>
        <ChartDatumContext value={{ key: dataKey, slot: null }}>{children}</ChartDatumContext>
      </div>
      <div ref={outgoing} data-part="outgoing" />
    </>
  );
}

Object.assign(ChartActiveValue, { displayName: "Chart.ActiveValue" });
Object.assign(ChartActiveValueLine, { displayName: "Chart.ActiveValueLine" });
