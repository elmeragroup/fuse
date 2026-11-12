"use client";

/**
 * A gauge's sector: the wedge from the sweep's start to the reading, inside the track. It is an
 * HTML layer whose CSS gradients draw the wedge, so the conic look can brighten toward the leading
 * edge, which SVG has no gradient for. The Root's frame writes the wedge's start and span onto it in
 * every frame, and the stylesheet draws it from them.
 */
import { useRef } from "react";
import type { ReactElement } from "react";

import { writeStyle } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { GaugeGeometry } from "./chart-gauge-context";
import type { ChartGaugeRole, ChartLayerProps } from "./chart-types";
import { useGaugePainter } from "./gauge-chart-painter";
import type { GaugeDrawing } from "./gauge-chart-painter";
import { GAUGE_RADII } from "./layout/gauge";
import { boxPercent } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { pathNumber } from "./layout/rounding";

/**
 * Props for `GaugeChart.Sector`, a closed part.
 *
 * @beta
 */
export type GaugeChartSectorProps = ChartLayerProps & {
  /** The sector's colour role. "chart-1" by default. */
  color?: ChartGaugeRole;
  /**
   * The wedge's look: "conic" brightens toward the reading's edge, "radial" brightens toward the
   * rim, and "flat" paints one tint. "conic" by default.
   */
  variant?: "conic" | "radial" | "flat";
};

/** The wedge as CSS reads it: the conic gradient's start, clockwise from 12 o'clock, and its span. */
type SectorWedge = { readonly from: string; readonly span: string };

/** The wedge from the sweep's start to an offset. */
function wedge(sweep: Sweep, offset: number): SectorWedge {
  // A counter-clockwise sweep's wedge runs clockwise from the reading back to the start.
  const from = sweep.direction === 1 ? sweep.start : sweep.start - offset;
  return { from: `${pathNumber(from)}deg`, span: `${pathNumber(offset)}deg` };
}

/** The sector's drawing: the wedge to the offset, as custom properties the stylesheet reads. */
function sectorDrawing(layer: HTMLDivElement, { sweep }: GaugeGeometry): GaugeDrawing {
  return {
    paint: (offset) => {
      const { from, span } = wedge(sweep, offset);
      writeStyle(layer, "--_sector-from", from);
      writeStyle(layer, "--_sector-span", span);
    },
  };
}

/**
 * The wedge from the sweep's start to the reading, from outside the centre's text out to just
 * inside the notches, in a tint of its colour role. "conic" brightens along the sweep toward the reading, "radial" toward the rim, and
 * "flat" is one tint. It sweeps with the fill in every frame, so a gauge may draw it alone.
 *
 * @beta
 */
export function GaugeChartSector({
  color = "chart-1",
  variant = "conic",
  className,
  style,
}: GaugeChartSectorProps): ReactElement {
  const gauge = useGaugeContext("GaugeChart.Sector");
  const { geometry } = gauge.model;
  const { sweep, box } = geometry;
  const node = useRef<HTMLDivElement>(null);
  const first = wedge(sweep, useGaugePainter(gauge, node, geometry, sectorDrawing));
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const [cx, cy] = boxPercent(box, 0, 0);
  return (
    <div
      ref={node}
      data-slot="gauge-chart-sector"
      data-variant={variant}
      data-direction={sweep.direction === 1 ? "clockwise" : "counter-clockwise"}
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      className={className}
      style={{
        "--_paint": `var(--${color})`,
        // The dial's centre and the sector's radius, as shares of the box.
        "--_cx": cx,
        "--_cy": cy,
        "--_rx": GAUGE_RADII.sector / width,
        "--_ry": GAUGE_RADII.sector / height,
        // The hole the wedge leaves round the centre, as a share of its reach.
        "--_hole": GAUGE_RADII.sectorInner / GAUGE_RADII.sector,
        "--_sector-from": first.from,
        "--_sector-span": first.span,
        ...style,
      }}
    />
  );
}

Object.assign(GaugeChartSector, { displayName: "GaugeChart.Sector" });
