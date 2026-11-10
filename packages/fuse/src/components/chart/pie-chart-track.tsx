"use client";

/**
 * The Track: the unfilled sweep behind a gauge pie, with the Pie's corners, or behind each ring,
 * with the ring's caps. It has a module of its own, so a pie's centre ships no ring code.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { pieFrameOf, POP_DURATION, POP_EASING } from "./chart-pie-frame";
import { pieDrawingOf, radialDrawingOf, usePolarContext } from "./chart-polar-context";
import type { PieDrawing, PolarContextValue, RadialDrawing } from "./chart-polar-context";
import { ringDash, ringFrameOf } from "./chart-ring-frame";
import type { RingPlace } from "./chart-ring-frame";
import type { ChartLayerProps } from "./chart-types";
import { arcPath, ringTrack } from "./layout/arc-path";
import { CHART_SPRINGS } from "./layout/motion";
import { viewBoxOf } from "./layout/polar-angle";
import { springEasing } from "./layout/spring";

/** A ring track's scale-out on the Motion table's 100/15 spring, sampled once. */
const GROW = springEasing(CHART_SPRINGS.grow);

/** The scale-out's duration, which the Track's layer carries for the stylesheet. */
const TRACK_DURATION = `${String(GROW.duration)}ms`;

/** The scale-out's easing. */
const TRACK_EASING = GROW.easing;

/**
 * Props for `PieChart.Track`, a closed part.
 *
 * @beta
 */
export type PieChartTrackProps = ChartLayerProps;

/** A pie's Track, which the pie's frame paints with the slices' corners. */
function PieTrack({
  pie,
  polar,
}: {
  readonly pie: PieDrawing;
  readonly polar: PolarContextValue;
}): ReactElement {
  const path = useRef<SVGPathElement>(null);
  const [frame] = useState(() =>
    pieFrameOf(polar.motion, {
      innerRadius: pie.innerRadius,
      cornerRadius: 0,
      sweep: pie.fill,
      track: pie.track,
    })
  );
  useLayoutEffect(() => {
    const node = path.current;
    return node === null ? undefined : frame.track(node);
  }, [frame]);
  // React writes the path once, at no corner, and the frame writes it with the slices' corners.
  const [first] = useState(() =>
    arcPath({
      innerRadius: pie.innerRadius,
      outerRadius: 1,
      startAngle: pie.track.start,
      endAngle: pie.track.end,
    })
  );
  return <path ref={path} data-slot="pie-chart-track" d={first} />;
}

/** One ring's Track: its whole sweep, with the ring's caps, which the radial frame paints. */
function RingTrack({
  radial,
  index,
  polar,
}: {
  readonly radial: RadialDrawing;
  readonly index: number;
  readonly polar: PolarContextValue;
}): ReactElement {
  const ring = radial.rings[index];
  const path = useRef<SVGPathElement>(null);
  const [frame] = useState(() => ringFrameOf(polar.motion, radial.sweep));
  const band = ring === undefined ? 0 : ring.band.outer - ring.band.inner;
  const radius = ring?.band.radius ?? 0;
  const place = useMemo((): RingPlace => ({ radius, band, mode: "dash" }), [radius, band]);
  useLayoutEffect(() => {
    const node = path.current;
    return node === null ? undefined : frame.track(node, place);
  }, [frame, place]);
  const [first] = useState(() => ringDash(radial.sweep.width, place, radial.sweep, null));
  return (
    <path
      ref={path}
      data-slot="pie-chart-track"
      data-chart-ring=""
      data-chart-ring-track=""
      d={ringTrack(radius, radial.sweep)}
      pathLength={radial.sweep.width}
      strokeDasharray={first.dasharray}
      strokeDashoffset={first.dashoffset}
      strokeLinecap={first.linecap}
      style={{ "--chart-slot": index, "--_band": band }}
    />
  );
}

/**
 * The unfilled sweep: behind a gauge pie, the whole sweep from `startAngle` to `endAngle`, with
 * the Pie's `cornerRadius`, which the slices fill only to their total's share of `max`; behind each
 * ring, its whole sweep with the ring's caps. It draws at once, before the marks' entrance, and a
 * ring's track scales out from the centre as the chart comes into view.
 *
 * @beta
 */
export function PieChartTrack({ className, style }: PieChartTrackProps): ReactElement {
  const polar = usePolarContext("PieChart.Track", ["pie", "radial"]);
  const { model, box } = polar;
  const pie = pieDrawingOf(model);
  const radial = radialDrawingOf(model);
  if (pie === null && radial === null) return <></>;
  return (
    <svg
      data-layer="track"
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{
        "--_spring-duration": POP_DURATION,
        "--_spring-easing": POP_EASING,
        "--_grow-duration": TRACK_DURATION,
        "--_grow-easing": TRACK_EASING,
        ...style,
      }}>
      {pie === null ? null : <PieTrack pie={pie} polar={polar} />}
      {radial?.rings.map((ring, index) => (
        <RingTrack key={ring.key} radial={radial} index={index} polar={polar} />
      ))}
    </svg>
  );
}

Object.assign(PieChartTrack, { displayName: "PieChart.Track" });
