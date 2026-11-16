"use client";

/**
 * The rings. Each ring is a mark of its own on the Root's loop: its value sweeps in from 0 at
 * 160 + i·100 ms over `--chart-intro`, morphs to new data over 480 ms, and one that enters in
 * an update grows from 0. The ring's frame writes each ring's dash with the floor. A ring
 * draws one of three ways:
 *
 * - a solid stroke whose dash carries the value, round-capped inside the value's angle;
 * - a role list's colours along the sweep, as 6° segments a mask reveals up to the value;
 * - `variant="dotted"`: 40 dots per sweep, of which the value's whole share fills, a mask
 *   revealing them over the faint dots of the rest.
 *
 * An estimated ring paints a hatch of its own colour, a missing one draws nothing, and a ring past
 * its maximum fills the sweep with `data-over-max`. The active ring scales to 1.03 and the rings
 * outside it to 1.02 on a spring, and the rest dim, with no React commit.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { useSvgIdPrefix } from "./chart-dom";
import type { MarkValues } from "./chart-motion";
import { radialDrawingIn, usePolarContext } from "./chart-polar-context";
import type { PolarContextValue, RadialRing } from "./chart-polar-context";
import { PolarHatch } from "./chart-polar-hatch";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { ringDash, ringFrameOf } from "./chart-ring-frame";
import type { RingFrame, RingPlace } from "./chart-ring-frame";
import type { ChartLayerProps } from "./chart-types";
import { ringTrack } from "./layout/arc-path";
import { CHART_SPRINGS } from "./layout/motion";
import { sweepOf, viewBoxOf } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { DIAL_MARKS } from "./layout/rings";
import { springEasing } from "./layout/spring";

/**
 * Props for `RadialChart.Bar`, a closed part.
 *
 * @beta
 */
export type RadialChartBarProps = ChartLayerProps & {
  /**
   * The ring's look. "dotted" draws 40 dots per sweep and fills the value's share of them, whole
   * dots only.
   */
  variant?: "default" | "dotted";
};

/** The rings' hover spring (the Motion table's 400/25), sampled once. */
const HOVER = springEasing(CHART_SPRINGS.pop);

/** The degrees one gradient segment spans. */
const SEGMENT = 6;

/** What a ring's writer reads beside its numbers. */
type RingLook = { readonly frame: RingFrame; readonly key: string; readonly place: RingPlace };

/** Hand a ring's angle this frame to the chart's frame, which paints it with the measured floor. */
function writeRing(node: SVGPathElement, look: RingLook, values: MarkValues): void {
  look.frame.record(look.key, node, values, look.place);
}

/** The colour a role list paints at a share of the sweep, its base at the start and its tip at the end. */
function paintAt(stops: readonly string[], share: number): string {
  const ordered = stops.toReversed();
  if (ordered.length < 2) return ordered[0] ?? "currentColor";
  const at = share * (ordered.length - 1);
  const index = Math.min(ordered.length - 2, Math.floor(at));
  const mix = Math.round((at - index) * 100);
  return `color-mix(in oklab, ${ordered[index + 1] ?? ""} ${String(mix)}%, ${ordered[index] ?? ""})`;
}

/** The 6° segments a role list's ring paints along its sweep. */
function segmentsOf(
  sweep: Sweep
): readonly { readonly start: number; readonly end: number; readonly share: number }[] {
  const count = Math.max(1, Math.ceil(sweep.width / SEGMENT));
  return Array.from({ length: count }, (_, index) => {
    const from = (index * sweep.width) / count;
    const to = ((index + 1) * sweep.width) / count;
    return {
      start: sweep.start + from * sweep.direction,
      end: sweep.start + to * sweep.direction,
      share: (from + to) / 2 / sweep.width,
    };
  });
}

/** One ring: its value's path, mask or dots, and its scale group. */
function RadialRingMark({
  polar,
  frame,
  ring,
  index,
  sweep,
  variant,
  prefix,
}: {
  readonly polar: PolarContextValue;
  readonly frame: RingFrame;
  readonly ring: RadialRing;
  readonly index: number;
  readonly sweep: Sweep;
  readonly variant: "default" | "dotted";
  readonly prefix: string;
}): ReactElement {
  const band = ring.band.outer - ring.band.inner;
  const look: "solid" | "segments" | "dots" =
    variant === "dotted"
      ? "dots"
      : ring.stops !== undefined && ring.quality !== "estimated"
        ? "segments"
        : "solid";
  const place = useMemo(
    (): RingPlace => ({ radius: ring.band.radius, band, mode: look === "dots" ? "dots" : "dash" }),
    [ring.band.radius, band, look]
  );
  const ringLook = useMemo(() => ({ frame, key: ring.key, place }), [frame, ring.key, place]);
  const { ref, place: placeRing, node: anchor } = usePolarMark(polar.motion, writeRing, ringLook);
  const commit = usePolarCommit(polar.commit, anchor);
  const { angle } = ring;
  useLayoutEffect(() => {
    placeRing([angle], commit(index, [0]));
  });
  const track = ringTrack(ring.band.radius, sweep);
  // React writes the dash once, and the frame writes it from then on.
  const [first] = useState(() => ringDash(angle, place, sweep, null));
  const dash = {
    pathLength: sweep.width,
    strokeDasharray: first.dasharray,
    strokeDashoffset: first.dashoffset,
    strokeLinecap: first.linecap,
  };
  const paint = ring.quality === "estimated" ? `url(#${prefix}-hatch-${String(index)})` : ring.paint;
  const mask = `${prefix}-mask-${String(index)}`;
  const cell = sweep.width / DIAL_MARKS;
  return (
    <g
      data-chart-ring=""
      data-over-max={ring.over ? "" : undefined}
      data-quality={ring.quality}
      style={{ "--chart-slot": index, "--chart-series": ring.series, "--_band": band, "--_paint": paint }}>
      {look === "solid" ? (
        <path ref={ref} data-slot="radial-chart-ring" d={track} {...dash} />
      ) : (
        <>
          {/* The region covers the whole dial and a hovered ring's scale, past the 10 % default. */}
          <mask id={mask} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
            <path ref={ref} data-slot="radial-chart-ring" data-part="mask" d={track} {...dash} />
          </mask>
          {look === "dots" ? (
            <>
              <path
                data-slot="radial-chart-ring"
                data-part="dots"
                data-faint=""
                d={track}
                pathLength={sweep.width}
                strokeDasharray={`0 ${String(cell)}`}
                strokeDashoffset={-cell / 2}
              />
              <path
                data-slot="radial-chart-ring"
                data-part="dots"
                d={track}
                pathLength={sweep.width}
                strokeDasharray={`0 ${String(cell)}`}
                strokeDashoffset={-cell / 2}
                mask={`url(#${mask})`}
              />
            </>
          ) : (
            <g mask={`url(#${mask})`}>
              {segmentsOf(sweep).map((segment) => (
                <path
                  key={segment.start}
                  data-slot="radial-chart-ring"
                  data-part="segment"
                  d={ringTrack(ring.band.radius, sweepOf(segment.start, segment.end))}
                  style={{ "--_paint": paintAt(ring.stops ?? [], segment.share) }}
                />
              ))}
            </g>
          )}
        </>
      )}
    </g>
  );
}

/**
 * The rings, one per row, the first outermost. Each fills its share of its maximum and never laps,
 * and a ring past its maximum fills the sweep with `data-over-max`. `variant="dotted"` draws 40
 * dots per sweep and fills the value's share of them, whole dots only. A role list paints along the
 * sweep. Every value above 0 keeps one device pixel of arc.
 *
 * @beta
 */
export function RadialChartBar({ variant = "default", className, style }: RadialChartBarProps): ReactElement {
  const polar = usePolarContext("RadialChart.Bar", ["radial"]);
  const { model, motion, box } = polar;
  const radial = radialDrawingIn(model, "RadialChart.Bar");
  const [frame] = useState(() => ringFrameOf(motion, radial.sweep));
  const svg = useRef<SVGSVGElement>(null);
  const prefix = useSvgIdPrefix("radial-chart-bar");
  useLayoutEffect(() => frame.attach(), [frame]);
  // The frame measures CSS pixels per unit, the dpr and the ring fill, as the cell resizes.
  useLayoutEffect(() => {
    const node = svg.current;
    if (node === null) return undefined;
    const measure = (): void => {
      const width = box.right - box.left;
      const fill = Number.parseFloat(getComputedStyle(node).getPropertyValue("--chart-ring-fill"));
      frame.update(radial.sweep, {
        scale: width > 0 ? node.getBoundingClientRect().width / width : 0,
        dpr: window.devicePixelRatio || 1,
        fill: Number.isFinite(fill) ? fill : 0.7,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [frame, radial.sweep, box]);
  return (
    <svg
      ref={svg}
      data-slot="radial-chart-bar"
      data-variant={variant}
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{
        "--_spring-duration": `${String(HOVER.duration)}ms`,
        "--_spring-easing": HOVER.easing,
        ...style,
      }}>
      <defs>
        {radial.rings.map((ring, index) =>
          ring.quality === "estimated" ? (
            <PolarHatch key={ring.key} id={`${prefix}-hatch-${String(index)}`} paint={ring.paint} />
          ) : null
        )}
      </defs>
      {radial.rings.map((ring, index) => (
        <RadialRingMark
          key={ring.key}
          polar={polar}
          frame={frame}
          ring={ring}
          index={index}
          sweep={radial.sweep}
          variant={variant}
          prefix={prefix}
        />
      ))}
    </svg>
  );
}

Object.assign(RadialChartBar, { displayName: "RadialChart.Bar" });
