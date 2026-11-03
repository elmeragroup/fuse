"use client";

/**
 * How a datum selector picks a series' slots, the one owner Bar `emphasis` and Marker `at` share.
 * A keyword picks among the series' values in the window, and explicit x values resolve to their
 * Root slots. Both then normalise through the series' own slots, so a coarse series' hour takes one
 * pick, at its first Root slot, however many of its quarters a selector names or ties.
 */
import type { ChartRootContextValue } from "./chart-context";
import { childSlot } from "./chart-reference";
import type { ChartDatum, ChartX } from "./chart-types";
import type { SeriesModel } from "./layout/cartesian-model";
import { ownFirsts } from "./layout/coarse-slots";
import { keywordSlots, listedSlots, nowSlotOf } from "./layout/datum";

/** Whether a datum names x values rather than a keyword. */
function isListed(datum: ChartDatum): datum is { readonly x: ChartX | readonly ChartX[] } {
  return datum !== "first" && datum !== "last" && datum !== "min" && datum !== "max" && datum !== "now";
}

/**
 * The slots a datum selects for a series, each the first Root slot of the series' own slot, once.
 *
 * @param context - The Root.
 * @param part - The selecting part's display name, which an x of the wrong type names.
 * @param series - The series.
 * @param datum - A keyword or explicit x values.
 * @param values - The value a keyword compares at each Root slot, null where none draws.
 * @returns The selected slots, ascending.
 * @throws {ChartCompositionError} `x-type-mismatch` for an x of the axis' other type.
 */
export function datumSlots(
  context: ChartRootContextValue,
  part: string,
  series: SeriesModel,
  datum: ChartDatum,
  values: readonly (number | null)[]
): number[] {
  const { model } = context;
  if (model.window === null) return [];
  if (isListed(datum)) {
    const xs: readonly ChartX[] = Array.isArray(datum.x) ? datum.x : [datum.x];
    return ownFirsts(
      series,
      listedSlots(
        xs.map((x) => childSlot(context, part, x)),
        model.window
      )
    );
  }
  const nowSlot = nowSlotOf(model.domain, context.now);
  return ownFirsts(series, keywordSlots(datum, { values, window: model.window, nowSlot }));
}
