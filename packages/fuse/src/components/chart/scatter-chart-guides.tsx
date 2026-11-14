"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";

import type { ChartLayerProps, ChartTone, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { formatValue } from "./format/value-format";
import { labelWidth } from "./layout/label-width";
import { hairline, ruleAcross } from "./layout/plot-frame";
import { valueTop } from "./layout/plot-geometry";
import { frameX, frameY, referenceInDomains } from "./layout/scatter-frame";
import { thinTicks } from "./layout/tick-fit";
import { useScatterDomains, useScatterFrame, useScatterRoot } from "./scatter-chart-context";
import { xValueText, yFormatOf } from "./scatter-chart-text";

/**
 * Props for `ScatterChart.Grid`, a closed part.
 *
 * @beta
 */
export type ScatterChartGridProps = ChartLayerProps & {
  /**
   * Which lines to draw, in screen directions. "horizontal" draws lines at the y ticks, "vertical"
   * at the x ticks, and "both" at both, since both axes are numbers.
   */
  orientation?: "horizontal" | "vertical" | "both";
  /** The line style. */
  variant?: "solid" | "dashed";
};

/**
 * Props for `ScatterChart.XAxis`, a closed part.
 *
 * @beta
 */
export type ScatterChartXAxisProps = ChartLayerProps & {
  /** The tick label format. Root's `xFormat` is the default. */
  format?: ValueFormat;
  /** The axis title, such as "Ukemiddeltemperatur (°C)". */
  label?: string;
  /** The tick mark. "dot" draws a dot at each tick. */
  tick?: "none" | "dot";
};

/**
 * Props for `ScatterChart.YAxis`, a closed part.
 *
 * @beta
 */
export type ScatterChartYAxisProps = ChartLayerProps & {
  /** The tick label format. Root's `valueFormat` is the default. */
  format?: ValueFormat;
  /** The axis title, such as "kWh per uke". */
  label?: string;
  /** "start" draws the axis at the left edge and "end" at the right. */
  side?: "start" | "end";
};

/**
 * Props for `ScatterChart.ReferenceLine`, a closed part. It takes a `y`, an `x`, or a `from` and a
 * `to`.
 *
 * @beta
 */
export type ScatterChartReferenceLineProps = ChartLayerProps &
  (
    | {
        /** The y value a horizontal line marks. A line takes a `y`, an `x`, or a `from` and a `to`. */
        y: number;
        /** The x value a vertical line marks. A line takes a `y`, an `x`, or a `from` and a `to`. */
        x?: never;
        /** A segment's first point, as `[x, y]`. A line takes a `y`, an `x`, or a `from` and a `to`. */
        from?: never;
        /** A segment's last point, as `[x, y]`. A line takes a `y`, an `x`, or a `from` and a `to`. */
        to?: never;
      }
    | {
        /** The x value a vertical line marks. A line takes a `y`, an `x`, or a `from` and a `to`. */
        x: number;
        /** The y value a horizontal line marks. A line takes a `y`, an `x`, or a `from` and a `to`. */
        y?: never;
        /** A segment's first point, as `[x, y]`. A line takes a `y`, an `x`, or a `from` and a `to`. */
        from?: never;
        /** A segment's last point, as `[x, y]`. A line takes a `y`, an `x`, or a `from` and a `to`. */
        to?: never;
      }
    | {
        /** A segment's first point, as `[x, y]`. A line takes a `y`, an `x`, or a `from` and a `to`. */
        from: readonly [x: number, y: number];
        /** A segment's last point, as `[x, y]`. A line takes a `y`, an `x`, or a `from` and a `to`. */
        to: readonly [x: number, y: number];
        /** The x value a vertical line marks. A line takes a `y`, an `x`, or a `from` and a `to`. */
        x?: never;
        /** The y value a horizontal line marks. A line takes a `y`, an `x`, or a `from` and a `to`. */
        y?: never;
      }
  ) & {
    /** The visible label. `{value}` prints the line's value in Root's formats. */
    label?: string;
    /** The line style. */
    variant?: "solid" | "dashed";
    /** The line's tone. */
    tone?: ChartTone;
  };

/**
 * Lines at the x and y ticks, behind the marks. Every line is a hairline, 1 px rounded down to
 * whole device pixels, on the device pixel grid. The y line at 0 draws solid, as a value axis's
 * zero does, and an x line at 0 draws as any other.
 *
 * @beta
 */
export function ScatterChartGrid({
  orientation = "both",
  variant = "solid",
  className,
  style,
}: ScatterChartGridProps): ReactElement {
  const context = useScatterRoot("ScatterChart.Grid");
  const frame = useScatterFrame(context);
  const { x, y } = context.model;
  // Mid-glide the drawn domains can be narrower than the ticks, which then lie past the plot.
  const within = (domain: readonly [number, number], tick: number) =>
    tick >= Math.min(...domain) - 1e-9 && tick <= Math.max(...domain) + 1e-9;
  const showY = orientation !== "vertical";
  const showX = orientation !== "horizontal";
  return (
    <svg
      data-slot="chart-grid"
      data-variant={variant}
      data-direction={orientation}
      aria-hidden="true"
      className={className}
      style={frame === null ? style : { "--_rule-width": `${String(hairline(frame.box))}px`, ...style }}>
      {frame === null ? null : (
        <>
          {showY
            ? y.ticks
                .filter((tick) => within(frame.y, tick))
                .map((tick) => (
                  <line
                    key={`y-${String(tick)}`}
                    data-slot="chart-grid-line"
                    data-axis="value"
                    data-zero={tick === 0 ? "" : undefined}
                    {...ruleAcross(frame.box, "horizontal", frameY(frame, tick))}
                  />
                ))
            : null}
          {showX
            ? x.ticks
                .filter((tick) => within(frame.x, tick))
                .map((tick) => (
                  <line
                    key={`x-${String(tick)}`}
                    data-slot="chart-grid-line"
                    data-axis="x"
                    {...ruleAcross(frame.box, "vertical", frameX(frame, tick))}
                  />
                ))
            : null}
        </>
      )}
    </svg>
  );
}

/**
 * The tick strides an x axis thins by. Each divides the next, so every wider width bucket shows a
 * superset of a narrower one's labels, as the thinning requires, and each keeps a nice step.
 */
const STRIDES = [1, 2, 10, 20, 100] as const;

/** A domain share, never −0. */
function shareOf(domain: readonly [number, number], value: number): number {
  const [low, high] = domain;
  return high === low ? 0.5 : (value - low) / (high - low) + 0;
}

/**
 * The x axis along the bottom, with d3 nice ticks over the data. When the labels do not fit, the
 * axis shows fewer: each width bucket shows the smallest stride whose labels fit, and a wider axis
 * never shows fewer labels than a narrower one. It is plot output, so it is hidden from screen
 * readers, which read the same values from the plot's option and the table.
 *
 * @beta
 */
export function ScatterChartXAxis({
  format,
  label,
  tick = "none",
  className,
  style,
}: ScatterChartXAxisProps): ReactElement {
  const context = useScatterRoot("ScatterChart.XAxis");
  const { locale, xFormat } = context;
  const { domain, ticks } = context.model.x;
  // The labels sit at their shares of the drawn domain, which glides on a data update.
  const drawn = useScatterDomains(context).x;
  const labels = useMemo(() => {
    const texts = ticks.map((value) => formatValue(locale, value, format ?? xFormat, "tick").text);
    // The candidates keep every 1st, 2nd or 10th tick, counted from the lowest, so the shown
    // values keep a nice step of the ticks' own, such as −2, 2, 6 and so on up to 18.
    const strides = STRIDES.filter((stride) => stride === 1 || stride < texts.length).map((stride) => ({
      slots: texts.flatMap((_text, slot) => (slot % stride === 0 ? [slot] : [])),
    }));
    const shown = thinTicks(strides, {
      position: (slot) => shareOf(domain, ticks[slot] ?? 0),
      width: (slot) => labelWidth(texts[slot] ?? ""),
    });
    return shown.map(({ slot, visibility }) => ({
      value: ticks[slot] ?? 0,
      text: texts[slot] ?? "",
      visibility,
    }));
  }, [ticks, domain, locale, xFormat, format]);
  return (
    <div data-slot="chart-x-axis" data-tick={tick} aria-hidden="true" className={className} style={style}>
      {labels.flatMap(({ value, text, visibility }) => {
        const at = shareOf(drawn, value);
        return at < -1e-9 || at > 1 + 1e-9
          ? []
          : [
              <span
                key={value}
                data-slot="chart-x-tick"
                data-min={visibility === "always" ? undefined : String(visibility)}
                style={{ "--chart-at": at }}>
                {text}
              </span>,
            ];
      })}
      {label === undefined ? null : <span data-slot="chart-axis-label">{label}</span>}
    </div>
  );
}

/**
 * The y axis at the left edge, or the right under `side="end"`, with d3 nice ticks over the data. A
 * hidden sizer holds every label, so the axis column takes the widest label's width on the server
 * and in every engine alike.
 *
 * @beta
 */
export function ScatterChartYAxis({
  format,
  label,
  side = "start",
  className,
  style,
}: ScatterChartYAxisProps): ReactElement {
  const context = useScatterRoot("ScatterChart.YAxis");
  const { ticks } = context.model.y;
  const drawn = useScatterDomains(context).y;
  const labels = ticks.map((value) => ({
    value,
    text: formatValue(context.locale, value, format ?? yFormatOf(context, undefined), "tick").text,
  }));
  return (
    <div data-slot="chart-y-axis" data-side={side} aria-hidden="true" className={className} style={style}>
      <span data-slot="chart-axis-sizer">
        {labels.map(({ value, text }) => (
          <span key={value}>{text}</span>
        ))}
      </span>
      {labels.flatMap(({ value, text }) => {
        const at = shareOf(drawn, value);
        return at < -1e-9 || at > 1 + 1e-9
          ? []
          : [
              <span
                key={value}
                data-slot="chart-y-tick"
                style={{ "--chart-at": `${String(valueTop(drawn, value))}%` }}>
                {text}
              </span>,
            ];
      })}
      {label === undefined ? null : <span data-slot="chart-axis-label">{label}</span>}
    </div>
  );
}

/**
 * A reference line: a horizontal line at a y value, a vertical line at an x value, or a segment
 * between two points, such as a target or a threshold. Readers hear it as a visually hidden
 * sentence. A line outside the domains draws nothing and keeps its sentence, so pass the value in
 * Root's `xInclude` or `yInclude` to show it, and a segment that crosses an edge draws its part
 * inside.
 *
 * @beta
 */
export function ScatterChartReferenceLine({
  label,
  variant = "solid",
  tone = "default",
  className,
  style,
  ...props
}: ScatterChartReferenceLineProps): ReactElement {
  const context = useScatterRoot("ScatterChart.ReferenceLine");
  const frame = useScatterFrame(context);
  const strings = CHART_STRINGS[context.locale];
  const drawn = useScatterDomains(context);
  const xText = (value: number) => xValueText(context, value, "full");
  const yText = (value: number) => formatValue(context.locale, value, yFormatOf(context, undefined), "full");
  // Every form resolves through one geometry: its part inside the drawn domains, or none.
  const part = referenceInDomains(props, drawn);
  const outside = part === null;
  let axis: "value" | "slot" | "segment";
  let value: FormattedText;
  if (props.y !== undefined) {
    axis = "value";
    value = yText(props.y);
  } else if (props.x !== undefined) {
    axis = "slot";
    value = xText(props.x);
  } else {
    const [fromX, fromY] = props.from;
    const [toX, toY] = props.to;
    axis = "segment";
    const ends = [`${xText(fromX).text} ${yText(fromY).text}`, `${xText(toX).text} ${yText(toY).text}`];
    const spoken = [
      `${xText(fromX).spoken} ${yText(fromY).spoken}`,
      `${xText(toX).spoken} ${yText(toY).spoken}`,
    ];
    value = {
      text: strings.valueRange(ends[0] ?? "", ends[1] ?? ""),
      spoken: strings.valueRange(spoken[0] ?? "", spoken[1] ?? ""),
    };
  }
  // The label sits at the line's x or y, at a horizontal line's right end, and at both coordinates
  // of a segment's visible last end. `share` is the label's x as a share of the plot's width.
  const end = part?.[1];
  const share = axis === "value" ? 1 : shareOf(drawn.x, axis === "slot" ? (props.x ?? 0) : (end?.[0] ?? 0));
  const at =
    axis === "slot" ? share * 100 : valueTop(drawn.y, axis === "value" ? (props.y ?? 0) : (end?.[1] ?? 0));
  const shown = label === undefined ? value.spoken : label.replace("{value}", value.spoken);
  const visible = label === undefined ? null : label.replace("{value}", value.text);
  let rule: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number } | null =
    null;
  if (frame !== null && part !== null) {
    const [[ax, ay], [bx, by]] = part;
    if (axis === "value") rule = ruleAcross(frame.box, "horizontal", frameY(frame, ay));
    else if (axis === "slot") rule = ruleAcross(frame.box, "vertical", frameX(frame, ax));
    else
      rule = { x1: frameX(frame, ax), y1: frameY(frame, ay), x2: frameX(frame, bx), y2: frameY(frame, by) };
  }
  return (
    <div
      data-slot="chart-reference-line"
      data-axis={axis}
      data-outside={outside ? "" : undefined}
      data-variant={variant}
      data-tone={tone}
      className={className}
      style={{
        "--chart-at": `${String(at)}%`,
        "--chart-x": share,
        ...style,
      }}>
      <svg
        aria-hidden="true"
        style={frame === null ? undefined : { "--_rule-width": `${String(hairline(frame.box))}px` }}>
        {rule === null ? null : <line data-slot="chart-reference-rule" {...rule} />}
      </svg>
      <span data-slot="chart-reference-label" aria-hidden="true">
        {visible}
      </span>
      <span data-slot="chart-reference-text">{strings.referenceLine(shown)}</span>
    </div>
  );
}

Object.assign(ScatterChartGrid, { displayName: "ScatterChart.Grid" });
Object.assign(ScatterChartXAxis, { displayName: "ScatterChart.XAxis" });
Object.assign(ScatterChartYAxis, { displayName: "ScatterChart.YAxis" });
Object.assign(ScatterChartReferenceLine, { displayName: "ScatterChart.ReferenceLine" });
