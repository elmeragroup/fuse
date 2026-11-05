"use client";

/**
 * The radar's ActiveDot: the dot on one series at the active spoke. It moves with its series as the
 * series tweens on the Root's loop, and a step rides the polygon's edges to the new spoke.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { ActiveSlot, FollowerCause } from "./chart-followers";
import type { MarkValues } from "./chart-motion";
import { viewBoxOf } from "./chart-pie-frame";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { useChartReadout } from "./chart-readout";
import { springTiming, stepSpring } from "./chart-spring";
import type { ChartLayerProps } from "./chart-types";
import type { PolarPoint, SweepBox } from "./layout/polar-angle";
import { dotsPath } from "./layout/radar";
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

/** CSS pixels per unit of the outer radius, as the layer shows now. */
function pixelsPerUnit(svg: SVGSVGElement, box: SweepBox): number {
  const width = box.right - box.left;
  return width > 0 ? svg.getBoundingClientRect().width / width : 0;
}

/** What an active dot's writer reads: its spokes, the spoke it shows and the radii it drew last. */
type ActiveDotLook = {
  readonly spokes: SpokeStates;
  readonly shown: { current: number | null };
  readonly drawn: { current: MarkValues | null };
};

/** Draw the active dot at its spoke's vertex in this frame's radii, so it follows its series' tween. */
function drawActiveDot(group: SVGGElement, look: ActiveDotLook, radii: MarkValues): void {
  look.drawn.current = radii;
  const spoke = look.shown.current;
  const vertex = spoke === null ? null : (verticesAt(look.spokes, radii)[spoke] ?? null);
  if (vertex === null) return;
  for (const path of group.children) writeAttribute(path, "d", dotsPath([vertex]));
}

/**
 * The dot on one series at the active spoke. It moves with its series as the series tweens, and a
 * step rides the polygon's edges to the new spoke the short way round, through each vertex between,
 * on the follow spring, which a fast pointer stiffens. A missing reading at the active spoke shows no
 * dot.
 *
 * @beta
 */
export function RadarChartActiveDot({ dataKey, className, style }: RadarChartActiveDotProps): ReactElement {
  const polar = usePolarContext("RadarChart.ActiveDot", ["radar"]);
  const { model, kernel, box } = polar;
  const readout = useChartReadout("RadarChart.ActiveDot");
  readout.assertKey("RadarChart.ActiveDot", dataKey);
  const radar = radarDrawingIn(model, "RadarChart.ActiveDot");
  const series = radar.series.find(({ key }) => key === dataKey);
  const spokes = useMemo(() => spokeStatesOf(radar, series), [radar, series]);
  const svg = useRef<SVGSVGElement>(null);
  const dot = useRef<SVGGElement | null>(null);
  const shown = useRef<number | null>(null);
  const drawn = useRef<MarkValues | null>(null);
  const look = useMemo((): ActiveDotLook => ({ spokes, shown, drawn }), [spokes, shown, drawn]);
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
  const paint = (active: ActiveSlot, cause: FollowerCause): void => {
    const node = dot.current;
    const layer = svg.current;
    if (node === null || layer === null) return;
    const slot = active?.slot ?? null;
    const vertices = verticesAt(spokes, drawn.current ?? radii);
    const vertex = slot === null ? null : (vertices[slot] ?? null);
    const before = shown.current;
    shown.current = vertex === null ? null : slot;
    for (const animation of node.getAnimations()) animation.cancel();
    writeAttribute(node, "data-value", vertex === null ? null : "");
    if (vertex === null || slot === null) return;
    for (const path of node.children) writeAttribute(path, "d", dotsPath([vertex]));
    if (cause !== "step" || before === null || before === slot || polar.motion.reduced()) return;
    const route = rideRoute(vertices, before, slot);
    const scale = pixelsPerUnit(layer, box);
    if (route.length < 2 || scale === 0) return;
    const timing = springTiming(stepSpring(kernel.store));
    if (!timing.spring) return;
    const lengths = route.slice(1).map((point, step) => {
      const from = route[step] ?? point;
      return Math.hypot(point.x - from.x, point.y - from.y);
    });
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let reached = 0;
    const frames = route.map((point, step) => {
      if (step > 0) reached += lengths[step - 1] ?? 0;
      const x = ((point.x - vertex.x) * scale).toFixed(2);
      const y = ((point.y - vertex.y) * scale).toFixed(2);
      return {
        offset: total === 0 ? step / (route.length - 1) : reached / total,
        translate: `${x}px ${y}px`,
      };
    });
    node.animate(frames, { duration: timing.duration, easing: timing.easing });
  };
  useChartFollower("RadarChart.ActiveDot", paint);
  return (
    <svg
      ref={svg}
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

/**
 * The vertices a ride passes from one spoke to another the short way round, a tie going clockwise,
 * skipping a missing reading on the way.
 *
 * @param vertices - The series' vertex per spoke, null for a missing one.
 * @param from - The spoke the dot showed on.
 * @param to - The active spoke.
 * @returns The route's points, from the old vertex to the new.
 */
function rideRoute(
  vertices: readonly (PolarPoint | null)[],
  from: number,
  to: number
): readonly PolarPoint[] {
  const count = vertices.length;
  const ahead = (((to - from) % count) + count) % count;
  const direction = ahead <= count - ahead ? 1 : -1;
  const steps = direction === 1 ? ahead : count - ahead;
  return Array.from(
    { length: steps + 1 },
    (_, step) => vertices[(from + direction * step + count) % count] ?? null
  ).filter((point): point is PolarPoint => point !== null);
}

Object.assign(RadarChartActiveDot, { displayName: "RadarChart.ActiveDot" });
