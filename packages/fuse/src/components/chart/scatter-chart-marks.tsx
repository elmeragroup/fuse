"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { useIntro } from "./chart-store";
import type { ChartLayerProps } from "./chart-types";
import { assertKnownKey } from "./layout/errors";
import { dotCentre, dotDiameter, linePath, pointsPath } from "./layout/scatter-frame";
import type { ScatterCurve, ScatterFrame } from "./layout/scatter-frame";
import { pointOf } from "./layout/scatter-model";
import type { ScatterSeries } from "./layout/scatter-model";
import { dotOf, scatterPaint, useScatterFrame, useScatterRoot, walkOf } from "./scatter-chart-context";
import type { ScatterRootContextValue } from "./scatter-chart-context";

/**
 * Props for `ScatterChart.Points`, a closed part.
 *
 * @beta
 */
export type ScatterChartPointsProps = ChartLayerProps & {
  /**
   * The series the points draw. An unknown key throws `unknown-key`. A series draws all its points
   * as one SVG path, so 100,000 points stay one element per series, and a data update redraws the
   * path in place. Overlapping dots of one series never darken each other.
   */
  dataKey: string;
  /** The dots' diameter. "sm" is 5 px, "md" 8 px and "lg" 11 px. */
  size?: "sm" | "md" | "lg";
  /** The dots' look. "quiet" draws them pale, for a reference series such as last year. */
  variant?: "default" | "quiet";
};

/**
 * Props for `ScatterChart.Line`, a closed part.
 *
 * @beta
 */
export type ScatterChartLineProps = ChartLayerProps & {
  /**
   * The series the line joins. An unknown key throws `unknown-key`. Fuse fits nothing, so compute
   * a fitted line in the app and pass its points as a series of their own.
   */
  dataKey: string;
  /**
   * The d3 curve through the points, in x order, ties by y. "linear" draws straight segments
   * between the points. "step-after" holds each y until the next x, as a tariff step does.
   */
  curve?: ScatterCurve;
  /**
   * The line's look. "dashed" dashes the whole line, "flowing" runs its
   * dashes along it, which reduced motion stops, and "quiet" draws a thin, faint line.
   */
  variant?: "default" | "dashed" | "flowing" | "quiet";
};

/**
 * Props for `ScatterChart.ActiveDot`, a closed part.
 *
 * @beta
 */
export type ScatterChartActiveDotProps = ChartLayerProps & {
  /**
   * The mark on the active point. "ring" draws a ring around the point in its series' colour.
   * "dot" draws a filled dot inside a ring of the surface the chart rests on, `--surface`,
   * for a series a Line draws alone.
   */
  variant?: "ring" | "dot";
};

/** Each size step's diameter in CSS pixels. */
const POINT_SIZE = { sm: 5, md: 8, lg: 11 } as const;

/** The gap between a point's edge and the active ring, in CSS pixels. */
const RING_GAP = 3;

/** The active dot's radius over a line's vertex, as Chart.ActiveDot draws it. */
const VERTEX_RADIUS = 4;

/** What a series mark reads: its Root, its series, the frame it draws in, its intro and its paint. */
type SeriesSetup = {
  readonly context: ScatterRootContextValue;
  readonly series: ScatterSeries | undefined;
  readonly frame: ScatterFrame | null;
  readonly intro: "fade" | "none" | undefined;
  /** The series' paint, which the layer's style carries. */
  readonly paint: string;
  /** The series' place in config order, -1 for a key the model lacks. */
  readonly index: number;
};

/**
 * The setup Points and Line share: the Root, a known config key, the series, the frame, and the
 * `data-intro` a mark writes for its life, by Chart's rule in `useIntro`. It matches the server
 * while it hydrates, joins the entrance when it first draws while the entrance waits, and writes
 * "none" when it first draws after the entrance started, as a series whose Suspense boundary
 * hydrates late. A scatter mark never fades in, so it renders as an initial commit.
 */
function useScatterSeries(part: string, dataKey: string): SeriesSetup {
  const context = useScatterRoot(part);
  assertKnownKey(part, context.config, dataKey);
  const series = context.model.series.find((entry) => entry.key === dataKey);
  const frame = useScatterFrame(context);
  const intro = useIntro(context.store, "initial", context.entrance, frame !== null);
  const paint = scatterPaint(context.config, dataKey);
  return { context, series, frame, intro, paint, index: series?.seriesIndex ?? -1 };
}

/**
 * One series' points, drawn as one path of round dots. A data update redraws the path in place, so
 * 100 000 points stay one element per series, and the points sweep in with the entrance. The layer
 * clips at the plot, past it by a dot's radius, so a point the domains glide toward stays inside
 * the chart until they reach it.
 *
 * @beta
 */
export function ScatterChartPoints({
  dataKey,
  size = "md",
  variant = "default",
  className,
  style,
}: ScatterChartPointsProps): ReactElement {
  const { context, series, frame, intro, paint, index } = useScatterSeries("ScatterChart.Points", dataKey);
  const box = frame?.box;
  const diameter = box === undefined ? POINT_SIZE[size] : dotDiameter(box, POINT_SIZE[size]);
  const { marks } = context;
  useLayoutEffect(
    () => marks.register(dataKey, { kind: "points", diameter, variant }),
    [marks, dataKey, diameter, variant]
  );
  const path = useMemo(
    () => (frame === null || series === undefined ? null : pointsPath(frame, series.xs, series.ys, diameter)),
    [frame, series, diameter]
  );
  return (
    <svg
      data-slot="chart-points"
      data-series={index}
      data-size={size}
      data-variant={variant}
      data-intro={intro}
      aria-hidden="true"
      className={className}
      style={{
        "--chart-series-paint": paint,
        "--chart-series": index,
        // The layer clips at the plot, past it by a dot's radius and its snap, so a dot on the
        // domain's edge stays whole, and a dot a glide has not reached yet stays inside.
        "--_bleed": `${String(diameter / 2 + 1)}px`,
        ...style,
      }}>
      {path === null ? null : <path data-slot="chart-points-path" d={path} strokeWidth={diameter} />}
    </svg>
  );
}

/**
 * One series' points joined in x order, ties by y, so a scatter chart also draws curves over a
 * numeric x, such as a fitted normal line or a charging curve. Fuse fits nothing: pass the fitted
 * points as their own series.
 *
 * @beta
 */
export function ScatterChartLine({
  dataKey,
  curve = "linear",
  variant = "default",
  className,
  style,
}: ScatterChartLineProps): ReactElement {
  const { context, series, frame, intro, paint, index } = useScatterSeries("ScatterChart.Line", dataKey);
  const { marks } = context;
  useLayoutEffect(() => marks.register(dataKey, { kind: "line", variant }), [marks, dataKey, variant]);
  const path = useMemo(
    () => (frame === null || series === undefined ? null : linePath(frame, series.xs, series.ys, curve)),
    [frame, series, curve]
  );
  return (
    <svg
      data-slot="chart-line-series"
      data-series={index}
      data-variant={variant}
      data-intro={intro}
      aria-hidden="true"
      className={className}
      style={{ "--chart-series-paint": paint, "--chart-series": index, ...style }}>
      {path === null || path === "" ? null : <path data-slot="chart-line" data-part="solid" d={path} />}
    </svg>
  );
}

/**
 * The mark on the active point, which follows the pointer and the keyboard outside React: a ring
 * around a point, or a dot on a line's vertex. It shows while a point is active.
 *
 * @beta
 */
export function ScatterChartActiveDot({
  variant = "ring",
  className,
  style,
}: ScatterChartActiveDotProps): ReactElement {
  const context = useScatterRoot("ScatterChart.ActiveDot");
  const frame = useScatterFrame(context);
  const layer = useRef<SVGSVGElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const { store, model, marks, config } = context;
  useLayoutEffect(() => {
    const paint = (): void => {
      const svg = layer.current;
      const circle = dot.current;
      if (svg === null || circle === null) return;
      const { active } = walkOf(store.get(), model);
      if (frame === null || active === null || active >= model.count) {
        writeAttribute(svg, "data-value", null);
        return;
      }
      const point = pointOf(model, active);
      const diameter = dotOf(marks.of(point.key));
      const radius = variant === "ring" ? Math.max(diameter / 2 + RING_GAP, VERTEX_RADIUS) : VERTEX_RADIUS;
      const centre = dotCentre(frame, point.x, point.y, diameter);
      circle.setAttribute("cx", String(centre.x));
      circle.setAttribute("cy", String(centre.y));
      circle.setAttribute("r", String(radius));
      writeAttribute(svg, "data-series", point.seriesIndex);
      writeStyle(svg, "--chart-series", String(point.seriesIndex));
      writeStyle(svg, "--chart-series-paint", scatterPaint(config, point.key));
      // The layer clips at the plot, past it by the ring's radius, half its 2 px stroke and a pixel
      // of snap.
      writeStyle(svg, "--_bleed", `${String(radius + 2)}px`);
      writeAttribute(svg, "data-value", "");
    };
    paint();
    const leaveStore = store.subscribe(paint);
    const leaveMarks = marks.subscribe(paint);
    return () => {
      leaveStore();
      leaveMarks();
    };
  }, [store, model, marks, config, frame, variant]);
  return (
    <svg
      ref={layer}
      data-slot="chart-active-dot"
      data-variant={variant}
      aria-hidden="true"
      className={className}
      style={style}>
      {frame === null ? null : <circle ref={dot} data-slot="chart-dot" r={0} />}
    </svg>
  );
}

Object.assign(ScatterChartPoints, { displayName: "ScatterChart.Points" });
Object.assign(ScatterChartLine, { displayName: "ScatterChart.Line" });
Object.assign(ScatterChartActiveDot, { displayName: "ScatterChart.ActiveDot" });
