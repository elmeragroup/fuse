"use client";

/**
 * The radar's Grid: rings at the radius domain's ticks and a spoke per row. When the domain reaches
 * below 0 the zero ring draws solid, as the bar's zero line does (R4). A ring is a polygon through
 * the spokes or a circle. The first paint draws it at rest (D18), and only a chart nothing painted
 * before, a client mount or one that leaves its empty state, scales its rings and spokes out as the
 * entrance starts. Its hand turns to the active spoke the short way round, on the Root's angle
 * follower, so the active dots turn with it.
 */
import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { viewBoxOf } from "./chart-pie-frame";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { RadarDrawing } from "./chart-polar-context";
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

/**
 * The rings and spokes. When the radius domain reaches below 0 it draws the zero ring solid. Its
 * hand marks the active spoke and turns to the next one the short way round, with the active dots.
 *
 * @beta
 */
export function RadarChartGrid({ variant = "polygon", className, style }: RadarChartGridProps): ReactElement {
  const { model, box, kernel } = usePolarContext("RadarChart.Grid", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.Grid");
  const hand = useRef<SVGLineElement>(null);
  const count = radar.count;
  useChartFollower("RadarChart.Grid", (active) => {
    const node = hand.current;
    if (node !== null) writeAttribute(node, "data-shown", active === null || count === 0 ? null : "");
  });
  const { follow } = kernel;
  useLayoutEffect(() => {
    const turn = (angle: number): void => {
      const node = hand.current;
      if (node !== null) writeStyle(node, "rotate", `${String(angle)}deg`);
    };
    const shown = follow.shown();
    if (shown !== null) turn(shown);
    return follow.subscribe(turn);
  }, [follow]);
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
