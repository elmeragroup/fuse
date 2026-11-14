"use client";

import { useRef, useState } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { tooltipPopupClass } from "./chart-tooltip-popup";
import type { ChartLayerProps } from "./chart-types";
import { indexAt, livePixel } from "./layout/live-window";
import {
  useLiveActive,
  useLiveFrame,
  useLivePlot,
  useLiveRoot,
  useShownFeed,
} from "./live-line-chart-context";
import type { LiveActive } from "./live-line-chart-context";
import { readoutOf } from "./live-line-chart-surface";
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
  /** The popup's surface. "frosted" lets the plot show through. */
  variant?: "default" | "frosted";
};

/**
 * A vertical line across the plot and a ring on the line. Under a pointer the line stands at the
 * pointer's x and the ring rides the line there as the window scrolls under it, with no ring past
 * either end of the line, and a key puts both on the reading it steps to. Neither glides. They
 * move with the pointer, and a key step lands at once.
 *
 * @beta
 */
export function LiveLineChartCrosshair({ className, style }: LiveLineChartCrosshairProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Crosshair");
  const plot = useLivePlot(context);
  const group = useRef<SVGGElement>(null);
  const rule = useRef<SVGLineElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  useLiveFrame(
    context,
    plot,
    (frame, geometry) => {
      if (group.current === null || rule.current === null || ring.current === null) return;
      const at = readoutOf(frame, geometry, context.store);
      writeAttribute(group.current, "data-hidden", at === null ? "" : null);
      if (at === null) return;
      // The rule moves along x only and always spans the plot, top to bottom.
      writeAttribute(rule.current, "transform", `translate(${livePixel(at.x)} 0)`);
      writeAttribute(rule.current, "y2", geometry.height);
      // Where the pointer stands past either end of the line, the ring has no line to sit on.
      writeAttribute(ring.current, "data-hidden", at.y === null ? "" : null);
      if (at.y !== null) {
        writeAttribute(ring.current, "transform", `translate(${livePixel(at.x)} ${livePixel(at.y)})`);
      }
    },
    "readout"
  );
  return (
    <svg data-slot="live-line-chart-crosshair" aria-hidden="true" className={className} style={style}>
      {plot === null ? null : (
        <g ref={group} data-hidden="">
          <line ref={rule} data-slot="live-line-chart-crosshair-rule" x1={0} x2={0} y1={0} />
          <circle ref={ring} data-slot="chart-dot" r={4} />
        </g>
      )}
    </svg>
  );
}

/**
 * What opened the tooltip, which holds while it stays open: a key opens it at once, with no
 * entrance, and a pointer with the popup's fade and zoom.
 */
function useOpenedBy(active: LiveActive | null, open: boolean): LiveActive["source"] | null {
  const [opened, setOpened] = useState<LiveActive["source"] | null>(null);
  const next = open ? (opened ?? active?.source ?? null) : null;
  if (next !== opened) setOpened(next);
  return next;
}

/**
 * The active reading's time and value in a popup at the top of the plot, above the crosshair, which
 * moves with it in the same frame and stays inside the plot at either edge. A pointer opens it with
 * a fade and a zoom from the crosshair, and a key opens it at once. It is hidden from screen
 * readers, which read the same reading from the plot's option.
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
  const popup = useRef<HTMLDivElement>(null);
  useLiveFrame(
    context,
    plot,
    (frame, geometry) => {
      const node = popup.current;
      if (node === null) return;
      const at = readoutOf(frame, geometry, context.store);
      if (at === null) return;
      // The popup centres on the crosshair and keeps inside the plot, its container, and zooms
      // from the crosshair's x at its bottom edge. Both are its own properties, so no descendant
      // restyles as it moves.
      const x = `${livePixel(at.x)}px`;
      const left = `clamp(0px, calc(${x} - 50%), calc(100cqw - 100%))`;
      writeStyle(node, "translate", `${left} 0`);
      writeStyle(node, "transform-origin", `calc(${x} - ${left}) 100%`);
    },
    "readout"
  );
  const { text } = context;
  const { points } = useShownFeed(context);
  const point = active === null ? undefined : points[indexAt(points, active.time)];
  const open = point !== undefined && plot !== null;
  const openedBy = useOpenedBy(active, open);
  return (
    <div data-slot="live-line-chart-tooltip" aria-hidden="true">
      {point === undefined || plot === null ? null : (
        <div
          ref={popup}
          data-slot="chart-tooltip"
          data-variant={variant}
          // A pointer opens it as an anchored popup below its anchor opens, fading in and dropping
          // into place on data-open, and a key opens it at once, as keyboard actions never animate.
          data-open={openedBy === "keyboard" ? undefined : ""}
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
