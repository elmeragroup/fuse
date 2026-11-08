"use client";

/**
 * The clock's curves. Line and Area each draw one series as a mark of its own on the Root's loop,
 * whose numbers are a progress and each slot's start and end angle, base radius and tip. The
 * entrance runs the progress over 1.25 s: a clockwise wedge opens over 750 ms and each slot rises
 * from its base over 500 ms on an ease-out cubic as the wedge reaches it. An update moves every
 * number over 480 ms, and a switch between 24- and 25-hour days pairs the slots by their start
 * instants, so the slot angles tween and the dial turns rather than cut chords. A Line or an Area
 * painted by value paints through a radial gradient centred on the dial with a hard stop at each
 * threshold's radius (D23). Column, Dots, Marker, ValueLabel, ActiveDot and Glow live in their own
 * modules, so a route that names one part ships only its own.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { useSvgIdPrefix } from "./chart-dom";
import { PATH_GLOW, valueGlow } from "./chart-glow-filter";
import type { MarkValues } from "./chart-motion";
import { stackedScaleError } from "./chart-paint";
import { viewBoxOf } from "./chart-pie-frame";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ClockDrawing, ClockSeries } from "./chart-polar-context";
import { PolarHatch } from "./chart-polar-hatch";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import type { ChartCurve, ChartLayerProps } from "./chart-types";
import {
  NOMINAL_RADIUS,
  DIAL_REGION,
  useClockSeries,
  useClockPlacement,
  writeReveal,
  writeParts,
  paintOf,
  retuneGlow,
  useSeriesCurve,
  assertClockBaseline,
} from "./clock-chart-part";
import { clockArea, clockLine, entranceFrame } from "./layout/clock-path";

/**
 * Props for `ClockChart.Line`, a closed part.
 *
 * @beta
 */
export type ClockChartLineProps = ChartLayerProps & {
  /** The series the line draws. An unknown key throws `unknown-key`. */
  dataKey: string;
  /**
   * The line's look. "default" by default. "dashed" dashes the whole line, "flowing" runs its
   * dashes along it, which reduced motion stops, and "quiet" draws a thin, faint line for a
   * reference series such as last week.
   */
  variant?: "default" | "dashed" | "flowing" | "quiet";
  /** The curve through the readings round the dial. "monotone" by default. */
  curve?: ChartCurve;
};

/**
 * Props for `ClockChart.Area`, a closed part.
 *
 * @beta
 */
export type ClockChartAreaProps = ChartLayerProps & {
  /** The series the area draws. An unknown key throws `unknown-key`. */
  dataKey: string;
  /**
   * The fill's look. "gradient" by default, which fades from the value toward the zero ring, and
   * "gradient-reverse" fades the other way. "solid" fills at `--chart-area-opacity`, and "dotted",
   * "lines" and "hatched" fill with a texture of the series colour.
   */
  variant?: "gradient" | "gradient-reverse" | "solid" | "dotted" | "lines" | "hatched";
  /** The curve along the area's edge. "monotone" by default. */
  curve?: ChartCurve;
};

/** What a series mark's writer reads beside its numbers. */
type SeriesLook = {
  readonly series: ClockSeries;
  readonly clock: ClockDrawing;
  readonly curve: ChartCurve;
  /** The device pixels round the rim, measured once the dial draws, below which an Area hatches by pixel column. */
  readonly columns: { current: number | undefined };
  /** The numbers it drew last, which a new measure redraws. */
  readonly drawn: { current: MarkValues | null };
};

/** Draw a line's frame. */
function drawLine(group: SVGGElement, look: SeriesLook, values: MarkValues): void {
  const frame = entranceFrame(values);
  const { solid, marked, lone } = clockLine(frame.values, look.series.slots, look.curve);
  writeParts(
    group,
    new Map([
      ["solid", solid],
      ["marked", marked],
      ["lone", lone],
    ])
  );
  writeReveal(group, frame.reveal);
}

/** Draw an area's frame. */
function drawArea(group: SVGGElement, look: SeriesLook, values: MarkValues): void {
  look.drawn.current = values;
  const frame = entranceFrame(values);
  const { solid, marked } = clockArea(frame.values, look.series.slots, look.curve, look.columns.current);
  writeParts(
    group,
    new Map([
      ["solid", solid],
      ["marked", marked],
    ])
  );
  writeReveal(group, frame.reveal);
}

/** A line's paths at rest. */
function lineAtRest(series: ClockSeries, curve: ChartCurve): ReadonlyMap<string, string> {
  const { solid, marked, lone } = clockLine(series.rest, series.slots, curve);
  return new Map([
    ["solid", solid],
    ["marked", marked],
    ["lone", lone],
  ]);
}

/** An area's paths at rest. */
function areaAtRest(series: ClockSeries, curve: ChartCurve): ReadonlyMap<string, string> {
  const { solid, marked } = clockArea(series.rest, series.slots, curve);
  return new Map([
    ["solid", solid],
    ["marked", marked],
  ]);
}

/** The radial gradient a series painted by value strokes or fills with, hard at each step's radius. */
function StepGradient({
  id,
  series,
}: {
  readonly id: string;
  readonly series: ClockSeries;
}): ReactElement | null {
  const steps = series.steps;
  if (steps === null) return null;
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" data-steps="">
      {steps.flatMap(({ paint, from }, index) => {
        const to = steps[index + 1]?.from ?? 1;
        return [
          <stop key={`${String(index)}-from`} offset={Math.min(1, from)} style={{ "--_stop": paint }} />,
          <stop key={`${String(index)}-to`} offset={Math.min(1, to)} style={{ "--_stop": paint }} />,
        ];
      })}
    </radialGradient>
  );
}

/** The paint a role list's line strokes: a diagonal gradient across its box (R9). */
function RoleGradient({
  id,
  stops,
}: {
  readonly id: string;
  readonly stops: readonly string[];
}): ReactElement {
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

/** One series layer bound to the loop: its svg, its paint servers, its clip and its drawing group. */
function SeriesLayer({
  dataSlot,
  part,
  dataKey,
  variant,
  curve,
  draw,
  rest,
  halo,
  className,
  style,
  children,
  areaVariant,
}: {
  readonly dataSlot: string;
  readonly part: string;
  readonly dataKey: string;
  readonly variant: string | undefined;
  readonly curve: ChartCurve;
  readonly draw: (group: SVGGElement, look: SeriesLook, values: MarkValues) => void;
  /** The paths at rest, which React writes once. */
  readonly rest: (series: ClockSeries, curve: ChartCurve) => ReadonlyMap<string, string>;
  readonly halo: typeof PATH_GLOW;
  readonly className: string | undefined;
  readonly style: CSSProperties | undefined;
  readonly children: (first: ReadonlyMap<string, string>) => ReactNode;
  /** An Area's look, whose mask the layer's defs hold. */
  readonly areaVariant?: NonNullable<ClockChartAreaProps["variant"]> | undefined;
}): ReactElement {
  const { polar, clock, series } = useClockSeries(part, dataKey);
  // A path painted by value draws at stacked values its gradient does not follow.
  const color = clock.text.config[dataKey]?.color;
  if (series !== undefined && color !== undefined) {
    const error = stackedScaleError(part, color, series.stack !== undefined, clock.stackOffset);
    if (error !== null) throw error;
  }
  const columns = useRef<number | undefined>(undefined);
  const drawn = useRef<MarkValues | null>(null);
  const look = useMemo(
    (): SeriesLook | null => (series === undefined ? null : { series, clock, curve, columns, drawn }),
    [series, clock, curve]
  );
  const { ref, place, node: anchor, drawn: drawnFrame } = usePolarMark(polar.motion, writeLook(draw), look);
  const commit = usePolarCommit(polar, anchor);
  useClockPlacement(clock, series, look, { commit, place, drawn: drawnFrame });
  const prefix = useSvgIdPrefix("clock-chart-series");
  const glow = series === undefined ? null : valueGlow(paintOf(clock, series), prefix, halo);
  // React writes the paths once at rest, and the loop writes them from then on.
  const [first] = useState(() => (series === undefined ? new Map<string, string>() : rest(series, curve)));
  const svg = useRef<SVGSVGElement>(null);
  const glowing = glow !== null;
  // A value glow blurs in the dial's units, so its blur follows the dial's drawn size.
  useLayoutEffect(() => {
    const node = svg.current;
    if (node === null || !glowing) return undefined;
    const read = (): void => {
      const width = polar.box.right - polar.box.left;
      retuneGlow(node, width > 0 ? node.getBoundingClientRect().width / width : 0, halo);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [polar.box, glowing, halo]);
  // The device pixels round the rim, which an Area's hatch decimates to on a dial of slots
  // narrower than a pixel; a new count redraws the last numbers.
  useLayoutEffect(() => {
    const node = svg.current;
    if (node === null || look === null) return undefined;
    const read = (): void => {
      const width = polar.box.right - polar.box.left;
      const radius = width > 0 ? node.getBoundingClientRect().width / width : 0;
      const count =
        radius > 0 ? Math.round(2 * Math.PI * radius * (window.devicePixelRatio || 1)) : undefined;
      if (count === columns.current) return;
      columns.current = count;
      const group = anchor();
      if (group !== null && drawn.current !== null) draw(group, look, drawn.current);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [polar.box, look, draw, anchor]);
  const paint =
    series === undefined
      ? "currentColor"
      : series.steps !== null
        ? `url(#${prefix}-steps)`
        : series.stops !== undefined
          ? `url(#${prefix}-role)`
          : series.paint;
  return (
    <svg
      ref={svg}
      data-slot={dataSlot}
      data-variant={variant}
      data-clock-series=""
      data-paint={glow === null ? undefined : "value"}
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(polar.box)}
      className={className}
      style={{
        "--chart-series": series?.index ?? 0,
        "--_paint": paint,
        "--_base": series?.paint ?? "currentColor",
        "--_quality": `url(#${prefix}-quality)`,
        "--_look": `url(#${prefix}-look)`,
        "--_glow": glow?.url,
        ...style,
      }}>
      <defs>
        {series === undefined ? null : <StepGradient id={`${prefix}-steps`} series={series} />}
        {series?.stops === undefined ? null : <RoleGradient id={`${prefix}-role`} stops={series.stops} />}
        {/* The quality texture is a mask over the mark's own value paint, so a threshold or a scale
            keeps its colours where readings are estimated or projected. Its stripes take the
            stylesheet's mask ink. */}
        <PolarHatch id={`${prefix}-quality-stripes`} paint="var(--_quality-ink)" />
        <mask id={`${prefix}-quality`} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
          <rect x="-1.5" y="-1.5" width="3" height="3" fill={`url(#${prefix}-quality-stripes)`} />
        </mask>
        {glow?.filter(DIAL_REGION)}
        <clipPath id={`${prefix}-reveal`}>
          <path data-part="reveal" d="" />
        </clipPath>
        {areaVariant === undefined ? null : (
          <AreaMask id={`${prefix}-look`} variant={areaVariant} clock={clock} />
        )}
      </defs>
      <g ref={ref} data-clip={`url(#${prefix}-reveal)`}>
        {children(first)}
      </g>
    </svg>
  );
}

/** A loop writer over a look that may be null before the series exists. */
function writeLook(
  draw: (group: SVGGElement, look: SeriesLook, values: MarkValues) => void
): (group: SVGGElement, look: SeriesLook | null, values: MarkValues) => void {
  const known = writers.get(draw);
  if (known !== undefined) return known;
  const made = (group: SVGGElement, look: SeriesLook | null, values: MarkValues): void => {
    if (look !== null) draw(group, look, values);
  };
  writers.set(draw, made);
  return made;
}

const writers = new Map<
  (group: SVGGElement, look: SeriesLook, values: MarkValues) => void,
  (group: SVGGElement, look: SeriesLook | null, values: MarkValues) => void
>();

/**
 * One series as a curve round the dial, through d3's curve in unrolled angle and radius, so a run of
 * equal values draws an arc. The loop closes across 12 o'clock when both end slots hold readings
 * (D16). A missing reading leaves a gap unless the series' config sets `missing: "connect"`, which
 * bridges it dashed, and the segments that touch an estimated or projected reading dash too. A
 * series painted by a threshold or a scale strokes through a radial gradient that turns hard at each
 * threshold's radius (D23).
 *
 * @beta
 */
export function ClockChartLine({
  dataKey,
  variant = "default",
  curve = "monotone",
  className,
  style,
}: ClockChartLineProps): ReactElement {
  const polar = usePolarContext("ClockChart.Line", ["clock"]);
  useSeriesCurve(polar.motion, dataKey, curve, "line");
  return (
    <SeriesLayer
      dataSlot="clock-chart-line"
      part="ClockChart.Line"
      dataKey={dataKey}
      variant={variant}
      curve={curve}
      draw={drawLine}
      rest={lineAtRest}
      halo={PATH_GLOW}
      className={className}
      style={style}>
      {(first) => (
        <>
          <path data-slot="clock-chart-line-path" data-part="solid" d={first.get("solid")} />
          <path data-slot="clock-chart-line-path" data-part="marked" d={first.get("marked")} />
          <path data-slot="clock-chart-line-path" data-part="lone" d={first.get("lone")} />
        </>
      )}
    </SeriesLayer>
  );
}

/** An area's look as a mask over its fill: a ramp along the radius or a texture. */
function AreaMask({
  id,
  variant,
  clock,
}: {
  readonly id: string;
  readonly variant: NonNullable<ClockChartAreaProps["variant"]>;
  readonly clock: ClockDrawing;
}): ReactElement | null {
  if (variant === "solid") return null;
  if (variant === "gradient" || variant === "gradient-reverse") {
    // Zero sits at its own radius on the scale, clamped to the dial: the hole's edge when every
    // reading is positive, the rim when every reading is negative, and between them otherwise,
    // whether or not the Grid draws a zero ring.
    const zero = Math.min(1, Math.max(clock.inner, clock.radius(0)));
    // "near" is clear and "far" solid. "gradient" fades from the value toward zero: solid at the
    // rim and at the hole's edge, where the largest and the most negative values reach, clear at
    // the zero ring. "gradient-reverse" fades the other way, so both signs stay visible either way.
    const [ends, middle] = variant === "gradient" ? ["far", "near"] : ["near", "far"];
    return (
      <mask id={id} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
        <radialGradient id={`${id}-ramp`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1">
          <stop offset={clock.inner} data-part={ends} />
          <stop offset={zero} data-part={middle} />
          <stop offset="1" data-part={ends} />
        </radialGradient>
        <rect x="-1.5" y="-1.5" width="3" height="3" fill={`url(#${id}-ramp)`} />
      </mask>
    );
  }
  // Textures in the dial's units: 5 px on a dial of the nominal radius.
  const stride = 5 / NOMINAL_RADIUS;
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
      <pattern
        id={`${id}-texture`}
        patternUnits="userSpaceOnUse"
        width={stride}
        height={stride}
        patternTransform={variant === "hatched" ? "rotate(45)" : undefined}>
        {variant === "dotted" ? (
          <circle cx={stride / 2} cy={stride / 2} r={stride / 5} />
        ) : (
          <rect width={stride / 3} height={stride} />
        )}
      </pattern>
      <rect x="-1.5" y="-1.5" width="3" height="3" fill={`url(#${id}-texture)`} />
    </mask>
  );
}

/**
 * One series as an area between its curve and its base: the zero ring, or the stack under it.
 * Filled even-odd, the area changes side where its curve crosses the zero ring, and a closed loop
 * fills the band between two rings. The spans beside an estimated or projected reading hatch over
 * the fill.
 *
 * @beta
 */
export function ClockChartArea({
  dataKey,
  variant = "gradient",
  curve = "monotone",
  className,
  style,
}: ClockChartAreaProps): ReactElement {
  const { model, motion } = usePolarContext("ClockChart.Area", ["clock"]);
  assertClockBaseline(clockDrawingIn(model, "ClockChart.Area"), "ClockChart.Area", "a band");
  useSeriesCurve(motion, dataKey, curve, "area");
  return (
    <SeriesLayer
      dataSlot="clock-chart-area"
      part="ClockChart.Area"
      dataKey={dataKey}
      variant={variant}
      curve={curve}
      draw={drawArea}
      rest={areaAtRest}
      halo={PATH_GLOW}
      className={className}
      style={style}
      areaVariant={variant}>
      {(first) => (
        <>
          <path data-slot="clock-chart-area-path" data-part="solid" d={first.get("solid")} />
          <path data-slot="clock-chart-area-path" data-part="marked" d={first.get("marked")} />
        </>
      )}
    </SeriesLayer>
  );
}

Object.assign(ClockChartLine, { displayName: "ClockChart.Line" });
Object.assign(ClockChartArea, { displayName: "ClockChart.Area" });
