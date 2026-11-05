"use client";

/**
 * The scope every chart Root starts, cartesian and polar alike. It lives in a light leaf, so a polar
 * Root takes it without importing the cartesian Root.
 */
import { use } from "react";
import type { ReactElement, ReactNode } from "react";

import { ClockMarkerContext } from "./chart-marker-context";
import { PolarContext } from "./chart-polar-context";
import { ChartReadoutContext, ChartSelectionContext } from "./chart-readout-port";
import {
  ChartCrosshairContext,
  ChartDatumContext,
  ChartDepthContext,
  ChartHeadlineContext,
  ChartLegendSideContext,
  ChartLiveContext,
  ChartRowContext,
  ChartLayoutContext,
  ChartPlotContext,
  ChartRootContext,
  ChartRootPlotContext,
  NO_PLOT_READS,
  PlotReadsContext,
  ScatterPlotContext,
  ScatterRootContext,
} from "./chart-scope-contexts";

/**
 * A Root starts its own scope, so an outer chart's row, legend side, Tooltip, Headline, Crosshair,
 * Marker or ActiveValueLine, an outer Root of any family with its readout, selection, layout and
 * plots, or an outer clock Marker never reaches a part of this one, such as a sparkline in a legend
 * item or a pie in a tooltip. A part of another family under this Root therefore throws
 * `part-outside-root`, as it does alone. This chart's own Tooltip, Headline, Crosshair, Marker and
 * ActiveValueLine set theirs again for their children, and the Root provides its own contexts
 * inside it. A BarGroup's and a Table row's contexts stay out, because a Root can't sit in a
 * BarGroup's aria-hidden plot layer or inside a table row.
 *
 * @param props - The Root's tree.
 * @returns The tree in a scope of its own.
 */
export function ChartOwnScope({ children }: { readonly children: ReactNode }): ReactElement {
  const depth = use(ChartDepthContext);
  return (
    <ChartDepthContext value={depth + 1}>
      <ChartRowContext value={null}>
        <ChartLegendSideContext value={null}>
          <ChartLiveContext value={false}>
            <ChartHeadlineContext value={false}>
              <ChartCrosshairContext value={false}>
                <ChartDatumContext value={null}>
                  <RootContexts>{children}</RootContexts>
                </ChartDatumContext>
              </ChartCrosshairContext>
            </ChartHeadlineContext>
          </ChartLiveContext>
        </ChartLegendSideContext>
      </ChartRowContext>
    </ChartDepthContext>
  );
}

/**
 * How many chart Roots enclose this one, 0 for the outermost, which its figure writes as
 * `data-chart-depth`. A Root reads it outside its own scope.
 *
 * @returns The depth.
 */
export function useChartDepth(): number {
  return use(ChartDepthContext);
}

/** Every family's Root contexts, reset, so each Root sets only its own again inside the scope. */
function RootContexts({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <ChartReadoutContext value={null}>
      <ChartSelectionContext value={null}>
        <ChartRootContext value={null}>
          <ChartLayoutContext value={null}>
            <ChartRootPlotContext value={null}>
              <ChartPlotContext value={null}>
                <PlotReadsContext value={NO_PLOT_READS}>
                  <ScatterRootContext value={null}>
                    <ScatterPlotContext value={null}>
                      <PolarContext value={null}>
                        <ClockMarkerContext value={null}>{children}</ClockMarkerContext>
                      </PolarContext>
                    </ScatterPlotContext>
                  </ScatterRootContext>
                </PlotReadsContext>
              </ChartPlotContext>
            </ChartRootPlotContext>
          </ChartLayoutContext>
        </ChartRootContext>
      </ChartSelectionContext>
    </ChartReadoutContext>
  );
}

Object.assign(RootContexts, { displayName: "Chart.RootContexts" });
Object.assign(ChartOwnScope, { displayName: "Chart.OwnScope" });
