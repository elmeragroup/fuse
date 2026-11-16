"use client";

/**
 * The pie's slices. Each slice is a mark of its own on the Root's loop, so it sweeps in on its own
 * stagger, tweens to new data and pops on its own, and the pie's frame paints every slice of a
 * frame together through the rim floor. An estimated slice paints a hatch of its own colour,
 * and a missing one draws no arc (section 8.7). A slice that leaves collapses as a ghost: to
 * Other's seam when it folds into Other, which grows as it takes the slice in, and to its own
 * seam otherwise. The server writes every slice at rest, and the first paint keeps the slices hidden
 * until the chart comes into view.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { useSvgIdPrefix } from "./chart-dom";
import type { MarkValues } from "./chart-motion";
import { pieFrameOf, POP_DURATION, POP_EASING } from "./chart-pie-frame";
import type { PieFrame, PieLook } from "./chart-pie-frame";
import { pieDrawingIn, usePolarContext } from "./chart-polar-context";
import type { PieDrawing, PieSlice, PolarContextValue } from "./chart-polar-context";
import { PolarHatch } from "./chart-polar-hatch";
import { placeExit, usePolarCommit, usePolarMark } from "./chart-polar-motion";
import type { ChartLayerProps } from "./chart-types";
import { arcPath } from "./layout/arc-path";
import { OTHER_KEY } from "./layout/pie";
import { viewBoxOf } from "./layout/polar-angle";

/**
 * Props for `PieChart.Pie`, a closed part.
 *
 * @beta
 */
export type PieChartPieProps = ChartLayerProps & {
  /**
   * The slices' corner radius as a fraction of the outer radius, from 0 to 0.5. It is a fraction
   * because the plot keeps its aspect.
   */
  cornerRadius?: number;
};

/** What a slice's writer reads beside its numbers. */
type SectorLook = {
  readonly frame: PieFrame;
  readonly key: string;
  readonly pad: number;
  readonly order: number;
};

/** Hand a slice's angles this frame to the pie's frame, which paints the pie together. */
function writeSector(node: SVGPathElement, look: SectorLook, values: MarkValues): void {
  look.frame.record(look.key, node, values, { pad: look.pad, order: look.order, kind: "slice" });
}

/** The pie's look from its drawing and its corner. */
function lookOf(pie: PieDrawing, cornerRadius: number): PieLook {
  return {
    innerRadius: pie.innerRadius,
    cornerRadius: Math.min(0.5, Math.max(0, cornerRadius)),
    sweep: pie.fill,
    track: pie.track,
  };
}

/**
 * Where each slice rests: its angles, or, for one that draws no arc, zero width where the slice
 * before it ends, so it grows from its own seam when it comes back.
 */
function targetsOf(pie: PieDrawing): readonly (readonly [number, number])[] {
  let seam = pie.fill.start;
  return pie.slices.map(({ angles }) => {
    if (angles === null) return [seam, seam] as const;
    seam = angles.end;
    return [angles.start, angles.end] as const;
  });
}

/** A slice's path at rest, as the server writes it. */
function restPath(look: PieLook, target: readonly [number, number], pad: number): string {
  const [start, end] = target;
  if (start === end) return "";
  return arcPath({
    innerRadius: look.innerRadius,
    outerRadius: 1,
    startAngle: start,
    endAngle: end,
    padAngle: pad,
    cornerRadius: look.cornerRadius,
  });
}

/** One slice: the path the frame writes and the pop moves. */
function PieSector({
  polar,
  frame,
  slice,
  index,
  target,
  look,
  fill,
}: {
  readonly polar: PolarContextValue;
  readonly frame: PieFrame;
  readonly slice: PieSlice;
  readonly index: number;
  readonly target: readonly [number, number];
  readonly look: PieLook;
  readonly fill: string;
}): ReactElement {
  const pad = slice.angles?.pad ?? 0;
  const sectorLook = useMemo(
    () => ({ frame, key: slice.key, pad, order: index }),
    [frame, slice.key, pad, index]
  );
  const { ref, place, node: anchor } = usePolarMark(polar.motion, writeSector, sectorLook);
  const commit = usePolarCommit(polar.commit, anchor);
  const [start, end] = target;
  useLayoutEffect(() => {
    place([start, end], commit(index, [start, start]));
  });
  // React writes the path once, and the loop writes it from then on.
  const [first] = useState(() => restPath(look, target, pad));
  return (
    <path
      ref={ref}
      data-slot="pie-chart-sector"
      data-chart-sector=""
      data-quality={slice.quality}
      d={first}
      style={{ "--chart-slot": index, "--chart-series": slice.series, "--_paint": fill }}
    />
  );
}

/**
 * The slices, drawn in data order from `startAngle`, clockwise, Other last. A slice that holds a
 * role list paints from the rim to the hole along its bisector, the list's tip at the rim. The
 * active slice pops `--chart-slice-pop` along its bisector on a spring, and the rest dim to
 * `--chart-hover-dim`, both with no React commit. A selected or highlighted category dims the rest
 * too. Every finite reading above 0 keeps at least one device pixel of rim.
 *
 * @beta
 */
export function PieChartPie({ cornerRadius = 0, className, style }: PieChartPieProps): ReactElement {
  const polar = usePolarContext("PieChart.Pie", ["pie"]);
  const { model, motion, box, kernel } = polar;
  const { update } = polar.commit;
  const pie = pieDrawingIn(model, "PieChart.Pie");
  const look = useMemo(() => lookOf(pie, cornerRadius), [pie, cornerRadius]);
  const [frame] = useState(() => pieFrameOf(motion, look));
  const svg = useRef<SVGSVGElement>(null);
  const ghosts = useRef<SVGGElement>(null);
  const prefix = useSvgIdPrefix("pie-chart-pie");
  const targets = useMemo(() => targetsOf(pie), [pie]);
  useLayoutEffect(() => frame.attach(), [frame]);
  // The frame measures the pie's CSS pixels per unit, its pop, its seam and the dpr, as the cell resizes.
  useLayoutEffect(() => {
    const node = svg.current;
    if (node === null) return undefined;
    const measure = (): void => {
      const width = box.right - box.left;
      const tokens = getComputedStyle(node);
      frame.update(look, {
        scale: width > 0 ? node.getBoundingClientRect().width / width : 0,
        pop: Number.parseFloat(tokens.getPropertyValue("--chart-slice-pop")) || 0,
        seam: Number.parseFloat(tokens.getPropertyValue("--chart-slice-seam")) || 0,
        dpr: window.devicePixelRatio || 1,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [frame, look, box]);
  // A slice that leaves collapses as a ghost, to Other's seam when it folds, or to its own.
  const drawn = useRef<{ readonly pie: PieDrawing; readonly targets: typeof targets } | null>(null);
  const exits = useRef(0);
  useLayoutEffect(() => {
    const before = drawn.current;
    drawn.current = { pie, targets };
    const layer = ghosts.current;
    // A show draws every mark at rest, so a slice removed while Activity hid the chart leaves no ghost.
    if (
      before === null ||
      before.pie === pie ||
      layer === null ||
      update.kind !== "data" ||
      kernel.hidden()
    ) {
      return;
    }
    const kept = new Set(pie.slices.map(({ key }) => key));
    before.pie.slices.forEach((slice, order) => {
      if (kept.has(slice.key)) return;
      const from = frame.last(slice.key) ?? before.targets[order];
      if (from === undefined) return;
      const seam = collapseAngle(before.pie, pie, targets, order);
      exits.current += 1;
      const ghost = `${prefix}-ghost-${String(exits.current)}`;
      placeExit(
        motion,
        layer,
        ghost,
        from,
        [seam, seam],
        (path, values) => {
          frame.record(ghost, path, values, {
            pad: slice.angles?.pad ?? 0,
            order: order - 0.5,
            kind: "ghost",
          });
        },
        { "data-slot": "pie-chart-ghost", style: `fill: ${slice.paint}` }
      );
    });
  }, [pie, targets, frame, motion, prefix, update, kernel]);
  return (
    <svg
      ref={svg}
      data-slot="pie-chart-pie"
      data-polar-layer=""
      data-polar-mark=""
      data-over-max={pie.over ? "" : undefined}
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{ "--_spring-duration": POP_DURATION, "--_spring-easing": POP_EASING, ...style }}>
      <defs>
        {pie.slices.map((slice, index) =>
          slice.quality === "estimated" ? (
            <PolarHatch key={slice.key} id={`${prefix}-paint-${String(index)}`} paint={slice.paint} />
          ) : slice.stops === undefined ? null : (
            <radialGradient
              key={slice.key}
              id={`${prefix}-paint-${String(index)}`}
              gradientUnits="userSpaceOnUse"
              cx="0"
              cy="0"
              r="1">
              {slice.stops.toReversed().map((stop, place, stops) => (
                <stop
                  // A role list may name a role twice, so a stop's place keys it.
                  key={place}
                  offset={pie.innerRadius + ((1 - pie.innerRadius) * place) / Math.max(1, stops.length - 1)}
                  style={{ "--_stop": stop }}
                />
              ))}
            </radialGradient>
          )
        )}
      </defs>
      {pie.slices.map((slice, index) => (
        <PieSector
          key={slice.key}
          polar={polar}
          frame={frame}
          slice={slice}
          index={index}
          target={targets[index] ?? [pie.fill.start, pie.fill.start]}
          look={look}
          fill={
            slice.stops === undefined && slice.quality !== "estimated"
              ? slice.paint
              : `url(#${prefix}-paint-${String(index)})`
          }
        />
      ))}
      <g ref={ghosts} />
    </svg>
  );
}

/**
 * Where a leaving slice collapses: Other's start when it folds into Other, which then grows from
 * there, and otherwise where the next slice that stays now starts, or the sweep's end.
 */
function collapseAngle(
  before: PieDrawing,
  after: PieDrawing,
  targets: readonly (readonly [number, number])[],
  order: number
): number {
  const key = before.slices[order]?.key ?? "";
  const into =
    after.sliceOf(key) === OTHER_KEY ? after.slices.findIndex((slice) => slice.key === OTHER_KEY) : -1;
  if (into !== -1) return targets[into]?.[0] ?? after.fill.end;
  for (const next of before.slices.slice(order + 1)) {
    const place = after.slices.findIndex((slice) => slice.key === next.key);
    if (place !== -1) return targets[place]?.[0] ?? after.fill.end;
  }
  return after.fill.end;
}

Object.assign(PieChartPie, { displayName: "PieChart.Pie" });
