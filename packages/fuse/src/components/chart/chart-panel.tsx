"use client";

import { use, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { ChartLayoutContext, assertKnownKey, reportLayoutDomain, useChartRoot } from "./chart-context";
import type { ChartLayoutContextValue } from "./chart-context";
import { createChartLabels } from "./chart-labels";
import { createFrameOwner } from "./chart-motion";
import { colourFamilyError } from "./chart-paint";
import { ChartPlotContext, usePanelPlot } from "./chart-plot";
import { PlotSkeleton } from "./chart-skeleton";
import type { ChartLayerProps } from "./chart-types";
import { layoutDomain } from "./layout/cartesian-model";
import type { LayoutInput } from "./layout/cartesian-model";
import { ChartCompositionError } from "./layout/errors";

/**
 * Props for `Chart.Panel`, a closed part.
 *
 * @beta
 */
export type ChartPanelProps = ChartLayerProps & {
  /**
   * The config keys this Panel draws. Its y domain comes from them, `yBaseline` and `yInclude`, over
   * the rows inside the effective `xRange`. The series cycle and the "all series" option list keys
   * in config order, so write config in Panel order.
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

/** Whether two lists hold the same items in the same order. */
function sameList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
}

/**
 * A list prop that keeps its identity while it names the same items, so an inline array is no
 * change and a parent's re-render never moves the Panel's domain.
 */
function useSteadyList<T>(list: readonly T[] | undefined): readonly T[] | undefined {
  const [steady, setSteady] = useState(list);
  if (steady === list || sameList(steady, list)) return steady;
  setSteady(list);
  return list;
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
  const keys = useSteadyList(series) ?? series;
  const include = useSteadyList(yInclude);
  const { model, stackOffset, registerPanel } = context;
  const input = useMemo(
    (): LayoutInput => ({ keys, baseline: yBaseline, include: include ?? [] }),
    [keys, yBaseline, include]
  );
  // The domain comes from the model during render, so the server and the hydration render agree.
  const y = useMemo(() => layoutDomain({ ...model, stackOffset }, input), [model, stackOffset, input]);
  // The first render under each update decides whether the update moves this Panel's domain, before
  // the Panel's or any other layout's marks place.
  const [decided, setDecided] = useState(context.update);
  if (decided !== context.update) {
    setDecided(context.update);
    reportLayoutDomain(context.update, keys, y.domain);
  }
  const [labels] = useState(createChartLabels);
  // The Panel's frame, which names its marks' tweens to Root's loop for the Panel's life.
  const [owner] = useState(() => createFrameOwner("panel"));
  const layout = useMemo(
    (): ChartLayoutContextValue => ({ kind: "panel", keys, y, baseline: yBaseline, owner, labels }),
    [keys, y, yBaseline, owner, labels]
  );
  const plotRef = useRef<HTMLDivElement>(null);
  const plot = usePanelPlot(plotRef);
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
          {plot === null && !model.empty ? <PlotSkeleton /> : null}
        </div>
        <ChartPlotContext value={plot}>{children}</ChartPlotContext>
      </div>
    </ChartLayoutContext>
  );
}

Object.assign(ChartPanel, { displayName: "Chart.Panel" });
