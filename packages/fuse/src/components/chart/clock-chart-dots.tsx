"use client";

/**
 * The clock's dots: Dots on every reading, and Marker on the slots a datum names, each in its
 * value's step at the vertices the series draws in each frame.
 */
import { useId, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { writeAttribute } from "./chart-dom";
import { ClockMarkerContext } from "./chart-marker-context";
import type { MarkValues } from "./chart-motion";
import { viewBoxOf } from "./chart-pie-frame";
import type { ClockDrawing, ClockSeries } from "./chart-polar-context";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import type { ChartDatum, ChartLayerProps } from "./chart-types";
import { clockDatumSlots, useClockSeries, useClockPlacement, writeReveal, groupOf } from "./clock-chart-part";
import { clockDots, entranceFrame } from "./layout/clock-path";

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

Object.assign(ClockChartDots, { displayName: "ClockChart.Dots" });
Object.assign(ClockChartMarker, { displayName: "ClockChart.Marker" });
