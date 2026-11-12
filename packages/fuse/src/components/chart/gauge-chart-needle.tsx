"use client";

/**
 * A gauge's needle: a pointer that floats inside the track, clear of the centre's text, and turns
 * to the offset the Root's loop shows in every frame, so it rides the same sweep as the fill.
 */
import { useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { GaugeGeometry } from "./chart-gauge-context";
import type { ChartLayerProps } from "./chart-types";
import { useGaugePainter } from "./gauge-chart-painter";
import type { GaugeDrawing } from "./gauge-chart-painter";
import { GAUGE_RADII, gaugeAngle } from "./layout/gauge";
import { viewBoxOf } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { pathNumber } from "./layout/rounding";

/**
 * Props for `GaugeChart.Needle`, a closed part.
 *
 * @beta
 */
export type GaugeChartNeedleProps = ChartLayerProps & {
  /** The needle's shape: a "line" with round ends, or a slim "triangle". "line" by default. */
  variant?: "line" | "triangle";
};

/** The turn that carries the needle from 12 o'clock to an offset. */
function needleTurn(sweep: Sweep, offset: number): string {
  return `rotate(${pathNumber(gaugeAngle(sweep, offset))})`;
}

/** The needle's drawing: its hand turned to the offset. */
function needleDrawing(hand: SVGGElement, { sweep }: GaugeGeometry): GaugeDrawing {
  return {
    paint: (offset) => {
      writeAttribute(hand, "transform", needleTurn(sweep, offset));
    },
  };
}

/** The needle's points at 12 o'clock, its base nearer the centre. */
const BASE = -GAUGE_RADII.needleBase;
const TIP = -GAUGE_RADII.needleTip;
const HALF = GAUGE_RADII.needleHalfWidth;

/**
 * The needle, in the foreground role. It floats from inside the track toward the centre, clear of
 * the centre's text, and turns with the fill in every frame of the entrance and of an update. A
 * reading past either end rests on that end. It hides while the chart has no reading.
 *
 * @beta
 */
export function GaugeChartNeedle({
  variant = "line",
  className,
  style,
}: GaugeChartNeedleProps): ReactElement {
  const gauge = useGaugeContext("GaugeChart.Needle");
  const { geometry } = gauge.model;
  const { sweep, box } = geometry;
  const hand = useRef<SVGGElement>(null);
  const rest = useGaugePainter(gauge, hand, geometry, needleDrawing);
  return (
    <svg
      data-slot="gauge-chart-needle"
      data-variant={variant}
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={style}>
      <g data-part="gauge-dial">
        <g ref={hand} data-part="hand" transform={needleTurn(sweep, rest)}>
          {variant === "line" ? (
            <line x1="0" y1={pathNumber(BASE)} x2="0" y2={pathNumber(TIP)} />
          ) : (
            <polygon
              points={`${pathNumber(-HALF)},${pathNumber(BASE)} ${pathNumber(HALF)},${pathNumber(BASE)} 0,${pathNumber(TIP)}`}
            />
          )}
        </g>
      </g>
    </svg>
  );
}

Object.assign(GaugeChartNeedle, { displayName: "GaugeChart.Needle" });
