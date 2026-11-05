"use client";

/**
 * The clock's series marks. Line, Area, Column, Dots and Marker each draw one series as a mark of its
 * own on the Root's loop, whose numbers are a progress and each slot's start and end angle, base
 * radius and tip. The entrance runs the progress over 1.25 s: a clockwise wedge opens over 750 ms and
 * each slot rises from its base over 500 ms on an ease-out cubic as the wedge reaches it. An update
 * moves every number over 480 ms, and a switch between 24- and 25-hour days pairs the slots by their
 * start instants, so the slot angles tween and the dial turns rather than cut chords. A Line or an
 * Area painted by value paints through a radial gradient centred on the dial with a hard stop at each
 * threshold's radius (D23), and a Column paints each wedge in its own value's step. A Column keeps one
 * device pixel along its radius (D24), and a stack settles its floors through the stack floors. The
 * ActiveDot rides the drawn curve to the active slot, the short way round.
 */
import { createContext, use, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";

import { useLocale } from "../../intl/locale-context";
import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { ActiveSlot, FollowerCause } from "./chart-followers";
import { PATH_GLOW, BAR_GLOW, valueGlow } from "./chart-glow-filter";
import type { ChartMotion, MarkValues, Placement } from "./chart-motion";
import { seriesPaintOf, stackedScaleError } from "./chart-paint";
import { viewBoxOf } from "./chart-pie-frame";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ClockDrawing, ClockSeries, PolarContextValue } from "./chart-polar-context";
import { PolarHatch } from "./chart-polar-hatch";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { useChartReadout } from "./chart-readout";
import { springTiming, stepSpring } from "./chart-spring";
import { useStackSeat } from "./chart-stack-floors";
import type { StackSeat } from "./chart-stack-floors";
import type { ChartCurve, ChartDatum, ChartLayerProps, ChartX, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { columnAxis, columnFloorSpan, columnSpan, wedgePad } from "./layout/clock";
import {
  clockArea,
  clockDots,
  clockLine,
  clockWedges,
  clockXY,
  curveRoute,
  entranceFrame,
  revealPath,
  slotVertex,
} from "./layout/clock-path";
import { keywordSlots, listedSlots } from "./layout/datum";
import { DECIMATE_ABOVE, m4Indexes } from "./layout/decimate";
import { ChartCompositionError } from "./layout/errors";
import { angleLabel } from "./layout/polar-labels";
import { pathNumber } from "./layout/rounding";

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

/**
 * Props for `ClockChart.Column`, a closed part.
 *
 * @beta
 */
export type ClockChartColumnProps = ChartLayerProps & {
  /** The series the wedges draw, in the look its config's `barVariant` names. */
  dataKey: string;
  /**
   * The slots to emphasise. `"now"` selects the slot that holds Root's `now`, and `"max"` and
   * `"min"` select every tied slot. An x string throws `x-type-mismatch`.
   */
  emphasis?: ChartDatum;
  /** The word the option appends to an emphasised slot. The dictionary's "uthevet" is the default. */
  emphasisLabel?: string;
};

/**
 * Props for `ClockChart.Dots`, a closed part.
 *
 * @beta
 */
export type ClockChartDotsProps = ChartLayerProps & {
  /** The series whose readings get a dot. */
  dataKey: string;
  /** The dot's look. "default" by default. "ring" is hollow and "halo" sits in a faint halo. */
  variant?: "default" | "ring" | "halo";
};

/**
 * Props for `ClockChart.ActiveDot`, a closed part.
 *
 * @beta
 */
export type ClockChartActiveDotProps = ChartLayerProps & {
  /** The series the dot follows. */
  dataKey: string;
  /** The dot's look. "default" by default. "ping" sends a ring out from the dot once a second. */
  variant?: "default" | "ring" | "halo" | "ping";
};

/**
 * Props for `ClockChart.Marker`, a closed part.
 *
 * @beta
 */
export type ClockChartMarkerProps = ChartLayerProps & {
  /** The series the marker sits on. */
  dataKey: string;
  /** The slots to mark. An x string throws `x-type-mismatch`. */
  at: ChartDatum;
  /** The dot's look. "default" by default. */
  variant?: "default" | "ring" | "halo" | "ping";
  /** A `ValueLabel` adds the value as a pill beside the dot. */
  children?: ReactNode;
};

/**
 * Props for `ClockChart.ValueLabel`, a closed part.
 *
 * @beta
 */
export type ClockChartValueLabelProps = ChartLayerProps & {
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `ClockChart.Glow`, a closed part.
 *
 * @beta
 */
export type ClockChartGlowProps = ChartLayerProps & {
  /** The clock marks to glow. */
  children?: ReactNode;
};

/** The dial's nominal radius in CSS pixels, half of the 12.5rem cell, which a value glow's blur reads. */
const NOMINAL_RADIUS = 100;

/** The constant gap between two wedges, in CSS pixels (D14). */
const WEDGE_GAP = 2;

/** The glow region of a dial: its whole box past the rim, in the dial's units. */
const DIAL_REGION = { x: -1.5, y: -1.5, width: 3, height: 3, unit: NOMINAL_RADIUS } as const;

/**
 * The slots a datum selects on a clock: a keyword over a series' drawn values, or the slots holding
 * explicit instants.
 *
 * @param clock - The clock's drawing.
 * @param part - The selecting part's display name, which an x of the wrong type names.
 * @param series - The series.
 * @param datum - A keyword or explicit x values.
 * @returns The selected slots, ascending.
 * @throws {ChartCompositionError} `x-type-mismatch` for an x string, since a dial reads instants.
 */
function clockDatumSlots(
  clock: ClockDrawing,
  part: string,
  series: ClockSeries,
  datum: ChartDatum
): number[] {
  const window = clock.text.model.window;
  if (window === null) return [];
  if (datum === "first" || datum === "last" || datum === "min" || datum === "max" || datum === "now") {
    return keywordSlots(datum, { values: series.values, window, nowSlot: clock.now?.slot ?? -1 });
  }
  const xs: readonly ChartX[] = Array.isArray(datum.x) ? datum.x : [datum.x];
  return listedSlots(
    xs.map((x) => {
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: an x is a string, a number or a Date
      if (typeof x === "string") {
        throw new ChartCompositionError(
          part,
          "x-type-mismatch",
          "received a string x on a clock dial. Pass a Date or epoch milliseconds, because a date-only string parses as UTC midnight and lands on the wrong day."
        );
      }
      return clock.slotOf(x);
    }),
    window
  );
}

/** The series a part names, after the readout asserts its key. */
/** What a clock part reads of its Root: the polar context, the drawing and its series, if it exists. */
type ClockPart = {
  readonly polar: PolarContextValue;
  readonly clock: ClockDrawing;
  readonly series: ClockSeries | undefined;
};

function useClockSeries(part: string, dataKey: string): ClockPart {
  const polar = usePolarContext(part, ["clock"]);
  const readout = useChartReadout(part);
  readout.assertKey(part, dataKey);
  const clock = clockDrawingIn(polar.model, part);
  return { polar, clock, series: clock.series.find(({ key }) => key === dataKey) };
}

/**
 * The numbers a series' old slots draw in, paired with the new slots by their wall clock offsets
 * from the cycle's start, so a change of slot count tweens each slot from where it stood and the
 * dial turns. A slot with no old twin, as the repeated hour of a 25-hour day, opens from zero width
 * at the end of the slot before it, at that slot's base and tip.
 */
function pairedFrom(
  previous: { readonly pairs: readonly string[]; readonly values: MarkValues },
  pairs: readonly string[]
): number[] {
  const at = new Map(previous.pairs.map((pair, slot) => [pair, slot]));
  const from: number[] = [previous.values[0] ?? 1];
  // The slot before, whose end angle, base and tip an unpaired slot opens from.
  let before: readonly [number, number, number] = [0, previous.values[3] ?? 0, previous.values[4] ?? 0];
  pairs.forEach((pair) => {
    const old = at.get(pair);
    if (old !== undefined) {
      const base = 1 + old * 4;
      const numbers = [
        previous.values[base] ?? 0,
        previous.values[base + 1] ?? 0,
        previous.values[base + 2] ?? 0,
        previous.values[base + 3] ?? 0,
      ];
      from.push(...numbers);
      before = [numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 0];
      return;
    }
    const [end, base, tip] = before;
    from.push(end, end, base, tip);
  });
  return from;
}

/**
 * Place a series mark for a commit through the classifier: the entrance, an update, or a turn of
 * the dial when the slot count changes, along the route that pairs the old slots with the new.
 */
function useClockPlacement(
  clock: ClockDrawing,
  series: ClockSeries | undefined,
  commit: ReturnType<typeof usePolarCommit>,
  place: (target: MarkValues, placement: Placement) => void
): void {
  const last = useRef<{ readonly pairs: readonly string[]; readonly values: MarkValues } | null>(null);
  useLayoutEffect(() => {
    if (series === undefined) return;
    const previous = last.current;
    last.current = { pairs: clock.pairs, values: series.rest };
    const turns = previous !== null && previous.pairs.length !== clock.pairs.length;
    const via = turns ? { from: pairedFrom(previous, clock.pairs), to: series.rest } : undefined;
    place(series.rest, commit(series.index, [0, ...series.rest.slice(1)], via));
  });
}

/** What a series mark's writer reads beside its numbers. */
type SeriesLook = {
  readonly series: ClockSeries;
  readonly clock: ClockDrawing;
  readonly curve: ChartCurve;
};

/** Write the entrance's open wedge onto a mark's clip path, or none once the dial is whole. */
function writeReveal(group: SVGGElement, reveal: number): void {
  const clip = group.ownerSVGElement?.querySelector('[data-part="reveal"]');
  if (clip !== null && clip !== undefined) writeAttribute(clip, "d", revealPath(reveal));
  writeAttribute(group, "clip-path", reveal >= 360 ? null : (group.getAttribute("data-clip") ?? null));
}

/** Write each named path of a group from a map of paths by part. */
function writeParts(group: SVGGElement, paths: ReadonlyMap<string, string>): void {
  for (const path of group.querySelectorAll("path[data-part]")) {
    const part = path.getAttribute("data-part");
    if (part === null || part === "reveal") continue;
    writeAttribute(path, "d", paths.get(part) ?? "");
  }
}

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
  const frame = entranceFrame(values);
  const { solid, marked } = clockArea(frame.values, look.series.slots, look.curve);
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
  const look = useMemo(
    (): SeriesLook | null => (series === undefined ? null : { series, clock, curve }),
    [series, clock, curve]
  );
  const { ref, place, node: anchor } = usePolarMark(polar.motion, writeLook(draw), look);
  const commit = usePolarCommit(polar, anchor);
  useClockPlacement(clock, series, commit, place);
  const prefix = useId();
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
        "--_hatch-paint": `url(#${prefix}-hatch)`,
        "--_look": `url(#${prefix}-look)`,
        "--_glow": glow?.url,
        ...style,
      }}>
      <defs>
        {series === undefined ? null : <StepGradient id={`${prefix}-steps`} series={series} />}
        {series?.stops === undefined ? null : <RoleGradient id={`${prefix}-role`} stops={series.stops} />}
        {series === undefined ? null : <PolarHatch id={`${prefix}-hatch`} paint={series.paint} />}
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

/** The series paint of a drawing's series, its config colour over its model. */
function paintOf(clock: ClockDrawing, series: ClockSeries) {
  const model = clock.text.model.series.find(({ key }) => key === series.key);
  return seriesPaintOf(series.key, clock.text.config[series.key]?.color ?? "chart-1", model);
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
  useLineCurve(polar.motion, dataKey, curve);
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
  const zero = clock.zero ?? clock.inner;
  if (variant === "gradient" || variant === "gradient-reverse") {
    const [near, far] = variant === "gradient" ? ["far", "near"] : ["near", "far"];
    return (
      <mask id={id} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
        <radialGradient id={`${id}-ramp`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1">
          <stop offset={zero} data-part={near} />
          <stop offset="1" data-part={far} />
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

/** The measured dial: CSS pixels per unit of the outer radius and the device pixel ratio. */
type DialMeasure = { readonly scale: number; readonly dpr: number };

/** What a column writer reads beside its numbers. */
type ColumnLook = {
  readonly series: ClockSeries;
  readonly clock: ClockDrawing;
  readonly measure: RefObject<DialMeasure>;
  readonly seat: StackSeat | null;
  readonly emphasised: ReadonlySet<number>;
  /** The numbers it drew last, which a resize redraws. */
  readonly drawn: { current: MarkValues | null };
};

/** The group a wedge or a dot paints in: its step, and past or now under `data-fade="past"`. */
function groupOf(series: ClockSeries, clock: ClockDrawing, slot: number): string {
  const past = clock.now !== null && slot < clock.now.slot ? "-past" : "";
  return `step-${String(series.stepAt[slot] ?? 0)}${past}`;
}

/** Draw a column's frame: every wedge with its pad and its floor, and its stack's floors settled. */
/** The slots a series' columns draw at a radius: every slot, or past 2,000 M4's set at the dial's circumference. */
function shownAt(series: ClockSeries, radius: number): readonly number[] {
  if (series.values.length <= DECIMATE_ABOVE) return series.shown;
  const known = decimations.get(series);
  const columns = Math.round(2 * Math.PI * radius);
  if (known?.columns === columns) return known.shown;
  const shown = m4Indexes(series.values, columns);
  decimations.set(series, { columns, shown });
  return shown;
}

/** Each series' decimated slots for the last dial width it drew at. */
const decimations = new WeakMap<
  ClockSeries,
  { readonly columns: number; readonly shown: readonly number[] }
>();

/**
 * A series' wedges in a frame, by group, at a measured dial: each wedge's pad and its floor along its
 * radius, unless `keeps` says its stack's floor lies on another segment.
 */
function wedgeGroups(
  series: ClockSeries,
  clock: ClockDrawing,
  values: MarkValues,
  measure: DialMeasure,
  emphasised: ReadonlySet<number>,
  keeps: ReadonlyMap<number, boolean> | null
): Map<string, string> {
  const radius = measure.scale > 0 ? measure.scale : NOMINAL_RADIUS;
  const { dpr } = measure;
  const axis = columnAxis(radius, dpr);
  const pad = wedgePad(clock.count, clock.inner * radius, radius, WEDGE_GAP, dpr);
  const padded = { padAngle: pad.padAngle, padRadius: pad.padRadius / radius };
  const span = (slot: number, base: number, tip: number): readonly [number, number] => {
    if (keeps === null || keeps.get(slot) === true) {
      const [from, to] = columnSpan(axis, base * radius, tip * radius);
      return [from / radius, to / radius];
    }
    const snap = (edge: number): number => Math.round(edge * radius * dpr) / dpr / radius;
    return [snap(Math.min(base, tip)), snap(Math.max(base, tip))];
  };
  const shown = shownAt(series, radius);
  const groups = clockWedges(values, series.slots, shown, padded, span, (slot) =>
    series.slots.marked[slot] === true ? "marked" : groupOf(series, clock, slot)
  );
  const emphasis = clockWedges(
    values,
    series.slots,
    shown.filter((slot) => emphasised.has(slot)),
    padded,
    span,
    () => "emphasis"
  );
  const all = new Map(groups);
  all.set("emphasis", emphasis.get("emphasis") ?? "");
  return all;
}

/** Draw a column's frame: every wedge with its pad and its floor, and its stack's floors settled. */
function drawColumns(group: SVGGElement, look: ColumnLook | null, values: MarkValues): void {
  if (look === null) return;
  look.drawn.current = values;
  const frame = entranceFrame(values);
  const { series, clock, seat, emphasised } = look;
  const measure = look.measure.current;
  const write = (keeps: ReadonlyMap<number, boolean> | null): void => {
    const groups = wedgeGroups(series, clock, frame.values, measure, emphasised, keeps);
    for (const path of group.querySelectorAll("path[data-group]")) {
      writeAttribute(path, "d", groups.get(path.getAttribute("data-group") ?? "") ?? "");
    }
    writeReveal(group, frame.reveal);
  };
  if (seat === null) {
    write(null);
    return;
  }
  const radius = measure.scale > 0 ? measure.scale : NOMINAL_RADIUS;
  const axis = columnAxis(radius, measure.dpr);
  const spans = shownAt(series, radius).flatMap((slot) => {
    if (series.slots.states[slot] !== "reading") return [];
    const at = 1 + slot * 4;
    return [
      columnFloorSpan(
        axis,
        slot,
        series.key,
        (frame.values[at + 2] ?? 0) * radius,
        (frame.values[at + 3] ?? 0) * radius
      ),
    ];
  });
  seat.floors.draw(seat.mark, seat.stack, spans, axis, (kept) => {
    write(new Map(spans.map((span, index) => [span.from, kept[index] === 1])));
  });
}

/**
 * Tune a value glow's blur to the dial as it draws: the halo's CSS pixels over the dial's pixels per
 * unit, and the filter's region past the dial by three of them.
 */
function retuneGlow(svg: SVGSVGElement, unit: number, halo: typeof PATH_GLOW): void {
  if (!(unit > 0)) return;
  const deviation = halo.deviation / unit;
  const margin = 3 * deviation;
  for (const filter of svg.querySelectorAll("filter")) {
    writeAttribute(filter, "x", -1.5 - margin);
    writeAttribute(filter, "y", -1.5 - margin);
    writeAttribute(filter, "width", 3 + 2 * margin);
    writeAttribute(filter, "height", 3 + 2 * margin);
    const blur = filter.querySelector("feGaussianBlur");
    if (blur !== null) writeAttribute(blur, "stdDeviation", deviation);
  }
}

/**
 * One series as a column of wedges, one per slot, each with the slot's whole angle less a pad that
 * keeps every gap one width from hole to rim (D14). A negative wedge hangs inward from the zero ring.
 * Each wedge paints its own value's step of a threshold or a scale, keeps one device pixel along its
 * radius away from zero (D24), and stacks through config `stack`. Past 100 slots the wedges draw as
 * one path, and past 2,000 they decimate by M4 to the dial's circumference.
 *
 * @beta
 */
export function ClockChartColumn({
  dataKey,
  emphasis,
  emphasisLabel,
  className,
  style,
}: ClockChartColumnProps): ReactElement {
  const { polar, clock, series } = useClockSeries("ClockChart.Column", dataKey);
  const { kernel } = polar;
  const seat = useStackSeat(polar.motion, series?.stack, dataKey);
  const picked = useMemo(
    () =>
      series === undefined || emphasis === undefined
        ? []
        : clockDatumSlots(clock, "ClockChart.Column", series, emphasis),
    [clock, series, emphasis]
  );
  const emphasised = useMemo(() => new Set(picked), [picked]);
  // The emphasised slots join the store, so their options append the emphasis word.
  useLayoutEffect(() => {
    if (picked.length === 0) return undefined;
    const { store } = kernel;
    store.set({ emphasis: { ...store.get().emphasis, [dataKey]: { slots: picked, label: emphasisLabel } } });
    return () => {
      store.set({
        emphasis: Object.fromEntries(
          Object.entries(store.get().emphasis).filter(([name]) => name !== dataKey)
        ),
      });
    };
  }, [kernel, dataKey, picked, emphasisLabel]);
  const measure = useRef<DialMeasure>({ scale: 0, dpr: 1 });
  const drawn = useRef<MarkValues | null>(null);
  const look = useMemo(
    (): ColumnLook | null =>
      series === undefined ? null : { series, clock, measure, seat, emphasised, drawn },
    [series, clock, seat, emphasised, drawn]
  );
  const { ref, place, node: anchor } = usePolarMark(polar.motion, drawColumns, look);
  const commit = usePolarCommit(polar, anchor);
  useClockPlacement(clock, series, commit, place);
  const svg = useRef<SVGSVGElement>(null);
  const group = useRef<SVGGElement | null>(null);
  // The writer measures the dial's pixels for the floor and the pad, and redraws as the cell resizes.
  useLayoutEffect(() => {
    const node = svg.current;
    if (node === null) return undefined;
    const read = (): void => {
      const width = polar.box.right - polar.box.left;
      measure.current = {
        scale: width > 0 ? node.getBoundingClientRect().width / width : 0,
        dpr: window.devicePixelRatio || 1,
      };
      retuneGlow(node, measure.current.scale, BAR_GLOW);
      const values = drawn.current;
      if (group.current !== null && values !== null) drawColumns(group.current, look, values);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [polar.box, look, drawn]);
  const prefix = useId();
  const paint = series === undefined ? null : paintOf(clock, series);
  const glow = paint === null ? null : valueGlow(paint, prefix, BAR_GLOW);
  const steps = series?.steps ?? [{ paint: series?.paint ?? "currentColor", from: 0 }];
  const variant = clock.text.config[dataKey]?.barVariant === "gradient" ? "gradient" : "default";
  // React writes the wedges once at rest on the nominal dial, so the server's chart shows them with
  // JavaScript off, and the loop writes them from then on.
  const [first] = useState(() =>
    series === undefined
      ? new Map<string, string>()
      : wedgeGroups(series, clock, series.rest, { scale: NOMINAL_RADIUS, dpr: 1 }, emphasised, null)
  );
  return (
    <svg
      ref={svg}
      data-slot="clock-chart-column"
      data-variant={variant}
      data-clock-series=""
      data-emphasis={picked.length > 0 ? "" : undefined}
      data-paint={glow === null ? undefined : "value"}
      data-polar-layer=""
      data-polar-mark=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(polar.box)}
      className={className}
      style={{
        "--chart-series": series?.index ?? 0,
        "--_base": series?.paint ?? "currentColor",
        "--_hatch-paint": `url(#${prefix}-hatch)`,
        "--_glow": glow?.url,
        ...style,
      }}>
      <defs>
        {series === undefined ? null : <PolarHatch id={`${prefix}-hatch`} paint={series.paint} />}
        {glow?.filter(DIAL_REGION)}
        <clipPath id={`${prefix}-reveal`}>
          <path data-part="reveal" d="" />
        </clipPath>
        <mask id={`${prefix}-fade`} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
          <radialGradient id={`${prefix}-ramp`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1">
            <stop offset={clock.zero ?? clock.inner} data-part="near" />
            <stop offset="1" data-part="far" />
          </radialGradient>
          <rect x="-1.5" y="-1.5" width="3" height="3" fill={`url(#${prefix}-ramp)`} />
        </mask>
      </defs>
      <g
        ref={(element) => {
          group.current = element;
          ref(element);
        }}
        data-clip={`url(#${prefix}-reveal)`}>
        {steps.flatMap(({ paint: step }, index) =>
          ["", "-past"].map((time) => (
            <path
              key={`${String(index)}${time}`}
              data-slot="clock-chart-wedge"
              data-group={`step-${String(index)}${time}`}
              data-time={time === "" ? undefined : "past"}
              d={first.get(`step-${String(index)}${time}`)}
              style={{ "--_wedge": step, "--_fade": `url(#${prefix}-fade)` }}
            />
          ))
        )}
        <path data-slot="clock-chart-wedge" data-group="marked" data-part="marked" d={first.get("marked")} />
        <path
          data-slot="clock-chart-wedge"
          data-group="emphasis"
          data-part="emphasis"
          d={first.get("emphasis")}
        />
      </g>
    </svg>
  );
}

/** What a dots writer reads beside its numbers. */
type DotsLook = {
  readonly series: ClockSeries;
  readonly clock: ClockDrawing;
  readonly only: ReadonlySet<number> | null;
};

/** A series' dots in a frame, in their step groups: every reading, or the slots a Marker names. */
function dotGroups(look: DotsLook, values: MarkValues): Map<string, string> {
  const { series, clock, only } = look;
  const slots =
    only === null
      ? series.slots
      : {
          ...series.slots,
          states: series.slots.states.map((state, slot) => (only.has(slot) ? state : ("pending" as const))),
        };
  return clockDots(values, slots, (slot) => groupOf(series, clock, slot).replace("-past", ""));
}

/** Draw a series' dots, in their step groups, at the vertices this frame draws. */
function drawDots(group: SVGGElement, look: DotsLook | null, values: MarkValues): void {
  if (look === null) return;
  const frame = entranceFrame(values);
  const groups = dotGroups(look, frame.values);
  for (const path of group.querySelectorAll("path[data-group]")) {
    writeAttribute(path, "d", groups.get(path.getAttribute("data-group") ?? "") ?? "");
  }
  writeReveal(group, frame.reveal);
}

/** A dot layer over a series' vertices: every reading, or the slots a Marker names. */
function DotLayer({
  dataSlot,
  part,
  dataKey,
  variant,
  only,
  className,
  style,
  children,
}: {
  readonly dataSlot: string;
  readonly part: string;
  readonly dataKey: string;
  readonly variant: string;
  readonly only: (clock: ClockDrawing, series: ClockSeries) => readonly number[] | null;
  readonly className: string | undefined;
  readonly style: CSSProperties | undefined;
  readonly children?: ReactNode;
}): ReactElement {
  const { polar, clock, series } = useClockSeries(part, dataKey);
  const picked = useMemo(() => (series === undefined ? null : only(clock, series)), [only, clock, series]);
  const look = useMemo(
    (): DotsLook | null =>
      series === undefined ? null : { series, clock, only: picked === null ? null : new Set(picked) },
    [series, clock, picked]
  );
  const { ref, place, node: anchor } = usePolarMark(polar.motion, drawDots, look);
  // React writes the dots once at rest, so the server's chart shows them, and the loop from then on.
  const [first] = useState(() =>
    look === null ? new Map<string, string>() : dotGroups(look, look.series.rest)
  );
  const commit = usePolarCommit(polar, anchor);
  useClockPlacement(clock, series, commit, place);
  const prefix = useId();
  const steps = series?.steps ?? [{ paint: series?.paint ?? "currentColor", from: 0 }];
  return (
    <ClockMarkerContext value={series === undefined || picked === null ? null : { series, slots: picked }}>
      <svg
        data-slot={dataSlot}
        data-variant={variant}
        data-clock-series=""
        data-polar-layer=""
        data-polar-mark=""
        aria-hidden="true"
        focusable="false"
        viewBox={viewBoxOf(polar.box)}
        className={className}
        style={{
          "--chart-series": series?.index ?? 0,
          "--_base": series?.paint ?? "currentColor",
          ...style,
        }}>
        <defs>
          <clipPath id={`${prefix}-reveal`}>
            <path data-part="reveal" d="" />
          </clipPath>
        </defs>
        <g ref={ref} data-clip={`url(#${prefix}-reveal)`}>
          {steps.map(({ paint }, index) => (
            <g key={index} style={{ "--_dot": paint }}>
              {variant === "ping" ? (
                <path
                  data-slot="clock-chart-dot"
                  data-part="ping"
                  data-group={`step-${String(index)}`}
                  d={first.get(`step-${String(index)}`)}
                />
              ) : null}
              <path
                data-slot="clock-chart-dot"
                data-part="halo"
                data-group={`step-${String(index)}`}
                d={first.get(`step-${String(index)}`)}
              />
              <path
                data-slot="clock-chart-dot"
                data-part="dots"
                data-group={`step-${String(index)}`}
                d={first.get(`step-${String(index)}`)}
              />
            </g>
          ))}
        </g>
      </svg>
      {children}
    </ClockMarkerContext>
  );
}

/** Every slot, for Dots. */
const everyReading = (): null => null;

/**
 * A dot on every reading of one series, at the vertex its curve passes. A series painted by value
 * paints each dot in its own value's step.
 *
 * @beta
 */
export function ClockChartDots({
  dataKey,
  variant = "default",
  className,
  style,
}: ClockChartDotsProps): ReactElement {
  return (
    <DotLayer
      dataSlot="clock-chart-dots"
      part="ClockChart.Dots"
      dataKey={dataKey}
      variant={variant}
      only={everyReading}
      className={className}
      style={style}
    />
  );
}

/** The marker a ValueLabel sits beside: its series and the slots it marks. */
const ClockMarkerContext = createContext<{
  readonly series: ClockSeries;
  readonly slots: readonly number[];
} | null>(null);

/**
 * A dot on the slots `at` names, with an optional `ValueLabel` beside each.
 *
 * @beta
 */
export function ClockChartMarker({
  dataKey,
  at,
  variant = "default",
  className,
  style,
  children,
}: ClockChartMarkerProps): ReactElement {
  const only = useMemo(
    () => (clock: ClockDrawing, series: ClockSeries) =>
      clockDatumSlots(clock, "ClockChart.Marker", series, at),
    [at]
  );
  return (
    <DotLayer
      dataSlot="clock-chart-marker"
      part="ClockChart.Marker"
      dataKey={dataKey}
      variant={variant}
      only={only}
      className={className}
      style={style}>
      {children}
    </DotLayer>
  );
}

/**
 * The value of each slot its Marker marks, as a pill past the dot, reading away from the centre.
 * Outside a Marker it throws `part-outside-root`.
 *
 * @beta
 */
export function ClockChartValueLabel({ format, className, style }: ClockChartValueLabelProps): ReactElement {
  const marker = use(ClockMarkerContext);
  const polar = usePolarContext("ClockChart.ValueLabel", ["clock"]);
  const { locale } = useLocale();
  if (marker === null) {
    throw new ChartCompositionError(
      "ClockChart.ValueLabel",
      "part-outside-root",
      "must be used within ClockChart.Marker. Put it inside the Marker whose values it prints."
    );
  }
  const clock = clockDrawingIn(polar.model, "ClockChart.ValueLabel");
  const { box } = polar;
  const { series, slots } = marker;
  const valueFormat = format ?? clock.text.config[series.key]?.format ?? {};
  return (
    <div
      data-slot="clock-chart-value-labels"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {slots.flatMap((slot) => {
        const value = series.values[slot];
        if (value === null || value === undefined) return [];
        const vertex = slotVertex(series.rest, slot);
        const { point, alignX, alignY } = angleLabel(vertex.angle, vertex.radius + 0.08);
        const left = ((point.x - box.left) / (box.right - box.left)) * 100;
        const top = ((point.y - box.top) / (box.bottom - box.top)) * 100;
        return [
          <span
            key={slot}
            data-slot="clock-chart-value-label"
            style={{
              "--_x": `${left.toFixed(3)}%`,
              "--_y": `${top.toFixed(3)}%`,
              "--_align-x": `${String(-alignX * 100)}%`,
              "--_align-y": `${String(-alignY * 100)}%`,
            }}>
            {formatValue(locale, value, valueFormat, "full").text}
          </span>,
        ];
      })}
    </div>
  );
}

/** CSS pixels per unit of the outer radius, as the layer shows now. */
function pixelsPerUnit(svg: SVGSVGElement, box: PolarContextValue["box"]): number {
  const width = box.right - box.left;
  return width > 0 ? svg.getBoundingClientRect().width / width : 0;
}

/** Each loop's Lines' curves by series, which an ActiveDot rides between slots. */
const curves = new WeakMap<ChartMotion, Map<string, ChartCurve>>();

/** Note the curve a Line draws its series in, for as long as it is mounted. */
function useLineCurve(motion: ChartMotion, key: string, curve: ChartCurve): void {
  useLayoutEffect(() => {
    const byKey = curves.get(motion) ?? new Map<string, ChartCurve>();
    curves.set(motion, byKey);
    byKey.set(key, curve);
    return () => {
      if (byKey.get(key) === curve) byKey.delete(key);
    };
  }, [motion, key, curve]);
}

/** The slot whose vertex a slot's reading draws at: its own, or the first slot of its coarse slot. */
function vertexSlot(series: ClockSeries, slot: number): number {
  let at = slot;
  while (at > 0 && series.slots.states[at] === "covered") at -= 1;
  return at;
}

/** What an active dot's writer reads: its series, the slot it shows and the numbers it drew last. */
type DotLook = {
  readonly series: ClockSeries;
  readonly shown: { current: number | null };
  readonly drawn: { current: MarkValues | null };
};

/** Draw the active dot at its slot's vertex in this frame's numbers, so it follows its series' tween. */
function drawActiveDot(group: SVGGElement, look: DotLook | null, values: MarkValues): void {
  if (look === null) return;
  look.drawn.current = values;
  const slot = look.shown.current;
  if (slot === null) return;
  const { x, y } = clockXY(slotVertex(entranceFrame(values).values, vertexSlot(look.series, slot)));
  for (const path of group.querySelectorAll("path"))
    writeAttribute(path, "d", `M${pathNumber(x)},${pathNumber(y)}h0`);
}

/**
 * The dot on one series at the active slot. It moves with its series as the series tweens, and a
 * step rides the curve its Line draws to the new slot the short way round, on the follow spring,
 * which a fast pointer stiffens. A missing reading at the active slot shows no dot. It paints its
 * value's step of a threshold or a scale.
 *
 * @beta
 */
export function ClockChartActiveDot({
  dataKey,
  variant = "default",
  className,
  style,
}: ClockChartActiveDotProps): ReactElement {
  const { polar, clock, series } = useClockSeries("ClockChart.ActiveDot", dataKey);
  const { kernel, box } = polar;
  const svg = useRef<SVGSVGElement>(null);
  const dot = useRef<SVGGElement | null>(null);
  const shown = useRef<number | null>(null);
  const drawn = useRef<MarkValues | null>(null);
  const look = useMemo(
    (): DotLook | null => (series === undefined ? null : { series, shown, drawn }),
    [series, shown, drawn]
  );
  const { ref, place, node: anchor } = usePolarMark(polar.motion, drawActiveDot, look);
  const commit = usePolarCommit(polar, anchor);
  useClockPlacement(clock, series, commit, place);
  const paint = (active: ActiveSlot, cause: FollowerCause): void => {
    const group = dot.current;
    const layer = svg.current;
    if (group === null || layer === null || series === undefined || look === null) return;
    const slot = active?.slot ?? null;
    const reading = slot !== null && series.slots.states[vertexSlot(series, slot)] === "reading";
    const before = shown.current;
    shown.current = reading ? slot : null;
    for (const animation of group.getAnimations()) animation.cancel();
    writeAttribute(group, "data-value", reading ? "" : null);
    if (!reading) return;
    const values = drawn.current ?? series.rest;
    drawActiveDot(group, look, values);
    const step = series.steps?.[series.stepAt[slot] ?? 0]?.paint ?? series.paint;
    writeStyle(group, "--_dot", step);
    if (cause !== "step" || before === null || before === slot || polar.motion.reduced()) return;
    const scale = pixelsPerUnit(layer, box);
    const timing = springTiming(stepSpring(kernel.store));
    if (scale === 0 || !timing.spring) return;
    const curve = curves.get(polar.motion)?.get(dataKey) ?? "monotone";
    const from = vertexSlot(series, before);
    const to = vertexSlot(series, slot);
    const route = curveRoute(values, series.slots, curve, from, to).map(clockXY);
    const { x, y } = clockXY(slotVertex(values, to));
    if (route.length < 2) return;
    const lengths = route.slice(1).map((point, index) => {
      const start = route[index] ?? point;
      return Math.hypot(point.x - start.x, point.y - start.y);
    });
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let reached = 0;
    const frames = route.map((point, index) => {
      if (index > 0) reached += lengths[index - 1] ?? 0;
      return {
        offset: total === 0 ? index / (route.length - 1) : reached / total,
        translate: `${((point.x - x) * scale).toFixed(2)}px ${((point.y - y) * scale).toFixed(2)}px`,
      };
    });
    group.animate(frames, { duration: timing.duration, easing: timing.easing });
  };
  useChartFollower("ClockChart.ActiveDot", paint);
  return (
    <svg
      ref={svg}
      data-slot="clock-chart-active-dot"
      data-variant={variant}
      data-clock-series=""
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
        {variant === "ping" ? <path data-slot="clock-chart-dot" data-part="ping" d="" /> : null}
        <path data-slot="clock-chart-dot" data-part="halo" d="" />
        <path data-slot="clock-chart-dot" data-part="dots" d="" />
      </g>
    </svg>
  );
}

/**
 * Wraps clock marks and glows them: a series of one paint casts its colour as a line's or a bar's
 * glow does, and a series painted by value glows through a filter that blurs its own pixels, so each
 * halo takes its mark's step.
 *
 * @beta
 */
export function ClockChartGlow({ children, className, style }: ClockChartGlowProps): ReactElement {
  usePolarContext("ClockChart.Glow", ["clock"]);
  return (
    <div data-slot="clock-chart-glow" className={className} style={style}>
      {children}
    </div>
  );
}

Object.assign(ClockChartLine, { displayName: "ClockChart.Line" });
Object.assign(ClockChartArea, { displayName: "ClockChart.Area" });
Object.assign(ClockChartColumn, { displayName: "ClockChart.Column" });
Object.assign(ClockChartDots, { displayName: "ClockChart.Dots" });
Object.assign(ClockChartMarker, { displayName: "ClockChart.Marker" });
Object.assign(ClockChartValueLabel, { displayName: "ClockChart.ValueLabel" });
Object.assign(ClockChartActiveDot, { displayName: "ClockChart.ActiveDot" });
Object.assign(ClockChartGlow, { displayName: "ClockChart.Glow" });
