"use client";

/**
 * A gauge's progress ring: a thin ring at the rim, inside a Zone band, whose value portion draws in
 * full and whose remainder stays dimmed. The value portion is a sector of the ring's band, which
 * the Root's frame stretches to the offset the loop shows in every frame, ending on the same
 * radial line as the fill and the needle.
 */
import { useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { GaugeGeometry } from "./chart-gauge-context";
import type { ChartGaugeRole, ChartLayerProps } from "./chart-types";
import { useGaugePainter } from "./gauge-chart-painter";
import type { GaugeDrawing } from "./gauge-chart-painter";
import { bandPath, GAUGE_RADII, rimBand } from "./layout/gauge";
import type { DialPixels } from "./layout/gauge";
import { viewBoxOf } from "./layout/polar-angle";

/**
 * Props for `GaugeChart.ProgressRing`, a closed part.
 *
 * @beta
 */
export type GaugeChartProgressRingProps = ChartLayerProps & {
  /** The ring's colour role. "chart-1" by default. */
  color?: ChartGaugeRole;
};

/** The ring's band at the rim of its layer, its ends rounded as the solid fill's. */
const RING = rimBand(GAUGE_RADII.ringInner);

/** The ring's drawing: the whole band laid out for the dial, and the value's band to the offset. */
function ringDrawing(group: SVGGElement, { sweep }: GaugeGeometry): GaugeDrawing {
  const whole = group.querySelector(":scope > [data-part='rest']");
  const value = group.querySelector(":scope > [data-part='value']");
  let measured: DialPixels | null = null;
  return {
    layout: (pixels) => {
      measured = pixels;
      if (whole !== null) writeAttribute(whole, "d", bandPath(sweep.width, RING, sweep, pixels));
    },
    paint: (offset) => {
      if (value !== null) writeAttribute(value, "d", bandPath(offset, RING, sweep, measured));
    },
  };
}

/**
 * A thin ring at the rim: the reading's share of the sweep in full colour over the whole sweep
 * dimmed, its ends rounded inside the reading's angle, and at least one device pixel of arc for any value above `min`. It sits
 * outside the track and inside a `Zone` band, and the dial makes room for it at the rim, so a gauge
 * may also draw it alone, without a Track or a Fill. It sweeps with the fill in every frame.
 *
 * @beta
 */
export function GaugeChartProgressRing({
  color = "chart-1",
  className,
  style,
}: GaugeChartProgressRingProps): ReactElement {
  const gauge = useGaugeContext("GaugeChart.ProgressRing");
  const { geometry } = gauge.model;
  const { sweep, box } = geometry;
  const group = useRef<SVGGElement>(null);
  const rest = useGaugePainter(gauge, group, geometry, ringDrawing);
  return (
    <svg
      data-slot="gauge-chart-progress-ring"
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{ "--_paint": `var(--${color})`, ...style }}>
      <g ref={group} data-part="gauge-dial">
        <path data-part="rest" d={bandPath(sweep.width, RING, sweep, null)} />
        <path data-part="value" data-polar-mark="" d={bandPath(rest, RING, sweep, null)} />
      </g>
    </svg>
  );
}

Object.assign(GaugeChartProgressRing, { displayName: "GaugeChart.ProgressRing" });
