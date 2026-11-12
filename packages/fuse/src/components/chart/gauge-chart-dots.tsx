"use client";

/**
 * A gauge's dots: concentric rings of dots inside the track, each lit once the reading reaches it,
 * from the offset the Root's loop shows, so the dots light in order as the fill sweeps by.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { ChartLayerProps } from "./chart-types";
import type { ChartGaugeRole } from "./gauge-chart-track";
import { dotRings, GAUGE_RADII, gaugeAngle, reached } from "./layout/gauge";
import { polarPoint, viewBoxOf } from "./layout/polar-angle";
import { pathNumber } from "./layout/rounding";

/**
 * Props for `GaugeChart.Dots`, a closed part.
 *
 * @beta
 */
export type GaugeChartDotsProps = ChartLayerProps & {
  /** The dots' colour role. "chart-1" by default. */
  color?: ChartGaugeRole;
  /** How many rings of dots, 1 to 6, the outermost just inside the track. 4 by default. */
  rings?: number;
  /** The rings' look: "even", every ring alike, or "fade", each ring fainter toward the centre. "even" by default. */
  variant?: "even" | "fade";
};

/**
 * Concentric rings of dots inside the track, each as far from the next as the rings are apart.
 * A dot lights once the reading reaches it, every ring along the same sweep, and the rest stay
 * faint. `variant="fade"` dims each ring further toward the centre. It sweeps with the fill in
 * every frame, so a gauge may draw it alone, without a Track or a Fill.
 *
 * @beta
 */
export function GaugeChartDots({
  color = "chart-1",
  rings = 4,
  variant = "even",
  className,
  style,
}: GaugeChartDotsProps): ReactElement {
  const { model, frame } = useGaugeContext("GaugeChart.Dots");
  const { sweep, box } = model;
  const drawn = useMemo(() => dotRings(sweep, rings), [sweep, rings]);
  const offsets = useMemo(() => drawn.flatMap((ring) => ring.offsets), [drawn]);
  const layer = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const node = layer.current;
    if (node === null) return undefined;
    const dots = [...node.querySelectorAll("circle")];
    return frame.register({
      paint: (share) => {
        const offset = share * sweep.width;
        dots.forEach((dot, index) => {
          writeAttribute(
            dot,
            "data-lit",
            reached(offsets[index] ?? Number.POSITIVE_INFINITY, offset) ? "" : null
          );
        });
      },
    });
  }, [frame, offsets, sweep]);
  // React writes the lit dots at the reading's rest once, and the frame writes them from then on.
  const rest = model.reading.kind === "value" ? model.reading.offset : 0;
  const [firstRest] = useState(rest);
  return (
    <svg
      data-slot="gauge-chart-dots"
      data-variant={variant}
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{ "--_paint": `var(--${color})`, "--_rings": drawn.length, ...style }}>
      <g ref={layer} data-part="gauge-dial">
        {drawn.map((ring, index) =>
          ring.offsets.map((offset, dot) => {
            const at = polarPoint(gaugeAngle(sweep, offset), ring.radius);
            return (
              <circle
                key={`${String(index)}-${String(dot)}`}
                data-slot="gauge-chart-dot"
                data-lit={reached(offset, firstRest) ? "" : undefined}
                cx={pathNumber(at.x)}
                cy={pathNumber(at.y)}
                r={GAUGE_RADII.dotRadius}
                style={{ "--_ring": index }}
              />
            );
          })
        )}
      </g>
    </svg>
  );
}

Object.assign(GaugeChartDots, { displayName: "GaugeChart.Dots" });
