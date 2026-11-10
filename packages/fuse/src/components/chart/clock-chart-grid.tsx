"use client";

/**
 * The clock's grid: rings at the value ticks, spokes at the label ticks and a solid zero ring when
 * the domain spans 0. The first paint draws it at rest, and it never scales out.
 */
import type { ReactElement } from "react";

import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";
import { spokePath } from "./clock-chart-dial";
import { ringPath } from "./layout/clock-path";
import { viewBoxOf } from "./layout/polar-angle";

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
        <path key={label.start} data-slot="clock-chart-spoke" d={spokePath(label.angle, clock.inner, 1)} />
      ))}
    </svg>
  );
}

Object.assign(ClockChartGrid, { displayName: "ClockChart.Grid" });
