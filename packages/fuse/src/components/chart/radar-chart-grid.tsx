"use client";

/**
 * The radar's Grid: rings at the radius domain's ticks and a spoke per row. When the domain reaches
 * below 0 the zero ring draws solid, as the bar's zero line does (R4). A ring is a polygon through
 * the spokes or a circle. The first paint draws it at rest (D18), and only a chart nothing painted
 * before, a client mount or one that leaves its empty state, scales its rings and spokes out as the
 * entrance starts. Its hand turns to the active spoke the short way round.
 */
import { useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { viewBoxOf } from "./chart-pie-frame";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { RadarDrawing } from "./chart-polar-context";
import { springTiming } from "./chart-spring";
import type { ChartLayerProps } from "./chart-types";
import { CHART_SPRINGS } from "./layout/motion";
import { polarPoint } from "./layout/polar-angle";
import { radarRadius, spokeAngle } from "./layout/radar";
import { pathNumber } from "./layout/rounding";
import { springEasing } from "./layout/spring";

/**
 * Props for `RadarChart.Grid`, a closed part.
 *
 * @beta
 */
export type RadarChartGridProps = ChartLayerProps & {
  /** The ring shape. "polygon" by default. */
  variant?: "polygon" | "circle";
};

const GROW = springEasing(CHART_SPRINGS.grow);
const EXTEND = springEasing(CHART_SPRINGS.extend);

/** A ring's path: a polygon through every spoke, or a circle. */
function ringPath(radius: number, count: number, variant: "polygon" | "circle"): string {
  if (variant === "circle" || count < 3) {
    const r = pathNumber(radius);
    return `M0,${pathNumber(-radius)}A${r},${r} 0 1 1 0,${r}A${r},${r} 0 1 1 0,${pathNumber(-radius)}Z`;
  }
  return `${Array.from({ length: count }, (_, index) => {
    const { x, y } = polarPoint(spokeAngle(index, count), radius);
    return `${index === 0 ? "M" : "L"}${pathNumber(x)},${pathNumber(y)}`;
  }).join("")}Z`;
}

/** The rings a radar draws: each tick's radius past the centre, the zero ring among them. */
function ringsOf(radar: RadarDrawing): readonly { readonly radius: number; readonly zero: boolean }[] {
  const radius = radarRadius(radar.domain, 1);
  return radar.ticks.flatMap((tick) => {
    const r = radius(tick);
    return r > 1e-9 ? [{ radius: r, zero: radar.zero !== null && tick === 0 }] : [];
  });
}

/** The angle a hand shows now, a running glide included, in its rest's turn. */
function shownAngle(node: SVGLineElement, rest: number): number {
  const shown = Number.parseFloat(getComputedStyle(node).rotate);
  if (!Number.isFinite(shown)) return rest;
  // The computed angle may come back in another turn than the one the hand keeps.
  return rest + ((((shown - rest) % 360) + 540) % 360) - 180;
}

/**
 * The rings and spokes. When the radius domain reaches below 0 it draws the zero ring solid. Its
 * hand marks the active spoke and turns to the next one the short way round.
 *
 * @beta
 */
export function RadarChartGrid({ variant = "polygon", className, style }: RadarChartGridProps): ReactElement {
  const { model, motion, box } = usePolarContext("RadarChart.Grid", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.Grid");
  const hand = useRef<SVGLineElement>(null);
  const turned = useRef<number | null>(null);
  const count = radar.count;
  // The hand turns to the active spoke by the short way, so it keeps an angle that never wraps.
  useChartFollower("RadarChart.Grid", (active, cause) => {
    const node = hand.current;
    if (node === null) return;
    writeAttribute(node, "data-shown", active === null ? null : "");
    if (active === null || count === 0) return;
    const target = spokeAngle(active.slot, count);
    const from = turned.current;
    const shown = from === null ? null : shownAngle(node, from);
    for (const animation of node.getAnimations()) animation.cancel();
    const rest = shown === null ? target : shown + ((((target - shown) % 360) + 540) % 360) - 180;
    turned.current = rest;
    writeStyle(node, "rotate", `${String(rest)}deg`);
    if (shown === null || cause !== "step" || motion.reduced() || Math.abs(rest - shown) < 1e-6) return;
    const timing = springTiming(CHART_SPRINGS.hand);
    if (!timing.spring) return;
    node.animate([{ rotate: `${String(shown)}deg` }, { rotate: `${String(rest)}deg` }], {
      duration: timing.duration,
      easing: timing.easing,
    });
  });
  return (
    <svg
      data-slot="radar-chart-grid"
      data-variant={variant}
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{
        "--_grow-duration": `${String(GROW.duration)}ms`,
        "--_grow-easing": GROW.easing,
        "--_extend-duration": `${String(EXTEND.duration)}ms`,
        "--_extend-easing": EXTEND.easing,
        ...style,
      }}>
      {ringsOf(radar).map(({ radius, zero }, index) => (
        <path
          key={radius}
          data-slot="radar-chart-grid-ring"
          data-zero={zero ? "" : undefined}
          d={ringPath(radius, count, variant)}
          style={{ "--chart-slot": index }}
        />
      ))}
      {Array.from({ length: count }, (_, index) => {
        const { x, y } = polarPoint(spokeAngle(index, count), 1);
        return (
          <line
            key={index}
            data-slot="radar-chart-spoke"
            x1="0"
            y1="0"
            x2={pathNumber(x)}
            y2={pathNumber(y)}
            style={{ "--chart-slot": index }}
          />
        );
      })}
      <line ref={hand} data-slot="radar-chart-spoke" data-part="hand" x1="0" y1="0" x2="0" y2="-1" />
    </svg>
  );
}

Object.assign(RadarChartGrid, { displayName: "RadarChart.Grid" });
