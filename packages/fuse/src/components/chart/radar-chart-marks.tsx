"use client";

/**
 * The radar's series marks. Area, Line and Dots each draw one series as a mark of its own on the
 * Root's loop, whose numbers are the series' radius on every spoke: the entrance grows them from
 * the centre over `--chart-intro`, series s starting at 600 + s·150 ms, and a data update moves
 * each spoke's radius over 480 ms (R11). A change of spoke count has no pairing, so the old drawing
 * fades out over the new one in `CHART_CROSSFADE_MS` (S5). An estimated spoke dashes the Line's
 * two edges beside it and hatches the Area's two quadrilaterals, and a missing one removes them and
 * its dot (R5). Each mark's layer carries its series' place, which the stylesheet dims by: hover
 * dims the series other than the nearest and strengthens the nearest's fill (D19), and selection
 * and highlight dim the rest. ActiveDot rides the polygon's edges to the active spoke, and Glow
 * haloes the marks it wraps.
 */
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { crossfade } from "./chart-crossfade";
import { writeAttribute } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { ActiveSlot, FollowerCause } from "./chart-followers";
import type { MarkValues } from "./chart-motion";
import { viewBoxOf } from "./chart-pie-frame";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { PolarContextValue, RadarDrawing, RadarSeries } from "./chart-polar-context";
import { PolarHatch } from "./chart-polar-hatch";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { useChartReadout } from "./chart-readout";
import { springTiming, stepSpring } from "./chart-spring";
import type { ChartLayerProps } from "./chart-types";
import { polarPoint } from "./layout/polar-angle";
import type { PolarPoint, SweepBox } from "./layout/polar-angle";
import { dotsPath, loneVertices, radarAreas, radarEdges, spokeAngle, zeroPolygon } from "./layout/radar";

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

/**
 * Props for `RadarChart.ActiveDot`, a closed part.
 *
 * @beta
 */
export type RadarChartActiveDotProps = ChartLayerProps & {
  /** The series the dot follows. */
  dataKey: string;
};

/**
 * Props for `RadarChart.Glow`, a closed part.
 *
 * @beta
 */
export type RadarChartGlowProps = ChartLayerProps & {
  /** The radar marks to glow. */
  children?: ReactNode;
};

/** What a series' spokes hold beside their radii: which are missing or estimated, and the radius of 0. */
type SpokeStates = {
  readonly count: number;
  /** The radius of 0, where the Area's fill starts and a missing spoke rests. */
  readonly zero: number;
  readonly missing: readonly boolean[];
  readonly marked: readonly boolean[];
};

/** A series' spoke states in a drawing. */
function spokeStatesOf(radar: RadarDrawing, series: RadarSeries | undefined): SpokeStates {
  const qualities = series?.qualities ?? [];
  return {
    count: radar.count,
    zero: radar.zero ?? 0,
    missing: Array.from({ length: radar.count }, (_, index) => (series?.values[index] ?? null) === null),
    marked: Array.from({ length: radar.count }, (_, index) => qualities[index] === "estimated"),
  };
}

/** Each spoke's radius at rest: its reading's, or the radius of 0 where it is missing. */
function radiiOf(radar: RadarDrawing, series: RadarSeries | undefined): MarkValues {
  const { domain } = radar;
  const span = domain[1] - domain[0];
  return Array.from({ length: radar.count }, (_, index) => {
    const value = series?.values[index] ?? null;
    if (value === null) return radar.zero ?? 0;
    return span === 0 ? 0 : (value - domain[0]) / span;
  });
}

/** Each spoke's vertex at the radii a frame draws, null where the reading is missing. */
function verticesAt(spokes: SpokeStates, radii: MarkValues): readonly (PolarPoint | null)[] {
  return Array.from({ length: spokes.count }, (_, index) =>
    spokes.missing[index] === true ? null : polarPoint(spokeAngle(index, spokes.count), radii[index] ?? 0)
  );
}

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
  const commit = usePolarCommit(polar, anchor);
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
    // A change of spoke count pairs no radius with another, so the old drawing fades out over the new.
    if (before !== null && before !== spokes.count) {
      if (node !== null && outgoing.current !== null && !motion.snaps()) {
        crossfade(node, outgoing.current, () => undefined);
      }
      place(radii, { kind: "snap" });
      return;
    }
    place(radii, placement);
  });
  const prefix = useId();
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

/** A role list's fill: a radial gradient centred on the series' box, its base at the centre (R9). */
function areaGradient(id: string, stops: readonly string[]): ReactNode {
  const ordered = stops.toReversed();
  return (
    <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
      {ordered.map((stop, index) => (
        <stop
          key={stop}
          offset={ordered.length < 2 ? 0 : index / (ordered.length - 1)}
          style={{ "--_stop": stop }}
        />
      ))}
    </radialGradient>
  );
}

/** A role list's stroke: a diagonal gradient across the series' box, top left to bottom right (R9). */
function lineGradient(id: string, stops: readonly string[]): ReactNode {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      {stops.map((stop, index) => (
        <stop
          key={stop}
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

/** CSS pixels per unit of the outer radius, as the layer shows now. */
function pixelsPerUnit(svg: SVGSVGElement, box: SweepBox): number {
  const width = box.right - box.left;
  return width > 0 ? svg.getBoundingClientRect().width / width : 0;
}

/** What an active dot's writer reads: its spokes, the spoke it shows and the radii it drew last. */
type ActiveDotLook = {
  readonly spokes: SpokeStates;
  readonly shown: { current: number | null };
  readonly drawn: { current: MarkValues | null };
};

/** Draw the active dot at its spoke's vertex in this frame's radii, so it follows its series' tween. */
function drawActiveDot(group: SVGGElement, look: ActiveDotLook, radii: MarkValues): void {
  look.drawn.current = radii;
  const spoke = look.shown.current;
  const vertex = spoke === null ? null : (verticesAt(look.spokes, radii)[spoke] ?? null);
  if (vertex === null) return;
  for (const path of group.children) writeAttribute(path, "d", dotsPath([vertex]));
}

/**
 * The dot on one series at the active spoke. It moves with its series as the series tweens, and a
 * step rides the polygon's edges to the new spoke the short way round, through each vertex between,
 * on the follow spring, which a fast pointer stiffens. A missing reading at the active spoke shows no
 * dot.
 *
 * @beta
 */
export function RadarChartActiveDot({ dataKey, className, style }: RadarChartActiveDotProps): ReactElement {
  const polar = usePolarContext("RadarChart.ActiveDot", ["radar"]);
  const { model, kernel, box } = polar;
  const readout = useChartReadout("RadarChart.ActiveDot");
  readout.assertKey("RadarChart.ActiveDot", dataKey);
  const radar = radarDrawingIn(model, "RadarChart.ActiveDot");
  const series = radar.series.find(({ key }) => key === dataKey);
  const spokes = useMemo(() => spokeStatesOf(radar, series), [radar, series]);
  const svg = useRef<SVGSVGElement>(null);
  const dot = useRef<SVGGElement | null>(null);
  const shown = useRef<number | null>(null);
  const drawn = useRef<MarkValues | null>(null);
  const look = useMemo((): ActiveDotLook => ({ spokes, shown, drawn }), [spokes, shown, drawn]);
  const { ref, place, node: anchor } = usePolarMark(polar.motion, drawActiveDot, look);
  const commit = usePolarCommit(polar, anchor);
  const radii = useMemo(() => radiiOf(radar, series), [radar, series]);
  const index = series?.index ?? 0;
  const count = radar.count;
  const placed = useRef<number | null>(null);
  useLayoutEffect(() => {
    const placement = commit(
      index,
      radii.map(() => 0)
    );
    // A change of spoke count pairs no radius with another, so the dot snaps with its series.
    const turned = placed.current !== null && placed.current !== count;
    placed.current = count;
    place(radii, turned ? { kind: "snap" } : placement);
  });
  const paint = (active: ActiveSlot, cause: FollowerCause): void => {
    const node = dot.current;
    const layer = svg.current;
    if (node === null || layer === null) return;
    const slot = active?.slot ?? null;
    const vertices = verticesAt(spokes, drawn.current ?? radii);
    const vertex = slot === null ? null : (vertices[slot] ?? null);
    const before = shown.current;
    shown.current = vertex === null ? null : slot;
    for (const animation of node.getAnimations()) animation.cancel();
    writeAttribute(node, "data-value", vertex === null ? null : "");
    if (vertex === null || slot === null) return;
    for (const path of node.children) writeAttribute(path, "d", dotsPath([vertex]));
    if (cause !== "step" || before === null || before === slot || polar.motion.reduced()) return;
    const route = rideRoute(vertices, before, slot);
    const scale = pixelsPerUnit(layer, box);
    if (route.length < 2 || scale === 0) return;
    const timing = springTiming(stepSpring(kernel.store));
    if (!timing.spring) return;
    const lengths = route.slice(1).map((point, step) => {
      const from = route[step] ?? point;
      return Math.hypot(point.x - from.x, point.y - from.y);
    });
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let reached = 0;
    const frames = route.map((point, step) => {
      if (step > 0) reached += lengths[step - 1] ?? 0;
      const x = ((point.x - vertex.x) * scale).toFixed(2);
      const y = ((point.y - vertex.y) * scale).toFixed(2);
      return {
        offset: total === 0 ? step / (route.length - 1) : reached / total,
        translate: `${x}px ${y}px`,
      };
    });
    node.animate(frames, { duration: timing.duration, easing: timing.easing });
  };
  useChartFollower("RadarChart.ActiveDot", paint);
  return (
    <svg
      ref={svg}
      data-slot="radar-chart-active-dot"
      data-radar-series=""
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{ "--chart-series": series?.index ?? 0, "--_base": series?.paint ?? "currentColor", ...style }}>
      <g
        ref={(element) => {
          dot.current = element;
          ref(element);
        }}
        data-follow="">
        <path data-slot="radar-chart-dot" data-part="halo" d="" />
        <path data-slot="radar-chart-dot" data-part="dots" d="" />
      </g>
    </svg>
  );
}

/**
 * The vertices a ride passes from one spoke to another the short way round, a tie going clockwise,
 * skipping a missing reading on the way.
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @param from - The spoke the dot showed on.
 * @param to - The active spoke.
 * @returns The route's points, from the old vertex to the new.
 */
function rideRoute(
  vertices: readonly (PolarPoint | null)[],
  from: number,
  to: number
): readonly PolarPoint[] {
  const count = vertices.length;
  const ahead = (((to - from) % count) + count) % count;
  const direction = ahead <= count - ahead ? 1 : -1;
  const steps = direction === 1 ? ahead : count - ahead;
  return Array.from(
    { length: steps + 1 },
    (_, step) => vertices[(from + direction * step + count) % count] ?? null
  ).filter((point): point is PolarPoint => point !== null);
}

/**
 * Wraps radar marks and glows their drawn layer: each wrapped series casts its own colour, blurred
 * as `Chart.Glow` blurs a line.
 *
 * @beta
 */
export function RadarChartGlow({ children, className, style }: RadarChartGlowProps): ReactElement {
  usePolarContext("RadarChart.Glow", ["radar"]);
  return (
    <div data-slot="radar-chart-glow" className={className} style={style}>
      {children}
    </div>
  );
}

Object.assign(RadarChartArea, { displayName: "RadarChart.Area" });
Object.assign(RadarChartLine, { displayName: "RadarChart.Line" });
Object.assign(RadarChartDots, { displayName: "RadarChart.Dots" });
Object.assign(RadarChartActiveDot, { displayName: "RadarChart.ActiveDot" });
Object.assign(RadarChartGlow, { displayName: "RadarChart.Glow" });
