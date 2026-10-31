"use client";

import type { ReactElement } from "react";

import { useSeriesPart } from "./chart-context";
import type { MarkValues } from "./chart-motion";
import { useFirstDraw } from "./chart-motion-mark";
import { placeOf, topologyAt, writePath } from "./chart-path-draw";
import type { PathLook } from "./chart-path-draw";
import { PathPaint, hasPathPaint } from "./chart-path-paint";
import { useSeriesPath } from "./chart-series-path";
import { sameShallow, useSteady } from "./chart-steady";
import type { ChartCurve, ChartLayerProps } from "./chart-types";
import { LINE_STRIDE, linePaths } from "./layout/line-path";

/**
 * Props for `Chart.Line`, a closed part.
 *
 * @beta
 */
export type ChartLineProps = ChartLayerProps & {
  /** The series the line draws. An unknown key throws `unknown-key`. */
  dataKey: string;
  /**
   * The line's look. "default" by default. "dashed" dashes the whole line, "flowing" runs its
   * dashes along it, which reduced motion stops, and "quiet" draws a thin, faint line for a
   * reference series such as last year.
   */
  variant?: "default" | "dashed" | "flowing" | "quiet";
  /**
   * The curve through the readings. "monotone" by default. "step-after" and "step-before" run each
   * reading across its whole cell, so they need `xScale="band"` and throw `step-curve-needs-cells`
   * under "point".
   */
  curve?: ChartCurve;
};

/** Draw a line's frame from the loop's numbers: its path, and the dashed twin over its spans. */
function drawLine(group: SVGGElement, look: PathLook | null, values: MarkValues): void {
  if (look === null) return;
  const topology = topologyAt(look.moving.current, look.topology, values.length / LINE_STRIDE);
  const { line, dashed } = linePaths(values, topology, placeOf(look));
  writePath(group, look, line, dashed, "replace");
}

/** The width a line strokes its solid path in, which a consumer's --chart-stroke or the look sets. */
function readStroke(group: SVGGElement): number {
  const solid = group.querySelector('[data-part="solid"]');
  return solid === null ? 0 : Number.parseFloat(getComputedStyle(solid).strokeWidth) || 0;
}

/**
 * One series as a line. A missing reading leaves a gap unless the series' config sets
 * `missing: "connect"`, which bridges it with a dashed segment, and a reading between two gaps
 * draws a dot. The segments that touch an estimated reading, and the tail from config
 * `projectedFrom`, draw dashed. On a data update the line tweens to the new readings with the marks
 * on it, slides when the window moves by whole slots, and crossfades when its slots change in
 * another way.
 *
 * @beta
 */
export function ChartLine({
  dataKey,
  variant = "default",
  curve = "monotone",
  className,
  style,
}: ChartLineProps): ReactElement {
  const { context, layout } = useSeriesPart("Chart.Line", dataKey);
  // An inline style that sets the same values is no change, so the line reads its stroke again
  // only when the variant, the class or the style changes, or the plot resizes.
  const steadyStyle = useSteady(style, sameShallow);
  const { series, seriesIndex, resting, prefix, frame, outgoingRef, markRef, intro, paint } = useSeriesPath(
    "Chart.Line",
    drawLine,
    {
      context,
      layout,
      dataKey,
      curve,
      stride: LINE_STRIDE,
      // A quiet line strokes 1 px and every other look the default 2 px, until the Line reads its style.
      stroke: {
        guess: variant === "quiet" ? 1 : 2,
        inputs: [variant, className, steadyStyle],
        read: readStroke,
      },
    }
  );
  // React draws the first rest, and the loop draws every frame after it.
  const drawn = useFirstDraw(() =>
    resting === null ? null : linePaths(resting.rest, resting.topology, placeOf(resting.look)).line
  );
  return (
    <svg
      data-slot="chart-line-series"
      data-variant={variant}
      data-series={seriesIndex}
      data-intro={intro}
      aria-hidden="true"
      className={className}
      style={{
        "--chart-series-paint": paint.base,
        "--chart-series": seriesIndex,
        "--_paint-server": hasPathPaint(paint) ? `url(#${prefix}-paint)` : undefined,
        ...style,
      }}>
      {frame === null || series === undefined || drawn === null ? null : (
        <>
          <defs>
            <PathPaint id={`${prefix}-paint`} paint={paint} frame={frame} />
          </defs>
          <g ref={markRef}>
            <clipPath id={`${prefix}-solid`} data-part="solid-clip" />
            <clipPath id={`${prefix}-marked`} data-part="marked-clip" />
            <path data-slot="chart-line" data-part="solid" data-series={seriesIndex} d={drawn} />
            <path data-slot="chart-line" data-part="marked" data-series={seriesIndex} d="" />
          </g>
          <g ref={outgoingRef} data-part="outgoing" />
        </>
      )}
    </svg>
  );
}

Object.assign(ChartLine, { displayName: "Chart.Line" });
