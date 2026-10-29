/**
 * The one projection of the active slot onto the follower marks: the active bar overlay, the
 * ActiveValue, the ActiveValueLine and its pill. Root paints the result at pointer rate, and a
 * Panel passes its own layout's value domain once Panels land. Positions are percent of the plot
 * along the value axis from the domain maximum, which `chart.css` turns into a top offset for
 * vertical charts and a right offset for horizontal ones.
 */
import { isNegative, isStackTop } from "./bar-geometry";
import type { CartesianModel, SeriesModel } from "./cartesian-model";
import { linearScale, scaleValue } from "./linear-scale";

/** One series' follower geometry at a slot. */
export type FollowerGeometry = {
  /** The rectangle's edge nearest the domain maximum. */
  readonly top: number;
  /** The rectangle's length along the value axis. */
  readonly height: number;
  /** The value's own end: the tip of a positive bar and the low end of a negative one. */
  readonly endpoint: number;
  readonly negative: boolean;
  /** Whether the segment is its stack's outer one on its side of zero. */
  readonly stackTop: boolean;
};

/**
 * Projects one series' drawn extent at a slot through a layout's value domain.
 *
 * @param model - The Root's model.
 * @param series - The series.
 * @param slot - The active slot.
 * @param y - The value domain of the layout the follower sits in.
 * @returns The geometry, or null when the slot draws nothing for the series.
 */
export function followerGeometry(
  model: CartesianModel,
  series: SeriesModel,
  slot: number,
  y: readonly [number, number]
): FollowerGeometry | null {
  const extent = series.extents[slot];
  if (!extent) return null;
  const scale = linearScale(y, [100, 0]);
  const top = scaleValue(scale, extent[1]);
  const bottom = scaleValue(scale, extent[0]);
  const negative = isNegative(extent);
  return {
    top,
    height: bottom - top,
    endpoint: negative ? bottom : top,
    negative,
    stackTop: isStackTop(model, series, slot),
  };
}
