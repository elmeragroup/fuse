"use client";

import { useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { glideFrom, snapGlide } from "./chart-spring";
import { tooltipPopupClass } from "./chart-tooltip-popup";
import type { ChartLayerProps } from "./chart-types";
import { indexAt, livePixel, timeShare } from "./layout/live-window";
import { FOLLOW_SPEEDS } from "./layout/motion";
import { followSpring } from "./layout/spring";
import {
  useLiveActive,
  useLiveFrame,
  useLivePlot,
  useLiveRoot,
  useShownFeed,
} from "./live-line-chart-context";
import { placeOf } from "./live-line-chart-surface";
import { liveName, liveTimeText, liveValueText } from "./live-line-chart-text";

/**
 * Props for `LiveLineChart.Crosshair`, a closed part.
 *
 * @beta
 */
export type LiveLineChartCrosshairProps = ChartLayerProps;

/**
 * Props for `LiveLineChart.Tooltip`, a closed part.
 *
 * @beta
 */
export type LiveLineChartTooltipProps = ChartLayerProps & {
  /** The popup's surface. "default" by default, and "frosted" lets the plot show through. */
  variant?: "default" | "frosted";
};

/**
 * A vertical line through the active reading and a ring on it, which ride the reading as the window
 * scrolls and glide to the next one on the crosshair's spring: the pointer's follow spring, or the
 * fastest one for a key, so a held arrow never trails. Reduced motion moves it at once.
 *
 * @beta
 */
export function LiveLineChartCrosshair({ className, style }: LiveLineChartCrosshairProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Crosshair");
  const plot = useLivePlot(context);
  const group = useRef<SVGGElement>(null);
  const rule = useRef<SVGLineElement>(null);
  // A new active reading renders the part, so a step draws it with no frame running, as on a paused
  // chart or between the redraws of reduced motion. A frame reads the store itself, which a pointer
  // pick in the frame before this render already moved.
  useLiveActive(context);
  // Where the crosshair last rested, which a step to another reading glides from.
  const shown = useRef<{ readonly time: number; readonly x: number; readonly y: number } | null>(null);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = group.current;
    if (node === null || rule.current === null) return;
    const active = context.store.active();
    const place = active === null ? null : placeOf(frame, geometry, active.time);
    writeAttribute(node, "data-hidden", place === null ? "" : null);
    if (active === null || place === null) {
      shown.current = null;
      snapGlide(node);
      return;
    }
    const { x, y } = place;
    writeAttribute(node, "transform", `translate(${livePixel(x)} ${livePixel(y)})`);
    writeAttribute(rule.current, "y1", -y);
    writeAttribute(rule.current, "y2", geometry.height - y);
    const before = shown.current;
    shown.current = { time: place.point.time, x, y };
    // Reduced motion stops a glide that is running too, as when the preference turns on mid-glide.
    if (context.reduced) {
      snapGlide(node);
      return;
    }
    if (before === null || before.time === place.point.time) return;
    const spring = followSpring(active.source === "keyboard" ? FOLLOW_SPEEDS.fast : null);
    glideFrom(node, [before.x - x, before.y - y], spring);
  });
  return (
    <svg data-slot="live-line-chart-crosshair" aria-hidden="true" className={className} style={style}>
      {plot === null ? null : (
        <g ref={group} data-hidden="">
          <line ref={rule} data-slot="live-line-chart-crosshair-rule" x1={0} x2={0} />
          <circle data-slot="chart-dot" r={4} />
        </g>
      )}
    </svg>
  );
}

/**
 * The active reading's time and value in a popup at the top of the plot, which rides the reading
 * as the window scrolls and stays inside the plot at either edge. It is hidden from screen readers,
 * which read the same reading from the plot's option.
 *
 * @beta
 */
export function LiveLineChartTooltip({
  variant = "default",
  className,
  style,
}: LiveLineChartTooltipProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Tooltip");
  const plot = useLivePlot(context);
  const active = useLiveActive(context);
  const layer = useRef<HTMLDivElement>(null);
  useLiveFrame(context, plot, (frame) => {
    const node = layer.current;
    const now = context.store.active();
    if (node === null || now === null) return;
    writeStyle(node, "--chart-at", String(timeShare(frame.window, now.time)));
  });
  const { text } = context;
  const { points } = useShownFeed(context);
  const point = active === null ? undefined : points[indexAt(points, active.time)];
  return (
    <div ref={layer} data-slot="live-line-chart-tooltip" aria-hidden="true">
      {point === undefined || plot === null ? null : (
        <div
          data-slot="chart-tooltip"
          data-variant={variant}
          // It opens as an anchored popup below its anchor does, fading in and dropping into place.
          data-open=""
          data-side="bottom"
          className={tooltipPopupClass(variant, className)}
          style={style}>
          <div data-slot="chart-tooltip-label">{liveTimeText(text, point.time, "full").text}</div>
          <div data-slot="chart-tooltip-items">
            <div data-slot="chart-tooltip-item">
              <span>{liveName(text)}</span>
              <span data-slot="chart-tooltip-value">{liveValueText(text, point.value, "full").text}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(LiveLineChartCrosshair, { displayName: "LiveLineChart.Crosshair" });
Object.assign(LiveLineChartTooltip, { displayName: "LiveLineChart.Tooltip" });
