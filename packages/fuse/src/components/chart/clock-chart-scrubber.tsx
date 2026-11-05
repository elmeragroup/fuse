"use client";

/**
 * The clock's Scrubber: the active slot's hand, or its sector, which turns to the next slot the
 * short way round on 420/42. The first paint draws it at rest (D18).
 */
import { useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { viewBoxOf } from "./chart-pie-frame";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import { springTiming } from "./chart-spring";
import type { ChartLayerProps } from "./chart-types";
import { spokePath } from "./clock-chart-dial";
import { slotAngles } from "./layout/clock";
import { sectorPath } from "./layout/clock-path";
import { CHART_SPRINGS } from "./layout/motion";

/**
 * Props for `ClockChart.Scrubber`, a closed part.
 *
 * @beta
 */
export type ClockChartScrubberProps = ChartLayerProps & {
  /** "line" draws a hand through the active slot, "band" its whole sector. "line" by default. */
  variant?: "line" | "band";
};

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

Object.assign(ClockChartScrubber, { displayName: "ClockChart.Scrubber" });
