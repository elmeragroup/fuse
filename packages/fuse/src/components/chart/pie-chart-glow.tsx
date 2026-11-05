"use client";

/**
 * A glow on one slice (R10): a copy of the slice behind the pie, cast as `Chart.Glow` casts a bar's
 * halo, the slice's own paint at half alpha blurred by 8 px. The pie's frame writes the copy's path
 * and pop in every frame the slice draws, so the glow sweeps in, tweens, pops and floors with it.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { pieFrameOf, POP_DURATION, POP_EASING, viewBoxOf } from "./chart-pie-frame";
import { pieDrawingOf, usePolarContext } from "./chart-polar-context";
import { useChartReadout } from "./chart-readout";
import type { ChartLayerProps } from "./chart-types";
import { arcPath } from "./layout/arc-path";

/**
 * Props for `PieChart.Glow`, a closed part.
 *
 * @beta
 */
export type PieChartGlowProps = ChartLayerProps & {
  /** The category whose slice glows. */
  dataKey: string;
};

/**
 * A glow on one slice. It names a category, because Root owns the slice geometry, so a wrapper
 * could not target one slice. A category that folds into Other glows nothing, and Other cannot be
 * named, since it is no config key.
 *
 * @beta
 */
export function PieChartGlow({ dataKey, className, style }: PieChartGlowProps): ReactElement {
  const { model, motion, box } = usePolarContext("PieChart.Glow", ["pie", "radial"]);
  const readout = useChartReadout("PieChart.Glow");
  readout.assertKey("PieChart.Glow", dataKey);
  const pie = pieDrawingOf(model);
  const index = pie === null ? -1 : pie.slices.findIndex((slice) => slice.key === dataKey);
  const slice = index === -1 ? null : (pie?.slices[index] ?? null);
  const halo = useRef<SVGPathElement>(null);
  const [frame] = useState(() =>
    pie === null
      ? null
      : pieFrameOf(motion, { innerRadius: pie.innerRadius, cornerRadius: 0, sweep: pie.fill })
  );
  useLayoutEffect(() => {
    const node = halo.current;
    if (frame === null || node === null || slice === null) return undefined;
    return frame.mirror(slice.key, node);
  }, [frame, slice]);
  const angles = slice?.angles ?? null;
  // React writes the path once, and the pie's frame writes it from then on.
  const [first] = useState(() =>
    angles === null || pie === null
      ? ""
      : arcPath({
          innerRadius: pie.innerRadius,
          outerRadius: 1,
          startAngle: angles.start,
          endAngle: angles.end,
          padAngle: angles.pad,
        })
  );
  return (
    <svg
      data-layer="glow"
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{ "--_spring-duration": POP_DURATION, "--_spring-easing": POP_EASING, ...style }}>
      {slice === null ? null : (
        <path
          ref={halo}
          data-slot="pie-chart-glow"
          data-sector=""
          d={first}
          style={{ "--chart-slot": index, "--_paint": slice.paint }}
        />
      )}
    </svg>
  );
}

Object.assign(PieChartGlow, { displayName: "PieChart.Glow" });
