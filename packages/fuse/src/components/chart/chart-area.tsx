"use client";

import { useLayoutEffect, useMemo } from "react";
import type { ReactElement } from "react";

import { assertKnownKey, useChartLayout, useChartRoot } from "./chart-context";
import type { MarkValues } from "./chart-motion";
import { useCommitMotion, useMotionMark } from "./chart-motion-mark";
import { placeOf, placePath, seriesPathKind, topologyAt, slotStep, writePath } from "./chart-path-draw";
import type { PathLook } from "./chart-path-draw";
import { PathPaint, hasPathPaint } from "./chart-path-paint";
import { useSeriesPath } from "./chart-series-path";
import type { ChartCurve, ChartLayerProps } from "./chart-types";
import { ChartCompositionError } from "./layout/errors";
import { AREA_STRIDE, areaPaths } from "./layout/line-path";
import type { PlotFrame } from "./layout/plot-frame";

/**
 * Props for `Chart.Area`, a closed part.
 *
 * @beta
 */
export type ChartAreaProps = ChartLayerProps & {
  /** The series the area draws. An unknown key throws `unknown-key`. */
  dataKey: string;
  /**
   * The fill's look. "gradient" by default, which fades from the value toward the baseline, and
   * "gradient-reverse" fades the other way. "solid" fills at `--chart-area-opacity`, and "dotted",
   * "lines" and "hatched" fill with a texture of the series colour, after evilcharts' area fills.
   */
  variant?: "gradient" | "gradient-reverse" | "solid" | "dotted" | "lines" | "hatched";
  /** The curve along the area's edge. "monotone" by default. */
  curve?: ChartCurve;
};

/** Draw an area's frame from the loop's numbers: its fill, and the hatched twin over its spans. */
function drawArea(group: SVGGElement, look: PathLook | null, values: MarkValues): void {
  if (look === null) return;
  const topology = topologyAt(look.moving.current, look.topology, values.length / AREA_STRIDE);
  const { area, dots, hatched } = areaPaths(values, topology, placeOf(look));
  writePath(group, look, area, hatched, "overlay", dots);
}

/**
 * The paint servers of an area's looks. Each look is a mask over the series paint: a ramp along the
 * value axis for the gradients, and a texture for the patterned fills and for the hatched twin that
 * marks estimated, bridged and projected spans.
 */
function AreaMasks({
  prefix,
  frame,
  variant,
}: {
  readonly prefix: string;
  readonly frame: PlotFrame;
  readonly variant: NonNullable<ChartAreaProps["variant"]>;
}): ReactElement {
  const { width, height } = frame.box;
  const vertical = frame.orientation === "vertical";
  const look = variant === "gradient" || variant === "gradient-reverse" ? "ramp" : variant;
  const mask = (id: string, fill: string): ReactElement => (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
      <rect width={width} height={height} fill={fill} />
    </mask>
  );
  return (
    <>
      {look === "ramp" ? (
        <linearGradient
          id={`${prefix}-ramp`}
          gradientUnits="userSpaceOnUse"
          x1={vertical ? 0 : width}
          y1="0"
          x2="0"
          y2={vertical ? height : 0}>
          <stop offset="0" data-part="near" />
          <stop offset="1" data-part="far" />
        </linearGradient>
      ) : null}
      {look === "dotted" ? (
        <pattern id={`${prefix}-texture`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1" />
        </pattern>
      ) : null}
      {look === "lines" ? (
        <pattern
          id={`${prefix}-texture`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)">
          <rect width="1" height="5" />
        </pattern>
      ) : null}
      <pattern
        id={`${prefix}-hatch`}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)">
        <rect width="3" height="6" />
      </pattern>
      {look === "solid"
        ? null
        : mask(
            `${prefix}-look`,
            look === "ramp"
              ? `url(#${prefix}-ramp)`
              : `url(#${prefix}-${look === "hatched" ? "hatch" : "texture"})`
          )}
      {mask(`${prefix}-marks`, `url(#${prefix}-hatch)`)}
    </>
  );
}

/**
 * One series as a filled area down to the baseline, which is 0 in every layout an Area sits in.
 * Series that share a `stack` id stack, each filling from the series below it. The area draws its
 * fill only, so a Line on the same key draws its edge. The spans of estimated readings, of a
 * bridge under `missing: "connect"` and of the projected tail draw hatched over the fill. It moves
 * on a data update as `Chart.Line` does.
 *
 * @beta
 */
export function ChartArea({
  dataKey,
  variant = "gradient",
  curve = "monotone",
  className,
  style,
}: ChartAreaProps): ReactElement {
  const context = useChartRoot("Chart.Area");
  const layout = useChartLayout("Chart.Area");
  assertKnownKey("Chart.Area", context.config, dataKey);
  if (layout.baseline === "none") {
    throw new ChartCompositionError(
      "Chart.Area",
      "baseline-required",
      'draws in a layout with yBaseline="none", but an area encodes its value as the filled height from 0. Keep the zero baseline, or draw a Chart.Line alone.'
    );
  }
  if ((curve === "step-after" || curve === "step-before") && context.xScale === "point") {
    throw new ChartCompositionError(
      "Chart.Area",
      "step-curve-needs-cells",
      `draws curve="${curve}" under xScale="point", where slots have no cells to run across. Use xScale="band", or curve="step".`
    );
  }
  const { motion, update, paths, xScale } = context;
  const state = useSeriesPath("Chart.Area", context, dataKey, curve, AREA_STRIDE, 0);
  const { series, seriesIndex, look, path, topology, rest, prefix } = state;
  const { ref: markRef, node, drawn, place } = useMotionMark(motion, drawArea, look, state.axes);
  const { memoryRef, lastLookRef, outgoingRef } = state;
  const commit = useCommitMotion(update, state.drawn?.plot ?? null, context.orientation);
  useLayoutEffect(() => {
    const asked = commit();
    if (look === null || path === null) return;
    placePath(asked, {
      mark: { ref: markRef, node, drawn, place },
      motion,
      paths,
      seriesIndex,
      drawn: "line",
      kind: seriesPathKind(AREA_STRIDE, slotStep(look.frame, xScale)),
      look,
      path,
      topology,
      rest,
      memory: memoryRef,
      lastLook: lastLookRef,
      outgoing: outgoingRef.current,
      draw: drawArea,
    });
  });
  useLayoutEffect(() => () => paths.delete(seriesIndex, "line"), [paths, seriesIndex]);
  const resting = useMemo(
    () => (look === null ? null : areaPaths(rest, topology, placeOf(look))),
    [look, rest, topology]
  );
  const frame = look?.frame ?? null;
  return (
    <svg
      data-slot="chart-area-series"
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
            <AreaMasks prefix={prefix} frame={frame} variant={variant} />
          </defs>
          <g ref={markRef}>
            <clipPath id={`${prefix}-solid`} data-part="solid-clip" />
            <clipPath id={`${prefix}-marked`} data-part="marked-clip" />
            <path
              data-slot="chart-area"
              data-part="solid"
              data-series={seriesIndex}
              mask={variant === "solid" ? undefined : `url(#${prefix}-look)`}
              d={resting.area}
            />
            <path
              data-slot="chart-area"
              data-part="marked"
              data-series={seriesIndex}
              mask={`url(#${prefix}-marks)`}
              d=""
            />
            {/* A lone reading draws a dot, dashed where its reading is estimated, as L18 asks. */}
            <path data-slot="chart-area" data-part="dot" data-series={seriesIndex} d={resting.dots} />
            <path data-slot="chart-area" data-part="dot-marked" data-series={seriesIndex} d="" />
          </g>
          <g ref={outgoingRef} data-part="outgoing" />
        </>
      )}
    </svg>
  );
}

Object.assign(ChartArea, { displayName: "Chart.Area" });
