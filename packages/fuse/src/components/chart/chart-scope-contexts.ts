"use client";

/**
 * The contexts every Root's own scope resets. The first say where a shared readout part sits: its
 * template row, its legend side, a live readout, a Crosshair, a Headline, or a datum. The rest are
 * what a Root provides for its own parts: the cartesian Root's model, layout, plots and plot reads,
 * and the scatter Root's model and plot. They live in a light leaf, so each Root's scope resets them
 * without importing the readout hooks or another family's Root, and a part under a nested Root of
 * another family reaches no outer Root's context and throws `part-outside-root`, as it does alone.
 */
import { createContext } from "react";

import type { ChartLayoutContextValue, ChartRootContextValue } from "./chart-context";
import type { ChartPlot, PlotReads } from "./chart-plot-measure";
import type { ChartThresholdSide } from "./chart-types";
import type { ScatterRootContextValue } from "./scatter-chart-context";

/** The config key a template row renders for, such as one TooltipItems row. */
export const ChartRowContext = createContext<string | null>(null);

/** A threshold side's legend entry: the series it belongs to and the side it shows. */
export type LegendSide = { readonly key: string; readonly side: ChartThresholdSide };

/**
 * The legend entry of a threshold side around a part, null outside the legend entries of a
 * threshold series. The series key travels with the side because a nested row, such as a
 * LegendToggle or a TooltipItems row, replaces `ChartRowContext` and leaves this context alone.
 */
export const ChartLegendSideContext = createContext<LegendSide | null>(null);

/**
 * Whether the readout parts below follow the active point. The tooltip does, and a static legend
 * does not, so a pointer move renders no legend swatch or label.
 */
export const ChartLiveContext = createContext(false);

/**
 * The index a closing tooltip keeps showing while it fades out, so its content never empties and
 * shrinks before the fade, or null while it is open or shut.
 */
export const ChartHeldIndexContext = createContext<number | null>(null);

/** Whether a part sits inside a Crosshair, which a SlotLabel needs. */
export const ChartCrosshairContext = createContext(false);

/** Whether a part sits inside a Headline, where an ActiveValue is exposed text. */
export const ChartHeadlineContext = createContext(false);

/**
 * The datum a ValueLabel prints, which the enclosing ActiveValueLine or Marker provides: a key and
 * a slot, or the active slot when `slot` is null.
 */
export const ChartDatumContext = createContext<{ readonly key: string; readonly slot: number | null } | null>(
  null
);

/**
 * How many chart Roots enclose the next one: 0 outside every Root. Each Root writes its own depth on
 * its figure, so a hover rule bound to the nearest Root picks that Root out by its depth, which no
 * other Root on the chain shares, and the hover restyles only the parts it styles.
 */
export const ChartDepthContext = createContext(0);

/** The enclosing cartesian Root, or null outside one. */
export const ChartRootContext = createContext<ChartRootContextValue | null>(null);

/** The enclosing cartesian layout, Root's or a Panel's, or null outside one. */
export const ChartLayoutContext = createContext<ChartLayoutContextValue | null>(null);

/** The nearest measured plot, Root's or a Panel's, or null before the browser measures it. */
export const ChartPlotContext = createContext<ChartPlot | null>(null);

/** Root's own measured plot, which spans every Panel and gives each one its x frame. */
export const ChartRootPlotContext = createContext<ChartPlot | null>(null);

/** The plot reads outside every measured plot: none, so a read registers nowhere. */
export const NO_PLOT_READS: PlotReads = { add: () => () => undefined };

/** The reads of the nearest measured plot, Root's or a Panel's. */
export const PlotReadsContext = createContext<PlotReads>(NO_PLOT_READS);

/** The enclosing scatter Root, or null outside one. */
export const ScatterRootContext = createContext<ScatterRootContextValue | null>(null);

/** The scatter Root's measured plot, or null before the browser measures it. */
export const ScatterPlotContext = createContext<ChartPlot | null>(null);
