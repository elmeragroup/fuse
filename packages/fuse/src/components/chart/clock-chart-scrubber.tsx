"use client";

/**
 * The clock's Scrubber: the active slot's hand, or its sector, which turns with the Root's angle
 * follower, so the active dots and the tooltip turn with it. The first paint draws it at rest.
 */
import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";
import { spokePath } from "./clock-chart-dial";
import { sectorPath } from "./layout/clock-path";
import { viewBoxOf } from "./layout/polar-angle";

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
 * The active slot's hand, or its whole sector under "band". It turns to the next slot the short way
 * round on the Root's angle follower, which keeps its speed across steps and stiffens with a fast
 * pointer, so it turns with the active dots.
 *
 * @beta
 */
export function ClockChartScrubber({
  variant = "line",
  className,
  style,
}: ClockChartScrubberProps): ReactElement {
  const { model, box, kernel } = usePolarContext("ClockChart.Scrubber", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.Scrubber");
  const hand = useRef<SVGGElement>(null);
  const { count } = clock;
  useChartFollower("ClockChart.Scrubber", (active) => {
    const node = hand.current;
    if (node !== null) writeAttribute(node, "data-shown", active === null || count === 0 ? null : "");
  });
  // The follower's angle is the slot's middle, so the band, drawn from 0°, turns half a slot less.
  const lead = variant === "band" && count > 0 ? 180 / count : 0;
  const { follow } = kernel;
  useLayoutEffect(() => {
    const turn = (angle: number): void => {
      const node = hand.current;
      if (node !== null) writeStyle(node, "rotate", `${String(angle - lead)}deg`);
    };
    const shown = follow.shown();
    if (shown !== null) turn(shown);
    return follow.subscribe(turn);
  }, [follow, lead]);
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
