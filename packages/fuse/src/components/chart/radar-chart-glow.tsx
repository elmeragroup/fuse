"use client";

/**
 * The radar's Glow: it wraps radar marks, and the stylesheet glows their drawn layer, each series
 * in its own colour.
 */
import type { ReactElement, ReactNode } from "react";

import { usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `RadarChart.Glow`, a closed part.
 *
 * @beta
 */
export type RadarChartGlowProps = ChartLayerProps & {
  /** The radar marks to glow. */
  children?: ReactNode;
};

/**
 * Wraps radar marks and glows their drawn layer: each wrapped series casts its own colour, blurred
 * as `Chart.Glow` blurs a line.
 *
 * @beta
 */
export function RadarChartGlow({ children, className, style }: RadarChartGlowProps): ReactElement {
  usePolarContext("RadarChart.Glow", ["radar"]);
  return (
    <div data-slot="radar-chart-glow" className={className} style={style}>
      {children}
    </div>
  );
}

Object.assign(RadarChartGlow, { displayName: "RadarChart.Glow" });
