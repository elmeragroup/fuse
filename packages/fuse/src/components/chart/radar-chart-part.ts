"use client";

/**
 * What the radar's series marks and its ActiveDot share: a series' spoke states, its radius on each
 * spoke at rest, and each spoke's vertex at the radii a frame draws. Each part keeps its own
 * module, so a route ships only the parts it names (Q1).
 */
import type { MarkValues } from "./chart-motion";
import type { RadarDrawing, RadarSeries } from "./chart-polar-context";
import { polarPoint } from "./layout/polar-angle";
import type { PolarPoint } from "./layout/polar-angle";
import { spokeAngle } from "./layout/radar";

/** What a series' spokes hold beside their radii: which are missing or estimated, and the radius of 0. */
export type SpokeStates = {
  readonly count: number;
  /** The radius of 0, where the Area's fill starts and a missing spoke rests. */
  readonly zero: number;
  readonly missing: readonly boolean[];
  readonly marked: readonly boolean[];
};

/** A series' spoke states in a drawing. */
export function spokeStatesOf(radar: RadarDrawing, series: RadarSeries | undefined): SpokeStates {
  const qualities = series?.qualities ?? [];
  return {
    count: radar.count,
    zero: radar.zero ?? 0,
    missing: Array.from({ length: radar.count }, (_, index) => (series?.values[index] ?? null) === null),
    marked: Array.from({ length: radar.count }, (_, index) => qualities[index] === "estimated"),
  };
}

/** Each spoke's radius at rest: its reading's, or the radius of 0 where it is missing. */
export function radiiOf(radar: RadarDrawing, series: RadarSeries | undefined): MarkValues {
  const { domain } = radar;
  const span = domain[1] - domain[0];
  return Array.from({ length: radar.count }, (_, index) => {
    const value = series?.values[index] ?? null;
    if (value === null) return radar.zero ?? 0;
    return span === 0 ? 0 : (value - domain[0]) / span;
  });
}

/** Each spoke's vertex at the radii a frame draws, null where the reading is missing. */
export function verticesAt(spokes: SpokeStates, radii: MarkValues): readonly (PolarPoint | null)[] {
  return Array.from({ length: spokes.count }, (_, index) =>
    spokes.missing[index] === true ? null : polarPoint(spokeAngle(index, spokes.count), radii[index] ?? 0)
  );
}
