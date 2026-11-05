"use client";

/**
 * The clock's Glow, which wraps clock marks and glows them.
 */
import type { ReactElement, ReactNode } from "react";

import { usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `ClockChart.Glow`, a closed part.
 *
 * @beta
 */
export type ClockChartGlowProps = ChartLayerProps & {
  /** The clock marks to glow. */
  children?: ReactNode;
};

/**
 * Wraps clock marks and glows them: a series of one paint casts its colour as a line's or a bar's
 * glow does, and a series painted by value glows through a filter that blurs its own pixels, so each
 * halo takes its mark's step.
 *
 * @beta
 */
export function ClockChartGlow({ children, className, style }: ClockChartGlowProps): ReactElement {
  usePolarContext("ClockChart.Glow", ["clock"]);
  return (
    <div data-slot="clock-chart-glow" className={className} style={style}>
      {children}
    </div>
  );
}

Object.assign(ClockChartGlow, { displayName: "ClockChart.Glow" });
