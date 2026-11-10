"use client";

/**
 * A glow on one slice or ring: a copy of the mark behind it, cast as `Chart.Glow` casts a
 * bar's halo, the mark's own paint at half alpha blurred by 8 px. The pie's or the radial chart's
 * frame writes the copy in every frame the mark draws, so the glow sweeps in, tweens, pops or
 * scales, and floors with it.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { pieFrameOf, POP_DURATION, POP_EASING } from "./chart-pie-frame";
import { pieDrawingOf, radialDrawingOf, usePolarContext } from "./chart-polar-context";
import type { PieDrawing, PolarContextValue, RadialDrawing } from "./chart-polar-context";
import { useChartReadout } from "./chart-readout";
import { ringDash, ringFrameOf } from "./chart-ring-frame";
import type { ChartLayerProps } from "./chart-types";
import { arcPath, ringTrack } from "./layout/arc-path";
import { viewBoxOf } from "./layout/polar-angle";

/**
 * Props for `PieChart.Glow`, a closed part.
 *
 * @beta
 */
export type PieChartGlowProps = ChartLayerProps & {
  /** The category whose slice or ring glows. */
  dataKey: string;
};

/** A slice's halo, which the pie's frame paints with the slice's path and pop. */
function SliceGlow({
  pie,
  index,
  polar,
}: {
  readonly pie: PieDrawing;
  readonly index: number;
  readonly polar: PolarContextValue;
}): ReactElement {
  const slice = pie.slices[index];
  const halo = useRef<SVGPathElement>(null);
  const [frame] = useState(() =>
    pieFrameOf(polar.motion, {
      innerRadius: pie.innerRadius,
      cornerRadius: 0,
      sweep: pie.fill,
      track: pie.track,
    })
  );
  const key = slice?.key ?? "";
  useLayoutEffect(() => {
    const node = halo.current;
    return node === null ? undefined : frame.mirror(key, node);
  }, [frame, key]);
  const angles = slice?.angles ?? null;
  // React writes the path once, and the pie's frame writes it from then on.
  const [first] = useState(() =>
    angles === null
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
    <path
      ref={halo}
      data-slot="pie-chart-glow"
      data-chart-sector=""
      d={first}
      style={{ "--chart-slot": index, "--_paint": slice?.paint ?? "currentColor" }}
    />
  );
}

/** A ring's halo, which the radial frame paints with the ring's dash. */
function RingGlow({
  radial,
  index,
  polar,
}: {
  readonly radial: RadialDrawing;
  readonly index: number;
  readonly polar: PolarContextValue;
}): ReactElement {
  const ring = radial.rings[index];
  const halo = useRef<SVGPathElement>(null);
  const [frame] = useState(() => ringFrameOf(polar.motion, radial.sweep));
  const key = ring?.key ?? "";
  useLayoutEffect(() => {
    const node = halo.current;
    return node === null ? undefined : frame.mirror(key, node);
  }, [frame, key]);
  const band = ring === undefined ? 0 : ring.band.outer - ring.band.inner;
  const radius = ring?.band.radius ?? 0;
  const [first] = useState(() =>
    ringDash(ring?.angle ?? 0, { radius, band, mode: "dash" }, radial.sweep, null)
  );
  return (
    <path
      ref={halo}
      data-slot="pie-chart-glow"
      data-chart-ring=""
      d={ringTrack(radius, radial.sweep)}
      pathLength={radial.sweep.width}
      strokeDasharray={first.dasharray}
      strokeDashoffset={first.dashoffset}
      strokeLinecap={first.linecap}
      style={{ "--chart-slot": index, "--_band": band, "--_paint": ring?.paint ?? "currentColor" }}
    />
  );
}

/**
 * A glow on one slice or ring. It names a category, because Root owns the slice and ring geometry,
 * so a wrapper could not target one. A category that folds into Other glows nothing, and Other
 * cannot be named, since it is no config key.
 *
 * @beta
 */
export function PieChartGlow({ dataKey, className, style }: PieChartGlowProps): ReactElement {
  const polar = usePolarContext("PieChart.Glow", ["pie", "radial"]);
  const { model, box } = polar;
  const readout = useChartReadout("PieChart.Glow");
  readout.assertKey("PieChart.Glow", dataKey);
  const pie = pieDrawingOf(model);
  const radial = radialDrawingOf(model);
  const slice = pie === null ? -1 : pie.slices.findIndex((item) => item.key === dataKey);
  const ring = radial === null ? -1 : radial.rings.findIndex((item) => item.key === dataKey);
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
      {pie !== null && slice !== -1 ? (
        <SliceGlow key={dataKey} pie={pie} index={slice} polar={polar} />
      ) : null}
      {radial !== null && ring !== -1 ? (
        <RingGlow key={dataKey} radial={radial} index={ring} polar={polar} />
      ) : null}
    </svg>
  );
}

Object.assign(PieChartGlow, { displayName: "PieChart.Glow" });
