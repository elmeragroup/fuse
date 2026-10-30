"use client";

import { useLayoutEffect, useMemo } from "react";
import type { ReactElement } from "react";

import { assertKnownKey, useChartRoot } from "./chart-context";
import type { MarkValues } from "./chart-motion";
import { useCommitMotion, useMotionMark } from "./chart-motion-mark";
import { placeOf, placePath, seriesPathKind, topologyAt, slotStep, writePath } from "./chart-path-draw";
import type { PathLook } from "./chart-path-draw";
import { PathPaint, hasPathPaint } from "./chart-path-paint";
import { useSeriesPath } from "./chart-series-path";
import type { ChartCurve, ChartLayerProps } from "./chart-types";
import { ChartCompositionError } from "./layout/errors";
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
  const context = useChartRoot("Chart.Line");
  assertKnownKey("Chart.Line", context.config, dataKey);
  if ((curve === "step-after" || curve === "step-before") && context.xScale === "point") {
    throw new ChartCompositionError(
      "Chart.Line",
      "step-curve-needs-cells",
      `draws curve="${curve}" under xScale="point", where slots have no cells to run across. Use xScale="band", or curve="step".`
    );
  }
  const { motion, update, paths, xScale } = context;
  // A quiet line strokes 1 px and every other look the default 2 px, until the Line reads its style.
  const state = useSeriesPath(
    "Chart.Line",
    context,
    dataKey,
    curve,
    LINE_STRIDE,
    variant === "quiet" ? 1 : 2
  );
  const { series, seriesIndex, look, path, topology, rest, prefix } = state;
  const { ref: markRef, node, drawn, place } = useMotionMark(motion, drawLine, look, state.axes);
  const { memoryRef, lastLookRef, outgoingRef, strokeRef } = state;
  const commit = useCommitMotion(update, state.drawn?.plot ?? null, context.orientation);
  useLayoutEffect(() => {
    const asked = commit();
    if (look === null || path === null) return;
    // The stroke's computed width, which a consumer's --chart-stroke or the look sets.
    const solid = node()?.querySelector('[data-part="solid"]');
    if (solid !== null && solid !== undefined) {
      strokeRef.current = Number.parseFloat(getComputedStyle(solid).strokeWidth) || 0;
    }
    placePath(asked, {
      mark: { ref: markRef, node, drawn, place },
      motion,
      paths,
      seriesIndex,
      drawn: "line",
      kind: seriesPathKind(LINE_STRIDE, slotStep(look.frame, xScale)),
      look,
      path,
      topology,
      rest,
      memory: memoryRef,
      lastLook: lastLookRef,
      outgoing: outgoingRef.current,
      draw: drawLine,
    });
  });
  useLayoutEffect(() => () => paths.delete(seriesIndex, "line"), [paths, seriesIndex]);
  const resting = useMemo(
    () => (look === null ? null : linePaths(rest, topology, placeOf(look))),
    [look, rest, topology]
  );
  const frame = look?.frame ?? null;
  return (
    <svg
      data-slot="chart-line-series"
      data-variant={variant}
      data-series={seriesIndex}
      data-intro={state.intro}
      aria-hidden="true"
      className={className}
      style={{
        "--chart-series-paint": state.paint,
        "--chart-series": seriesIndex,
        "--_paint-server": hasPathPaint(state.color) ? `url(#${prefix}-paint)` : undefined,
        ...style,
      }}>
      {frame === null || series === undefined || resting === null ? null : (
        <>
          <defs>
            <PathPaint id={`${prefix}-paint`} series={series} color={state.color} frame={frame} />
          </defs>
          <g ref={markRef}>
            <clipPath id={`${prefix}-solid`} data-part="solid-clip" />
            <clipPath id={`${prefix}-marked`} data-part="marked-clip" />
            <path data-slot="chart-line" data-part="solid" data-series={seriesIndex} d={resting.line} />
            <path data-slot="chart-line" data-part="marked" data-series={seriesIndex} d="" />
          </g>
          <g ref={outgoingRef} data-part="outgoing" />
        </>
      )}
    </svg>
  );
}

Object.assign(ChartLine, { displayName: "Chart.Line" });
