"use client";

import { useRef } from "react";
import type { ReactElement, RefObject } from "react";

import { ChartDigitRoll } from "./chart-digit-roll";
import { useSvgIdPrefix, writeAttribute, writeStyle } from "./chart-dom";
import type { ChartPlot } from "./chart-plot-measure";
import type { ChartLayerProps } from "./chart-types";
import { liveAreaPath, liveLinePath, livePixel, liveY } from "./layout/live-window";
import type { LiveLineChartCurve } from "./layout/live-window";
import { valueTop } from "./layout/plot-geometry";
import { useLiveFrame, useLivePlot, useLiveRoot, useShownFeed } from "./live-line-chart-context";
import { liveValueText } from "./live-line-chart-text";

/**
 * Props for `LiveLineChart.Line`, a closed part.
 *
 * @beta
 */
export type LiveLineChartLineProps = ChartLayerProps & {
  /**
   * The curve through the readings. "monotone" by default, which never overshoots a reading. Every
   * curve it takes stays between the readings around each segment, so the line stays in the plot.
   */
  curve?: LiveLineChartCurve;
};

/**
 * Props for `LiveLineChart.Area`, a closed part.
 *
 * @beta
 */
export type LiveLineChartAreaProps = ChartLayerProps & {
  /** The curve through the readings, the same as the Line's. "monotone" by default. */
  curve?: LiveLineChartCurve;
  /**
   * The fill. "gradient" by default, which fades from the line's paint to nothing at the plot's
   * bottom edge, and "solid" fills at `--chart-area-opacity`.
   */
  variant?: "gradient" | "solid";
};

/**
 * Props for `LiveLineChart.LiveDot`, a closed part.
 *
 * @beta
 */
export type LiveLineChartLiveDotProps = ChartLayerProps & {
  /**
   * The dot's look. "ping" by default, which sends a ring out from the dot once a cycle, and
   * reduced motion stops the ring. "default" draws the dot alone.
   */
  variant?: "ping" | "default";
};

/**
 * Props for `LiveLineChart.Badge`, a closed part.
 *
 * @beta
 */
export type LiveLineChartBadgeProps = ChartLayerProps;

/** A path part's measured plot, or null before it is measured, and the path element each frame writes. */
type LivePathPart = { readonly plot: ChartPlot | null; readonly path: RefObject<SVGPathElement | null> };

/**
 * A part that draws one path through each frame's vertices: the part's Root, its plot, and the
 * path element each frame writes.
 */
function useLivePath(part: string, curve: LiveLineChartCurve, pathOf: typeof liveLinePath): LivePathPart {
  const context = useLiveRoot(part);
  const plot = useLivePlot(context);
  const path = useRef<SVGPathElement>(null);
  useLiveFrame(context, plot, (frame, geometry) => {
    if (path.current === null) return;
    writeAttribute(path.current, "d", pathOf(geometry, frame.vertices, curve));
  });
  return { plot, path };
}

/**
 * The line through the readings, which runs from the window's left edge on through the latest
 * reading to the right edge, now, at the latest value. It scrolls with the clock, and a new reading
 * grows out of the last one as the value axis eases to fit. It fades in from the left edge, where
 * the readings leave the window. It is plot output, so it is hidden from screen readers, which read
 * the same readings from the plot's option and the table.
 *
 * @beta
 */
export function LiveLineChartLine({
  curve = "monotone",
  className,
  style,
}: LiveLineChartLineProps): ReactElement {
  const { plot, path } = useLivePath("LiveLineChart.Line", curve, liveLinePath);
  return (
    <svg data-slot="live-line-chart-line" aria-hidden="true" className={className} style={style}>
      {plot === null ? null : <path ref={path} data-slot="live-line-chart-line-path" />}
    </svg>
  );
}

/**
 * The area under the line, down to the plot's bottom edge, which scrolls with it. Mount it before
 * the Line, so the line paints over it.
 *
 * @beta
 */
export function LiveLineChartArea({
  curve = "monotone",
  variant = "gradient",
  className,
  style,
}: LiveLineChartAreaProps): ReactElement {
  const { plot, path } = useLivePath("LiveLineChart.Area", curve, liveAreaPath);
  const fill = useSvgIdPrefix("live-line-chart-area");
  return (
    <svg
      data-slot="live-line-chart-area"
      data-variant={variant}
      aria-hidden="true"
      className={className}
      style={style}>
      {plot === null ? null : (
        <>
          <defs>
            <linearGradient id={`${fill}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" data-part="from" />
              <stop offset="1" data-part="to" />
            </linearGradient>
          </defs>
          <path
            ref={path}
            data-slot="live-line-chart-area-path"
            fill={variant === "gradient" ? `url(#${fill}-fill)` : undefined}
          />
        </>
      )}
    </svg>
  );
}

/**
 * The live dot on the line's leading edge, at the right edge of the plot and the latest value,
 * which eases with the line as a new value arrives. Under `variant="ping"` a ring leaves it once a
 * cycle, as `Chart.ActiveDot`'s ping does, so the reader sees the feed is live.
 *
 * @beta
 */
export function LiveLineChartLiveDot({
  variant = "ping",
  className,
  style,
}: LiveLineChartLiveDotProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.LiveDot");
  const plot = useLivePlot(context);
  const group = useRef<SVGGElement>(null);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = group.current;
    if (node === null) return;
    const tip = frame.tip;
    writeAttribute(node, "data-hidden", tip === null ? "" : null);
    if (tip !== null) {
      writeAttribute(
        node,
        "transform",
        `translate(${livePixel(geometry.width)} ${livePixel(liveY(geometry, tip))})`
      );
    }
  });
  return (
    <svg
      data-slot="live-line-chart-live-dot"
      data-variant={variant}
      aria-hidden="true"
      className={className}
      style={style}>
      {plot === null ? null : (
        <g ref={group} data-hidden="">
          {variant === "ping" ? <circle data-slot="chart-dot" data-part="ping" r={4} /> : null}
          <circle data-slot="chart-dot" r={4} />
        </g>
      )}
    </svg>
  );
}

/**
 * A pill beside the plot's right edge that prints the latest value and follows the live dot's
 * height, its digits rolling to each new value on the ticker spring, in the line's paint. It sits
 * in the column a `YAxis` with `side="end"` would take, so pair it with a start-side axis. It is
 * hidden from screen readers, which read the latest value from the description.
 *
 * @beta
 */
export function LiveLineChartBadge({ className, style }: LiveLineChartBadgeProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Badge");
  const plot = useLivePlot(context);
  const pill = useRef<HTMLSpanElement>(null);
  useLiveFrame(context, plot, (frame) => {
    const node = pill.current;
    if (node === null || frame.tip === null) return;
    writeStyle(node, "--chart-at", `${String(valueTop(frame.domain, frame.tip))}%`);
  });
  const { tip } = useShownFeed(context);
  const text = tip === null ? null : liveValueText(context.text, tip, "tick").text;
  return (
    <div data-slot="live-line-chart-badge" aria-hidden="true" className={className} style={style}>
      {text === null ? null : (
        <>
          {/* The sizer gives the column the pill's width on the server and in every engine. */}
          <span data-slot="chart-axis-sizer">
            <span data-part="pill">{text}</span>
          </span>
          {plot === null ? null : (
            <span ref={pill} data-part="pill">
              <ChartDigitRoll text={text} />
            </span>
          )}
        </>
      )}
    </div>
  );
}

Object.assign(LiveLineChartLine, { displayName: "LiveLineChart.Line" });
Object.assign(LiveLineChartArea, { displayName: "LiveLineChart.Area" });
Object.assign(LiveLineChartLiveDot, { displayName: "LiveLineChart.LiveDot" });
Object.assign(LiveLineChartBadge, { displayName: "LiveLineChart.Badge" });
