"use client";

/**
 * The bar tracks a Root's active dots ride, by the dot's layer, so the tooltip's roof can hold each
 * one as an invisible line. A dot on a Line or an Area rides the drawn line, which the roof already
 * holds, so its reader gives no track. The roof reads the tracks with the series marks, and builds
 * them again once a dot registers or forgets its track. Each Root owns its own registry, as it owns
 * its followers and its paths, so a dot in one chart leaves another chart's roof alone.
 */
import type { Track } from "./layout/ride";

/** A Root's active dots and the bar tracks they ride. */
export type ChartRiders = {
  /**
   * Register the track an active dot's layer rides, for as long as the layer stays and rides the
   * same series.
   *
   * @returns A function that forgets the registration.
   */
  readonly register: (layer: Element, track: () => Track | null) => () => void;
  /** The bar track an active dot's layer rides, or null for a dot that rides no bar track. */
  readonly track: (layer: Element) => Track | null;
  /**
   * A count that grows whenever a dot registers or forgets its track, as when it mounts, unmounts
   * or changes the series it rides. A dot's own moves along its track leave it alone.
   */
  readonly revision: () => number;
};

/**
 * Create a Root's rider registry.
 *
 * @returns The registry.
 */
export function createChartRiders(): ChartRiders {
  const riders = new WeakMap<Element, () => Track | null>();
  let revision = 0;
  return {
    register: (layer, track) => {
      riders.set(layer, track);
      revision += 1;
      return () => {
        if (riders.get(layer) !== track) return;
        riders.delete(layer);
        revision += 1;
      };
    },
    track: (layer) => riders.get(layer)?.() ?? null,
    revision: () => revision,
  };
}
