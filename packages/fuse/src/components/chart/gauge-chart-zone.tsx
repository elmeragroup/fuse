"use client";

/**
 * A gauge's zone: a band at the rim that marks a value range, such as the step above the capacity
 * limit, in a colour role. The dial makes room for the band at the rim, so the track scales in to
 * sit inside it.
 */
import type { ReactElement } from "react";

import { useGaugeContext } from "./chart-gauge-context";
import type { ChartLayerProps } from "./chart-types";
import type { ChartGaugeRole } from "./gauge-chart-track";
import { arcPath } from "./layout/arc-path";
import { GAUGE_RADII, gaugeAngle, rangeOffsets } from "./layout/gauge";
import { viewBoxOf } from "./layout/polar-angle";

/**
 * Props for `GaugeChart.Zone`, a closed part.
 *
 * @beta
 */
export type GaugeChartZoneProps = ChartLayerProps & {
  /** Where the range starts, in the domain's unit. */
  from: number;
  /** Where the range ends, in the domain's unit. */
  to: number;
  /** The band's colour role, such as "chart-sentiment-negative" for the step above a limit. */
  color: ChartGaugeRole;
};

/** A zone band's corner radius, in units of its layer's radius. */
const ZONE_CORNER = 0.012;

/**
 * A band at the rim over a value range, in a colour role. Repeat it for several ranges: each draws
 * its own band, and a later zone paints over an earlier one where they overlap. The range clamps to
 * the domain, and a range wholly outside it draws nothing. The band sits outside the track and
 * inside an outside `Ruler`, and the dial makes room for it at the rim.
 *
 * @beta
 */
export function GaugeChartZone({ from, to, color, className, style }: GaugeChartZoneProps): ReactElement {
  const { model } = useGaugeContext("GaugeChart.Zone");
  const { domain, sweep, box } = model;
  const range = rangeOffsets(domain, sweep, from, to);
  const start = range === null ? null : gaugeAngle(sweep, range.start);
  const end = range === null ? null : gaugeAngle(sweep, range.end);
  return (
    <svg
      data-slot="gauge-chart-zone"
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{ "--_paint": `var(--${color})`, ...style }}>
      <g data-part="gauge-dial">
        {start === null || end === null ? null : (
          <path
            data-slot="gauge-chart-zone-band"
            d={arcPath({
              innerRadius: GAUGE_RADII.zoneInner,
              outerRadius: 1,
              startAngle: Math.min(start, end),
              endAngle: Math.max(start, end),
              cornerRadius: ZONE_CORNER,
            })}
          />
        )}
      </g>
    </svg>
  );
}

Object.assign(GaugeChartZone, { displayName: "GaugeChart.Zone" });
