"use client";

/**
 * A gauge's progress ring: a thin ring at the rim, inside a Zone band, whose value portion draws in
 * full and whose remainder stays dimmed. The value portion is a sector of the ring's band, which
 * the Root's frame stretches to the offset the loop shows in every frame, ending on the same
 * radial line as the fill and the needle.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { ChartLayerProps } from "./chart-types";
import { bandPath } from "./gauge-chart-dial";
import type { GaugeBand } from "./gauge-chart-dial";
import type { ChartGaugeRole } from "./gauge-chart-track";
import { GAUGE_RADII } from "./layout/gauge";
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

/** The ring's band at the rim of its layer, its ends rounded by a quarter of its width, as the fill's. */
const RING: GaugeBand = {
  inner: GAUGE_RADII.ringInner,
  outer: 1,
  corner: (1 - GAUGE_RADII.ringInner) / 4,
};

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
  const { model, frame } = useGaugeContext("GaugeChart.ProgressRing");
  const { sweep, box } = model;
  const value = useRef<SVGPathElement>(null);
  const rest = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const node = value.current;
    const whole = rest.current;
    if (node === null || whole === null) return undefined;
    let pixels: DialPixels | null = null;
    return frame.register({
      layout: (measured) => {
        pixels = measured;
        writeAttribute(whole, "d", bandPath(sweep.width, RING, sweep, measured));
      },
      paint: (share) => {
        const offset = share * sweep.width;
        writeAttribute(node, "d", bandPath(offset, RING, sweep, pixels));
      },
    });
  }, [frame, sweep]);
  // React writes both bands at the reading's rest once, and the frame writes them from then on.
  const [first] = useState(() => ({
    value: bandPath(model.reading.kind === "value" ? model.reading.offset : 0, RING, sweep, null),
    whole: bandPath(sweep.width, RING, sweep, null),
  }));
  return (
    <svg
      data-slot="gauge-chart-progress-ring"
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{ "--_paint": `var(--${color})`, ...style }}>
      <g data-part="gauge-dial">
        <path ref={rest} data-part="rest" d={first.whole} />
        <path ref={value} data-part="value" data-polar-mark="" d={first.value} />
      </g>
    </svg>
  );
}

Object.assign(GaugeChartProgressRing, { displayName: "GaugeChart.ProgressRing" });
