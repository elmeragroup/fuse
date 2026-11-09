"use client";

/**
 * The clock's Column: a series as wedges, one per slot, each painting its value's step, floored one
 * device pixel along its radius (D24), stacked through the stack floors, and past 2,000 slots
 * decimated by M4 to the dial's circumference.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

import { useSvgIdPrefix, writeAttribute } from "./chart-dom";
import { BAR_GLOW, valueGlow } from "./chart-glow-filter";
import type { MarkValues } from "./chart-motion";
import { viewBoxOf } from "./chart-pie-frame";
import type { ClockDrawing, ClockSeries } from "./chart-polar-context";
import { PolarHatch } from "./chart-polar-hatch";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { useStackSeat } from "./chart-stack-floors";
import type { StackSeat } from "./chart-stack-floors";
import type { ChartDatum, ChartLayerProps } from "./chart-types";
import {
  DIAL_REGION,
  NOMINAL_RADIUS,
  assertClockBaseline,
  clockDatumSlots,
  groupOf,
  paintOf,
  retuneGlow,
  useClockPlacement,
  useClockSeries,
  writeReveal,
} from "./clock-chart-part";
import { columnAxis, columnFloorSpan, columnSpan, wedgePad } from "./layout/clock";
import { clockWedges, entranceFrame } from "./layout/clock-path";
import { DECIMATE_ABOVE, m4Indexes } from "./layout/decimate";

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

/** The constant gap between two wedges, in CSS pixels (D14). */
const WEDGE_GAP = 2;

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
  const pad = wedgePad(clock.count, radius, WEDGE_GAP, dpr);
  const padded = { padAngle: pad.padAngle, padRadius: pad.padRadius / radius, devicePixels: radius * dpr };
  const span = (slot: number, base: number, tip: number): readonly [number, number] => {
    if (keeps === null || keeps.get(slot) === true) {
      const [from, to] = columnSpan(axis, base * radius, tip * radius);
      return [from / radius, to / radius];
    }
    const snap = (edge: number): number => Math.round(edge * radius * dpr) / dpr / radius;
    return [snap(Math.min(base, tip)), snap(Math.max(base, tip))];
  };
  const shown = shownAt(series, radius);
  // A wedge's group composes its step, its time and its quality, so a marked wedge keeps its paint.
  const groups = clockWedges(
    values,
    series.slots,
    shown,
    padded,
    span,
    (slot) => `${groupOf(series, clock, slot)}${series.slots.marked[slot] === true ? "-marked" : ""}`
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
  assertClockBaseline(clock, "ClockChart.Column", "a wedge");
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
  const { ref, place, node: anchor, drawn: drawnFrame } = usePolarMark(polar.motion, drawColumns, look);
  const commit = usePolarCommit(polar, anchor);
  useClockPlacement(clock, series, look, { commit, place, drawn: drawnFrame });
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
  const prefix = useSvgIdPrefix("clock-chart-column");
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
        "--_glow": glow?.url,
        ...style,
      }}>
      <defs>
        {steps.map(({ paint: step }, index) => (
          <PolarHatch key={step} id={`${prefix}-hatch-${String(index)}`} paint={step} />
        ))}
        {glow?.filter(DIAL_REGION)}
        <clipPath id={`${prefix}-reveal`}>
          <path data-part="reveal" d="" />
        </clipPath>
        <mask id={`${prefix}-fade`} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
          <radialGradient id={`${prefix}-ramp`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1">
            {/* Each wedge fades toward zero, which sits at its own radius on the scale: solid at the
                hole's edge and at the rim, where the extremes reach, and faint at zero. */}
            <stop offset={clock.inner} data-part="far" />
            <stop offset={Math.min(1, Math.max(clock.inner, clock.radius(0)))} data-part="near" />
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
          ["", "-past"].flatMap((time) =>
            ["", "-marked"].map((quality) => {
              const name = `step-${String(index)}${time}${quality}`;
              return (
                <path
                  key={name}
                  data-slot="clock-chart-wedge"
                  data-group={name}
                  data-part={quality === "" ? undefined : "marked"}
                  data-time={time === "" ? undefined : "past"}
                  d={first.get(name)}
                  style={{
                    "--_wedge": step,
                    "--_fade": `url(#${prefix}-fade)`,
                    "--_hatch-paint": `url(#${prefix}-hatch-${String(index)})`,
                  }}
                />
              );
            })
          )
        )}
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

Object.assign(ClockChartColumn, { displayName: "ClockChart.Column" });
