"use client";

import { use, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { ChartLayoutContext, assertKnownKey, reportLayoutDomain, useChartRoot } from "./chart-context";
import type { ChartLayoutContextValue } from "./chart-context";
import { createChartLabels } from "./chart-labels";
import { createFrameOwner } from "./chart-motion";
import { colourFamilyError } from "./chart-paint";
import { ChartPlotContext, PlotReadsContext, usePanelPlot } from "./chart-plot";
import { PlotSkeleton } from "./chart-skeleton";
import { useSteady } from "./chart-steady";
import type { ChartConfig, ChartLayerProps } from "./chart-types";
import { layoutDomain } from "./layout/cartesian-model";
import type { LayoutInput } from "./layout/cartesian-model";
import { ChartCompositionError } from "./layout/errors";
import { sameItems } from "./layout/same-items";

/**
 * Props for `Chart.Panel`, a closed part.
 *
 * @beta
 */
export type ChartPanelProps = ChartLayerProps & {
  /**
   * The config keys this Panel draws. Its y domain comes from them, `yBaseline` and `yInclude`, over
   * the rows inside the effective `xRange`. The series cycle and the "all series" option list keys
   * in config order, so write config in Panel order. Every key of a `stack` sits in the same Panel.
   */
  series: readonly string[];
  /** As Root's `yBaseline`, for this Panel's layout. "zero" by default. */
  yBaseline?: "zero" | "none";
  /** As Root's `yInclude`, for this Panel's layout. */
  yInclude?: readonly number[];
  /**
   * The Panel's plot parts. Tooltip, Legend, LegendToggleGroup, Brush, Table, Empty, Headline and
   * Takeaway stay under Root, beside the Panels.
   */
  children?: ReactNode;
};

/**
 * The error of a stack whose keys this Panel lists only some of. A stack sums its parts slot by
 * slot, so one split over two Panels would float each Panel's part on parts its plot doesn't draw.
 *
 * @param config - The Root's config.
 * @param keys - The Panel's series.
 * @returns The error, or null when the Panel holds each of its stacks whole.
 */
function splitStackError(config: ChartConfig, keys: readonly string[]): ChartCompositionError | null {
  const listed = new Set(keys);
  for (const key of keys) {
    const stack = config[key]?.stack;
    if (stack === undefined) continue;
    const missing = Object.keys(config).find((other) => config[other]?.stack === stack && !listed.has(other));
    if (missing !== undefined) {
      return new ChartCompositionError(
        "Chart.Panel",
        "stack-across-panels",
        `lists ${JSON.stringify(key)} without ${JSON.stringify(missing)}, which share stack ${JSON.stringify(stack)}. List every key of a stack in one Panel.`
      );
    }
  }
  return null;
}

/**
 * A row with its own y axis and y domain. All Panels share Root's x grid, surface and tooltip. With
 * Panels, every config key sits in exactly one Panel, every plot part sits in a Panel, and the
 * x axis goes in the last Panel. A Panel under `orientation="horizontal"` throws `horizontal-panels`.
 * The Panels align their plots through CSS subgrid, so each takes the widest value axis and every
 * slot lands on the same pixels in every Panel. Each Panel's plot is `--chart-plot-height` tall,
 * 12.5rem by default, which Root or the Panel can set. A Root stacks any number of Panels in
 * source order.
 *
 * @beta
 */
export function ChartPanel({
  series,
  yBaseline = "zero",
  yInclude,
  className,
  style,
  children,
}: ChartPanelProps): ReactElement {
  const context = useChartRoot("Chart.Panel");
  const outer = use(ChartLayoutContext);
  if (outer?.kind === "panel") {
    throw new ChartCompositionError(
      "Chart.Panel",
      "nested-panel",
      "sits inside another Chart.Panel. Place every Panel directly under Chart.Root, one per row."
    );
  }
  if (context.orientation === "horizontal") {
    throw new ChartCompositionError(
      "Chart.Panel",
      "horizontal-panels",
      'sits under orientation="horizontal", where the categories already fill the rows. Draw horizontal bars in one Root with no Panel.'
    );
  }
  for (const key of series) assertKnownKey("Chart.Panel", context.config, key);
  const colourRule = colourFamilyError("Chart.Panel", context.config, series);
  if (colourRule !== null) throw colourRule;
  const stackRule = splitStackError(context.config, series);
  if (stackRule !== null) throw stackRule;
  // An inline array that names the same items is no change, so a parent's re-render never moves the
  // Panel's domain.
  const keys = useSteady(series, sameItems);
  const include = useSteady(yInclude, sameItems);
  const { model, stackOffset, registerPanel } = context;
  const input = useMemo(
    (): LayoutInput => ({ keys, baseline: yBaseline, include: include ?? [] }),
    [keys, yBaseline, include]
  );
  // The domain comes from the model during render, so the server and the hydration render agree.
  const y = useMemo(() => layoutDomain({ ...model, stackOffset }, input), [model, stackOffset, input]);
  // The first commit under each update decides whether the update moves this Panel's domain. An
  // insertion effect runs in the commit, before any layout effect, so every mark of the commit
  // reads every committed Panel's decision before it places, and a render that never commits, as a
  // suspended one, decides nothing. The update the Panel mounts under moves nothing.
  const { update } = context;
  const decided = useRef(update);
  useInsertionEffect(() => {
    if (decided.current === update) return;
    decided.current = update;
    reportLayoutDomain(update, keys, y.domain);
  }, [update, keys, y.domain]);
  const [labels] = useState(createChartLabels);
  // The Panel's frame, which names its marks' tweens to Root's loop for the Panel's life.
  const [owner] = useState(() => createFrameOwner("panel"));
  const layout = useMemo(
    (): ChartLayoutContextValue => ({ kind: "panel", keys, y, baseline: yBaseline, owner, labels }),
    [keys, y, yBaseline, owner, labels]
  );
  const plotRef = useRef<HTMLDivElement>(null);
  const { plot, probe, reads } = usePanelPlot(plotRef);
  useLayoutEffect(
    () => registerPanel({ layout: input, plot: () => plotRef.current }),
    [registerPanel, input]
  );
  // A commit of this Panel can move the plots without resizing one, so the span follows it.
  const { placeSpan } = context;
  useLayoutEffect(() => {
    placeSpan();
  });
  return (
    <ChartLayoutContext value={layout}>
      <div data-slot="chart-panel" className={className} style={style}>
        <div ref={plotRef} data-slot="chart-plot" aria-hidden="true">
          {probe}
          {plot === null && !model.empty ? <PlotSkeleton /> : null}
        </div>
        <ChartPlotContext value={plot}>
          <PlotReadsContext value={reads}>{children}</PlotReadsContext>
        </ChartPlotContext>
      </div>
    </ChartLayoutContext>
  );
}

Object.assign(ChartPanel, { displayName: "Chart.Panel" });
