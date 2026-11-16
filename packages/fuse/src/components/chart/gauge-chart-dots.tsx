"use client";

/**
 * A gauge's dots: concentric rings of dots inside the track, each lit once the reading reaches it,
 * from the offset the Root's loop shows, so the dots light in order as the fill sweeps by.
 */
import { useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { useGaugeContext } from "./chart-gauge-context";
import type { ChartGaugeRole, ChartLayerProps } from "./chart-types";
import { lightReached, useGaugePainter } from "./gauge-chart-painter";
import type { GaugeDrawing } from "./gauge-chart-painter";
import { dotRings, GAUGE_RADII, gaugeAngle, reached } from "./layout/gauge";
import type { DotRing } from "./layout/gauge";
import { polarPoint, viewBoxOf } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { pathNumber } from "./layout/rounding";

/**
 * Props for `GaugeChart.Dots`, a closed part.
 *
 * @beta
 */
export type GaugeChartDotsProps = ChartLayerProps & {
  /** The dots' colour role. */
  color?: ChartGaugeRole;
  /** How many rings of dots, 1 to 6, the outermost just inside the track. */
  rings?: number;
  /**
   * The rings' look. "even" draws every ring alike, and "fade" each ring fainter toward the centre.
   */
  variant?: "even" | "fade";
};

/** What the dots lay out from: the sweep and its rings. */
type DotsLayout = { readonly sweep: Sweep; readonly rings: readonly DotRing[] };

/** The dots' drawing: every dot the offset reaches lit. */
function dotsDrawing(layer: SVGGElement, { rings }: DotsLayout): GaugeDrawing {
  const offsets = rings.flatMap((ring) => ring.offsets);
  const marks = [...layer.querySelectorAll("circle")].map((node, index) => ({
    node,
    offset: offsets[index] ?? Number.POSITIVE_INFINITY,
  }));
  return {
    paint: (offset) => {
      lightReached(marks, "data-lit", offset);
    },
  };
}

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
  const gauge = useGaugeContext("GaugeChart.Dots");
  const { sweep, box } = gauge.model.geometry;
  const layout = useMemo((): DotsLayout => ({ sweep, rings: dotRings(sweep, rings) }), [sweep, rings]);
  const drawn = layout.rings;
  const layer = useRef<SVGGElement>(null);
  const firstRest = useGaugePainter(gauge, layer, layout, dotsDrawing);
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
