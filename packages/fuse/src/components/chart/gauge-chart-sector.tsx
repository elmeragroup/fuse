"use client";

/**
 * A gauge's sector: the wedge from the sweep's start to the reading, inside the track. It is an
 * HTML layer whose CSS gradients draw the wedge, so the conic look can brighten toward the leading
 * edge, which SVG has no gradient for. The Root's frame writes the wedge's start and span onto it in
 * every frame, and the stylesheet draws it from them.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { writeStyle } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { ChartLayerProps } from "./chart-types";
import type { ChartGaugeRole } from "./gauge-chart-track";
import { GAUGE_RADII } from "./layout/gauge";
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
  const { model, frame } = useGaugeContext("GaugeChart.Sector");
  const { sweep, box } = model;
  const node = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layer = node.current;
    if (layer === null) return undefined;
    return frame.register({
      paint: (share) => {
        const offset = share * sweep.width;
        const { from, span } = wedge(sweep, offset);
        writeStyle(layer, "--_sector-from", from);
        writeStyle(layer, "--_sector-span", span);
      },
    });
  }, [frame, sweep]);
  // React writes the wedge at the reading's rest once, and the frame writes it from then on.
  const [first] = useState(() => wedge(sweep, model.reading.kind === "value" ? model.reading.offset : 0));
  const width = box.right - box.left;
  const height = box.bottom - box.top;
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
        "--_cx": `${pathNumber((-box.left / width) * 100)}%`,
        "--_cy": `${pathNumber((-box.top / height) * 100)}%`,
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
