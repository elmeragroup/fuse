"use client";

/**
 * The radar's ActiveDot: the dot on one series at the Root's follower angle, on the polygon's edge,
 * which moves with its series' tween and turns with the hand.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { ActiveSlot } from "./chart-followers";
import type { MarkValues } from "./chart-motion";
import { viewBoxOf } from "./chart-pie-frame";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { PolarFollow } from "./chart-polar-follow";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { useChartReadout } from "./chart-readout";
import type { ChartLayerProps } from "./chart-types";
import { dotsPath, edgePoint } from "./layout/radar";
import { radiiOf, spokeStatesOf, verticesAt } from "./radar-chart-part";
import type { SpokeStates } from "./radar-chart-part";

/**
 * Props for `RadarChart.ActiveDot`, a closed part.
 *
 * @beta
 */
export type RadarChartActiveDotProps = ChartLayerProps & {
  /** The series the dot follows. */
  dataKey: string;
};

/** What an active dot's writer reads: its spokes, the active spoke and the radii it drew last. */
type ActiveDotLook = {
  readonly spokes: SpokeStates;
  readonly follow: PolarFollow;
  readonly active: { current: number | null };
  readonly drawn: { current: MarkValues | null };
};

/**
 * Place the dot where the ray at the follower's angle meets the series' polygon in these radii, in
 * the dial's own units. A missing reading at the active spoke shows no dot.
 */
function placeDot(group: SVGGElement, look: ActiveDotLook, radii: MarkValues): void {
  const angle = look.follow.shown();
  const spoke = look.active.current;
  const vertices = verticesAt(look.spokes, radii);
  const shows = angle !== null && spoke !== null && vertices[spoke] != null;
  const point = shows ? edgePoint(vertices, angle) : null;
  writeAttribute(group, "data-value", point === null ? null : "");
  if (point === null) return;
  for (const path of group.children) writeAttribute(path, "d", dotsPath([point]));
}

/** Draw the active dot in this loop frame's radii, so it follows its series' tween. */
function drawActiveDot(group: SVGGElement, look: ActiveDotLook, radii: MarkValues): void {
  look.drawn.current = radii;
  placeDot(group, look, radii);
}

/**
 * The dot on one series at the active spoke. It sits on the polygon's edge at the Root's follower
 * angle, so a step carries it along the edges to the new spoke the short way round, through each
 * vertex between, with the hand, and it moves with its series as the series tweens. A missing
 * reading at the active spoke shows no dot.
 *
 * @beta
 */
export function RadarChartActiveDot({ dataKey, className, style }: RadarChartActiveDotProps): ReactElement {
  const polar = usePolarContext("RadarChart.ActiveDot", ["radar"]);
  const { model, kernel, box } = polar;
  const { follow } = kernel;
  const readout = useChartReadout("RadarChart.ActiveDot");
  readout.assertKey("RadarChart.ActiveDot", dataKey);
  const radar = radarDrawingIn(model, "RadarChart.ActiveDot");
  const series = radar.series.find(({ key }) => key === dataKey);
  const spokes = useMemo(() => spokeStatesOf(radar, series), [radar, series]);
  const dot = useRef<SVGGElement | null>(null);
  const active = useRef<number | null>(null);
  const drawn = useRef<MarkValues | null>(null);
  const look = useMemo(
    (): ActiveDotLook => ({ spokes, follow, active, drawn }),
    [spokes, follow, active, drawn]
  );
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
  useChartFollower("RadarChart.ActiveDot", (current: ActiveSlot) => {
    const node = dot.current;
    if (node === null) return;
    active.current = current?.slot ?? null;
    placeDot(node, look, drawn.current ?? radii);
  });
  useLayoutEffect(
    () =>
      follow.subscribe(() => {
        const node = dot.current;
        if (node !== null) placeDot(node, look, drawn.current ?? radii);
      }),
    [follow, look, radii]
  );
  return (
    <svg
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

Object.assign(RadarChartActiveDot, { displayName: "RadarChart.ActiveDot" });
