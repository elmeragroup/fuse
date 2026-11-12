"use client";

/**
 * The clock's dots: Dots on every reading, and Marker on the slots a datum names, each in its
 * value's step at the vertices the series draws in each frame.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { useSvgIdPrefix, writeAttribute } from "./chart-dom";
import { ClockMarkerContext } from "./chart-marker-context";
import type { MarkerLabels } from "./chart-marker-context";
import type { MarkValues } from "./chart-motion";
import type { ClockDrawing, ClockSeries } from "./chart-polar-context";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { useSteady } from "./chart-steady";
import type { ChartDatum, ChartLayerProps } from "./chart-types";
import { clockDatumSlots, useClockSeries, useClockPlacement, writeReveal, groupOf } from "./clock-chart-part";
import { clockDots, entranceFrame, slotVertex } from "./layout/clock-path";
import type { EntranceFrame } from "./layout/clock-path";
import { viewBoxOf } from "./layout/polar-angle";
import { sameItems } from "./layout/same-items";

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
  /** The Marker's own ValueLabels, which hide while its dots move. */
  readonly labels: MarkerLabels;
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

/**
 * Whether a Marker's dots sit anywhere but at rest in a frame: the entrance still opens, or a marked
 * slot's vertex has not reached its rest. Its ValueLabels' pills sit at rest, so they hide meanwhile.
 */
function markerMoving(look: DotsLook, frame: EntranceFrame): boolean {
  if (look.only === null) return false;
  if (frame.reveal < 360) return true;
  const { rest } = look.series;
  if (frame.values.length !== rest.length) return true;
  for (const slot of look.only) {
    const drawn = slotVertex(frame.values, slot);
    const resting = slotVertex(rest, slot);
    if (Math.abs(drawn.angle - resting.angle) > 1e-6 || Math.abs(drawn.radius - resting.radius) > 1e-6)
      return true;
  }
  return false;
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
  // The flag outlives the labels, so one that registers later starts from this frame's.
  look.labels.moving = markerMoving(look, frame);
  for (const node of look.labels.nodes) writeAttribute(node, "data-moving", look.labels.moving ? "" : null);
}

/** Whether two picks name the same slots, or both name every slot. */
function sameSlots(a: readonly number[] | null, b: readonly number[] | null): boolean {
  return a === null || b === null ? a === b : sameItems(a, b);
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
  // A Marker's inline `at`, a new object on every render of its parent, picks the same slots, so
  // they hold steady and nothing that builds on them draws again.
  const picked = useSteady(
    useMemo(() => (series === undefined ? null : only(clock, series)), [only, clock, series]),
    sameSlots
  );
  // Each of the Marker's own ValueLabels registers here, so the writer flags its labels alone.
  const [labels] = useState((): MarkerLabels => ({ nodes: new Set(), moving: false }));
  const look = useMemo(
    (): DotsLook | null =>
      series === undefined ? null : { series, clock, only: picked === null ? null : new Set(picked), labels },
    [series, clock, picked, labels]
  );
  const { ref, place, node: anchor, drawn } = usePolarMark(polar.motion, drawDots, look);
  // React writes the dots once at rest, so the server's chart shows them, and the loop from then on.
  const [first] = useState(() =>
    look === null ? new Map<string, string>() : dotGroups(look, look.series.rest)
  );
  const commit = usePolarCommit(polar.commit, anchor);
  useClockPlacement(clock, series, look, { commit, place, drawn });
  // A variant change mounts paths at the first rest. Repaint every path from the frame the loop
  // drew last, without placing the mark again, so the motion runs on untouched.
  const painted = useRef(variant);
  useLayoutEffect(() => {
    if (painted.current === variant) return;
    painted.current = variant;
    const group = anchor();
    if (group !== null && look !== null) drawDots(group, look, drawn() ?? look.series.rest);
  }, [variant, anchor, look, drawn]);
  const prefix = useSvgIdPrefix("clock-chart-dots");
  const steps = series?.steps ?? [{ paint: series?.paint ?? "currentColor", from: 0 }];
  return (
    <ClockMarkerContext
      value={series === undefined || picked === null ? null : { series, slots: picked, labels }}>
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
