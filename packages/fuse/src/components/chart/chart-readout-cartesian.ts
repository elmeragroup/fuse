"use client";

/**
 * A cartesian Root's readout: the shared series readout over Root's series model and its pick, its
 * swatches in the look the series' bars draw in.
 */
import type { ChartRootContextValue } from "./chart-context";
import { useCartesianPick } from "./chart-pick";
import type { ChartReadout } from "./chart-readout-port";
import { seriesReadoutOf } from "./chart-series-readout";
import { barForm, drawnBarVariant } from "./layout/bar-geometry";

/**
 * Build a cartesian Root's readout. Root memoises it on its context, so it changes with data,
 * config and the effective window, and never with the pointer.
 *
 * @param context - The Root.
 * @returns The readout.
 */
export function cartesianReadout(context: ChartRootContextValue): ChartReadout {
  const { model, config, orientation } = context;
  return seriesReadoutOf(
    context,
    {
      id: context.id,
      root: context.root,
      store: context.store,
      followers: context.followers,
      select: context.select,
      registerToggleGroup: context.registerToggleGroup,
      highlight: context.highlight,
      warnOnce: context.warnOnce,
      usePick: () => useCartesianPick(context, "Chart.Tooltip"),
    },
    {
      look: (key) => {
        // The swatch wears the look the series' bars draw in, from config at render time, so the
        // server HTML and the legend tell a hatched series apart before the chart hydrates.
        const look = drawnBarVariant(config[key]?.barVariant ?? "default", barForm(model, orientation));
        return look === "default" ? undefined : look;
      },
    }
  );
}
