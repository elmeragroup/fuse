"use client";

/**
 * The clock's ActiveDot: the dot on one series at the active slot, which moves with its series'
 * tween and rides its Line's curve to the next slot on the follow spring.
 */
import { useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { ActiveSlot, FollowerCause } from "./chart-followers";
import type { MarkValues } from "./chart-motion";
import { viewBoxOf } from "./chart-pie-frame";
import type { ClockSeries } from "./chart-polar-context";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { springTiming, stepSpring } from "./chart-spring";
import type { ChartLayerProps } from "./chart-types";
import { useClockSeries, useClockPlacement, pixelsPerUnit, curves } from "./clock-chart-part";
import { clockXY, curveRoute, entranceFrame, ownerSlot, slotVertex } from "./layout/clock-path";
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
  const { x, y } = clockXY(
    slotVertex(entranceFrame(values).values, ownerSlot(look.series.slots.states, slot))
  );
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
    const reading = slot !== null && series.slots.states[ownerSlot(series.slots.states, slot)] === "reading";
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
    const from = ownerSlot(series.slots.states, before);
    const to = ownerSlot(series.slots.states, slot);
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

Object.assign(ClockChartActiveDot, { displayName: "ClockChart.ActiveDot" });
