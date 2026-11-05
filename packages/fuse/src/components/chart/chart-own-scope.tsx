"use client";

/**
 * The scope every chart Root starts, cartesian and polar alike. It lives in a light leaf, so a polar
 * Root takes it without importing the cartesian Root.
 */
import type { ReactElement, ReactNode } from "react";

import {
  ChartCrosshairContext,
  ChartDatumContext,
  ChartHeadlineContext,
  ChartLegendSideContext,
  ChartLiveContext,
  ChartRowContext,
} from "./chart-readout";

/**
 * A Root starts its own scope, so an outer chart's row, legend side, Tooltip, Headline, Crosshair,
 * Marker or ActiveValueLine never reaches a part of this one, such as a sparkline in a legend item
 * or a pie in a tooltip. This chart's own Tooltip, Headline, Crosshair, Marker and ActiveValueLine
 * set theirs again for their children, and the Root provides its own readout and selection inside
 * it. A BarGroup's and a Table row's contexts stay out, because a Root can't sit in a BarGroup's
 * aria-hidden plot layer or inside a table row.
 *
 * @param props - The Root's tree.
 * @returns The tree in a scope of its own.
 */
export function ChartOwnScope({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <ChartRowContext value={null}>
      <ChartLegendSideContext value={null}>
        <ChartLiveContext value={false}>
          <ChartHeadlineContext value={false}>
            <ChartCrosshairContext value={false}>
              <ChartDatumContext value={null}>{children}</ChartDatumContext>
            </ChartCrosshairContext>
          </ChartHeadlineContext>
        </ChartLiveContext>
      </ChartLegendSideContext>
    </ChartRowContext>
  );
}

Object.assign(ChartOwnScope, { displayName: "Chart.OwnScope" });
