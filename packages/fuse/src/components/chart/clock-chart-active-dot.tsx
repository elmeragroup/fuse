"use client";

/**
 * The clock's ActiveDot: the dot on one series at the Root's follower angle, on the curve its Line or
 * Area draws, which moves with its series' tween and turns with the hand.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { ActiveSlot } from "./chart-followers";
import type { ChartMotion, MarkValues } from "./chart-motion";
import { viewBoxOf } from "./chart-pie-frame";
import type { ClockSeries } from "./chart-polar-context";
import { STRETCH_SPAN } from "./chart-polar-follow";
import type { PolarFollow } from "./chart-polar-follow";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import type { ChartLayerProps } from "./chart-types";
import { seriesCurve, useClockPlacement, useClockSeries } from "./clock-chart-part";
import { clockXY, curveRadiusAt, entranceFrame, ownerSlot, slotVertex } from "./layout/clock-path";
import { pathNumber } from "./layout/rounding";

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

/** What an active dot's writer reads: its series, whether a slot is active, and the numbers it drew last. */
type DotLook = {
  readonly series: ClockSeries;
  readonly key: string;
  readonly motion: ChartMotion;
  readonly follow: PolarFollow;
  readonly active: { current: boolean };
  readonly drawn: { current: MarkValues | null };
};

/**
 * The radius the series draws at an angle: its Line's or Area's curve, or, for a series drawn only
 * as Columns or Dots, the tip of the reading that owns the slot under the angle.
 */
function radiusAt(look: DotLook, values: readonly number[], angle: number): number | null {
  const { slots } = look.series;
  const curve = seriesCurve(look.motion, look.key);
  if (curve !== null) return curveRadiusAt(values, slots, curve, angle);
  const count = slots.states.length;
  if (count === 0) return null;
  const turned = ((angle % 360) + 360) % 360;
  const own = ownerSlot(slots.states, Math.min(count - 1, Math.floor((turned / 360) * count)));
  return slots.states[own] === "reading" ? slotVertex(values, own).radius : null;
}

/**
 * Place the dot on its series at the follower's angle in this frame's numbers, in the dial's own
 * units, so it lies on what its series draws and follows its tween. It shows only while a slot is
 * active and the series draws something at that angle.
 */
function placeDot(group: SVGGElement, look: DotLook, values: MarkValues): void {
  const angle = look.follow.shown();
  const radius =
    angle === null || !look.active.current ? null : radiusAt(look, entranceFrame(values).values, angle);
  writeAttribute(group, "data-value", radius === null ? null : "");
  if (angle === null || radius === null) return;
  const { x, y } = clockXY({ angle, radius });
  for (const path of group.querySelectorAll("path"))
    writeAttribute(path, "d", `M${pathNumber(x)},${pathNumber(y)}h0`);
}

/**
 * How far the dot moves per radian of turn at an angle, in outer radii, along its series' curve:
 * the curve's radius and its slope together, so a steep flank stretches the turn, or the radius
 * alone on a stepped series. Null while no slot is active or the series draws nothing about the
 * angle.
 */
function dotStretch(look: DotLook, angle: number): number | null {
  if (!look.active.current) return null;
  const values = entranceFrame(look.drawn.current ?? look.series.rest).values;
  const at = radiusAt(look, values, angle);
  // A stepped series, a Column's tips or a step curve, holds its radius across a slot and jumps at
  // the slot's edge, a jump the dot makes in one frame at any pace, so slowing the hand there buys
  // nothing and stutters it: its stretch is the radius alone.
  const curve = seriesCurve(look.motion, look.key);
  if (curve === null || curve === "step" || curve === "step-before" || curve === "step-after") return at;
  const before = radiusAt(look, values, angle - STRETCH_SPAN);
  const after = radiusAt(look, values, angle + STRETCH_SPAN);
  if (at === null || before === null || after === null) return null;
  return Math.hypot(at, (after - before) / ((2 * STRETCH_SPAN * Math.PI) / 180));
}

/** Draw the active dot in this loop frame's numbers, so it follows its series' tween. */
function drawActiveDot(group: SVGGElement, look: DotLook | null, values: MarkValues): void {
  if (look === null) return;
  look.drawn.current = values;
  placeDot(group, look, values);
}

/**
 * The dot on one series at the active slot. It sits on the curve its Line draws, or its Area's top
 * edge, at the Root's follower angle, so a step carries it along the curve with the hand, and it
 * moves with its series as the series tweens. A missing reading at the active slot shows no dot. It
 * paints its value's step of a threshold or a scale.
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
  const { kernel, box, motion } = polar;
  const { follow } = kernel;
  const dot = useRef<SVGGElement | null>(null);
  const active = useRef(false);
  const drawn = useRef<MarkValues | null>(null);
  const look = useMemo(
    (): DotLook | null =>
      series === undefined ? null : { series, key: dataKey, motion, follow, active, drawn },
    [series, dataKey, motion, follow, active, drawn]
  );
  const { ref, place, node: anchor } = usePolarMark(motion, drawActiveDot, look);
  const commit = usePolarCommit(polar, anchor);
  useClockPlacement(clock, series, commit, place);
  useChartFollower("ClockChart.ActiveDot", (current: ActiveSlot) => {
    const group = dot.current;
    if (group === null || series === undefined || look === null) return;
    active.current = current !== null;
    if (current !== null) {
      const step = series.steps?.[series.stepAt[current.slot] ?? 0]?.paint ?? series.paint;
      writeStyle(group, "--_dot", step);
    }
    placeDot(group, look, drawn.current ?? series.rest);
  });
  useLayoutEffect(() => {
    if (look === null) return undefined;
    const stop = follow.subscribe(() => {
      const group = dot.current;
      if (group !== null) placeDot(group, look, drawn.current ?? look.series.rest);
    });
    // The follower turns no faster than the pointer's pace carries the dot along its curve.
    const forget = follow.stretch((angle) => dotStretch(look, angle));
    return () => {
      stop();
      forget();
    };
  }, [follow, look]);
  return (
    <svg
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

Object.assign(ClockChartActiveDot, { displayName: "ClockChart.ActiveDot" });
