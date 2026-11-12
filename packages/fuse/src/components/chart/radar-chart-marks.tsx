"use client";

/**
 * The radar's series marks. Area, Line and Dots each draw one series as a mark of its own on the
 * Root's loop, whose numbers are the series' radius on every spoke: the entrance grows them from
 * the centre over `--chart-intro`, series s starting at 600 + s·150 ms, and a data update moves
 * each spoke's radius over 480 ms. A change of spoke count has no pairing, so the old drawing
 * fades out over the new one in `CHART_CROSSFADE_MS`. An estimated spoke dashes the Line's
 * two edges beside it and hatches the Area's two quadrilaterals, and a missing one removes them and
 * its dot. Each mark's layer carries its series' place, which the stylesheet dims by: hover
 * dims the series other than the nearest and strengthens the nearest's fill, and selection
 * and highlight dim the rest. ActiveDot and Glow keep modules of their own.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { crossfade } from "./chart-crossfade";
import { useSvgIdPrefix, writeAttribute } from "./chart-dom";
import type { MarkValues } from "./chart-motion";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { PolarContextValue } from "./chart-polar-context";
import { PolarHatch } from "./chart-polar-hatch";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { useChartReadout } from "./chart-readout";
import type { ChartLayerProps } from "./chart-types";
import type { PolarPoint } from "./layout/polar-angle";
import { viewBoxOf } from "./layout/polar-angle";
import { dotsPath, loneVertices, radarAreas, radarEdges, zeroPolygon } from "./layout/radar";
import { radiiOf, spokeStatesOf, verticesAt } from "./radar-chart-part";
import type { SpokeStates } from "./radar-chart-part";

/**
 * Props for `RadarChart.Area`, a closed part.
 *
 * @beta
 */
export type RadarChartAreaProps = ChartLayerProps & {
  /** The series the area fills. */
  dataKey: string;
};

/**
 * Props for `RadarChart.Line`, a closed part.
 *
 * @beta
 */
export type RadarChartLineProps = ChartLayerProps & {
  /** The series the outline draws. */
  dataKey: string;
  /** The outline's look. "default" by default. */
  variant?: "default" | "dashed" | "quiet";
};

/**
 * Props for `RadarChart.Dots`, a closed part.
 *
 * @beta
 */
export type RadarChartDotsProps = ChartLayerProps & {
  /** The series whose readings get a dot. */
  dataKey: string;
  /** The dot's look. "default" by default. */
  variant?: "default" | "ring";
};

/** The paths a series mark draws in a frame, by the part each path names. */
type SeriesPaths = ReadonlyMap<string, string>;

/** The Area's quadrilaterals, plain and hatched. */
function areaPaths(spokes: SpokeStates, radii: MarkValues): SeriesPaths {
  const { plain, marked } = radarAreas(
    verticesAt(spokes, radii),
    zeroPolygon(spokes.count, spokes.zero),
    spokes.marked
  );
  return new Map([
    ["solid", plain],
    ["marked", marked],
  ]);
}

/** The Line's runs, solid and dashed, and the dots of its lone readings. */
function linePaths(spokes: SpokeStates, radii: MarkValues): SeriesPaths {
  const vertices = verticesAt(spokes, radii);
  const { plain, marked } = radarEdges(vertices, spokes.marked);
  return new Map([
    ["solid", plain],
    ["marked", marked],
    ["lone", dotsPath(loneVertices(vertices))],
  ]);
}

/** A dot on every reading, and the ring variant's halo under each, which follows the same readings. */
function dotPaths(spokes: SpokeStates, radii: MarkValues): SeriesPaths {
  const points = verticesAt(spokes, radii).filter((vertex): vertex is PolarPoint => vertex !== null);
  const dots = dotsPath(points);
  return new Map([
    ["dots", dots],
    ["halo", dots],
  ]);
}

/** What a series mark's writer reads beside its radii. */
type SeriesLook = {
  readonly spokes: SpokeStates;
  readonly paths: (spokes: SpokeStates, radii: MarkValues) => SeriesPaths;
};

/** Write a frame's paths onto the mark's group, each onto the path of its part. */
function writeSeries(group: SVGGElement, look: SeriesLook, radii: MarkValues): void {
  const paths = look.paths(look.spokes, radii);
  for (const path of group.children) {
    const part = path.getAttribute("data-part");
    const d = part === null ? undefined : paths.get(part);
    if (d !== undefined) writeAttribute(path, "d", d);
  }
}

/** The pieces of one series layer: its drawing, its part's paths, and the paint servers it names. */
type SeriesLayer = {
  readonly slot: string;
  readonly part: string;
  readonly dataKey: string;
  readonly paths: (spokes: SpokeStates, radii: MarkValues) => SeriesPaths;
  readonly variant?: string;
  /** The layer's paths, given the hatch's and the gradient's ids. */
  readonly children: (ids: {
    readonly hatch: string;
    readonly gradient: string;
    readonly first: SeriesPaths;
  }) => ReactNode;
  /** The role list's gradient, when the series paints one. */
  readonly gradient?: (id: string, stops: readonly string[]) => ReactNode;
  /** Whether the layer paints estimated spokes with the hatch. */
  readonly hatch?: boolean;
  readonly className: string | undefined;
  readonly style: CSSProperties | undefined;
};

/** One series layer bound to the loop, its drawing growing, moving or crossfading as R11 and S5 say. */
function useSeriesLayer(polar: PolarContextValue, layer: SeriesLayer): ReactElement {
  const { model, motion, box } = polar;
  const readout = useChartReadout(layer.part);
  readout.assertKey(layer.part, layer.dataKey);
  const radar = radarDrawingIn(model, layer.part);
  const series = radar.series.find(({ key }) => key === layer.dataKey);
  const spokes = useMemo(() => spokeStatesOf(radar, series), [radar, series]);
  const look = useMemo((): SeriesLook => ({ spokes, paths: layer.paths }), [spokes, layer.paths]);
  const { ref, place, node: anchor } = usePolarMark(polar.motion, writeSeries, look);
  const commit = usePolarCommit(polar.commit, anchor);
  const live = useRef<SVGGElement>(null);
  const outgoing = useRef<SVGGElement>(null);
  const drawnCount = useRef<number | null>(null);
  const radii = useMemo(() => radiiOf(radar, series), [radar, series]);
  const index = series?.index ?? 0;
  useLayoutEffect(() => {
    const node = live.current;
    const before = drawnCount.current;
    drawnCount.current = spokes.count;
    const placement = commit(
      index,
      radii.map(() => 0)
    );
    // A change of spoke count pairs no radius with another, so the old drawing fades out over the new,
    // unless the change came while Activity hid the chart, since a show draws every mark at rest.
    if (before !== null && before !== spokes.count) {
      if (node !== null && outgoing.current !== null && !motion.snaps() && !polar.kernel.hidden()) {
        crossfade(node, outgoing.current, () => undefined);
      }
      place(radii, { kind: "snap" });
      return;
    }
    place(radii, placement);
  });
  const prefix = useSvgIdPrefix("radar-chart-series");
  const ids = { hatch: `${prefix}-hatch`, gradient: `${prefix}-paint` };
  // React writes the paths once at rest, and the loop writes them from then on.
  const [first] = useState(() => layer.paths(spokes, radii));
  const stops = series?.stops;
  return (
    <svg
      data-slot={layer.slot}
      data-variant={layer.variant}
      data-radar-series=""
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={layer.className}
      style={{
        "--chart-series": index,
        "--_paint": stops === undefined ? (series?.paint ?? "currentColor") : `url(#${ids.gradient})`,
        "--_base": series?.paint ?? "currentColor",
        "--_hatch-paint": `url(#${ids.hatch})`,
        ...layer.style,
      }}>
      <defs>
        {layer.hatch === true && series !== undefined ? (
          <PolarHatch id={ids.hatch} paint={series.paint} />
        ) : null}
        {stops !== undefined && layer.gradient !== undefined ? layer.gradient(ids.gradient, stops) : null}
      </defs>
      <g
        ref={(element) => {
          live.current = element;
          ref(element);
        }}>
        {layer.children({ ...ids, first })}
      </g>
      <g ref={outgoing} />
    </svg>
  );
}

/** A role list's fill: a radial gradient centred on the series' box, its base at the centre. */
function areaGradient(id: string, stops: readonly string[]): ReactNode {
  const ordered = stops.toReversed();
  return (
    <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
      {ordered.map((stop, index) => (
        <stop
          // A role list may name a role twice, so a stop's place keys it.
          key={index}
          offset={ordered.length < 2 ? 0 : index / (ordered.length - 1)}
          style={{ "--_stop": stop }}
        />
      ))}
    </radialGradient>
  );
}

/** A role list's stroke: a diagonal gradient across the series' box, top left to bottom right. */
function lineGradient(id: string, stops: readonly string[]): ReactNode {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      {stops.map((stop, index) => (
        <stop
          // A role list may name a role twice, so a stop's place keys it.
          key={index}
          offset={stops.length < 2 ? 0 : index / (stops.length - 1)}
          style={{ "--_stop": stop }}
        />
      ))}
    </linearGradient>
  );
}

/**
 * Fills between the zero polygon and the series edge with `fill-rule: evenodd`, as one path of
 * per-edge quadrilaterals. The zero polygon joins the radius of 0 on every spoke with straight edges
 * under both Grid variants, and it is the centre when no value is negative. A filled radar is an
 * Area plus a Line.
 *
 * @beta
 */
export function RadarChartArea({ dataKey, className, style }: RadarChartAreaProps): ReactElement {
  const polar = usePolarContext("RadarChart.Area", ["radar"]);
  return useSeriesLayer(polar, {
    slot: "radar-chart-area",
    part: "RadarChart.Area",
    dataKey,
    paths: areaPaths,
    gradient: areaGradient,
    hatch: true,
    className,
    style,
    children: ({ first }) => (
      <>
        <path data-slot="radar-chart-area-path" data-part="solid" d={first.get("solid")} />
        <path data-slot="radar-chart-area-path" data-part="marked" d={first.get("marked")} />
      </>
    ),
  });
}

/**
 * The series polygon's outline. An outline radar is a Line alone. "dashed" dashes every edge, and
 * "quiet" draws a thin, faint reference, such as last year's series.
 *
 * @beta
 */
export function RadarChartLine({
  dataKey,
  variant = "default",
  className,
  style,
}: RadarChartLineProps): ReactElement {
  const polar = usePolarContext("RadarChart.Line", ["radar"]);
  return useSeriesLayer(polar, {
    slot: "radar-chart-line",
    part: "RadarChart.Line",
    dataKey,
    variant,
    paths: linePaths,
    gradient: lineGradient,
    className,
    style,
    children: ({ first }) => (
      <>
        <path data-slot="radar-chart-line-path" data-part="solid" d={first.get("solid")} />
        <path data-slot="radar-chart-line-path" data-part="marked" d={first.get("marked")} />
        <path data-slot="radar-chart-line-path" data-part="lone" d={first.get("lone")} />
      </>
    ),
  });
}

/**
 * A dot on every reading of one series. "ring" draws each hollow, in a ring of the series' colour.
 *
 * @beta
 */
export function RadarChartDots({
  dataKey,
  variant = "default",
  className,
  style,
}: RadarChartDotsProps): ReactElement {
  const polar = usePolarContext("RadarChart.Dots", ["radar"]);
  return useSeriesLayer(polar, {
    slot: "radar-chart-dots",
    part: "RadarChart.Dots",
    dataKey,
    variant,
    paths: dotPaths,
    className,
    style,
    children: ({ first }) => (
      <>
        <path data-slot="radar-chart-dot" data-part="halo" d={first.get("dots")} />
        <path data-slot="radar-chart-dot" data-part="dots" d={first.get("dots")} />
      </>
    ),
  });
}

Object.assign(RadarChartArea, { displayName: "RadarChart.Area" });
Object.assign(RadarChartLine, { displayName: "RadarChart.Line" });
Object.assign(RadarChartDots, { displayName: "RadarChart.Dots" });
