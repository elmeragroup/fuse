"use client";

import type { ReactElement } from "react";

import type { ChartLayerProps, ValueFormat, XFormat } from "./chart-types";

/**
 * Props for `Chart.XAxis`, a closed part.
 *
 * @beta
 */
export type ChartXAxisProps = ChartLayerProps & {
  /** The tick label format. The interval's tick preset is the default. */
  format?: XFormat;
  /** The axis title. */
  label?: string;
  /** The tick mark. "none" by default. */
  tick?: "none" | "dot";
};

/**
 * Props for `Chart.YAxis`, a closed part.
 *
 * @beta
 */
export type ChartYAxisProps = ChartLayerProps & {
  /**
   * The tick label format. The layout's first series' `format` is the default. Tick labels keep the
   * format's unit, such as `2 kWh` and `142 øre/kWh`, and leave out a price's VAT basis, which the
   * tooltip and the table print. `label` adds an axis title.
   */
  format?: ValueFormat;
  /** The axis title. */
  label?: string;
  /**
   * "start" draws the axis at the left edge, or at the bottom under `orientation="horizontal"`.
   * "end" draws it at the opposite edge. "start" by default.
   */
  side?: "start" | "end";
};

/**
 * The `xKey` axis in both orientations. It draws at the bottom, or at the left edge under
 * `orientation="horizontal"`. Labels never rotate. When long labels do not fit, the axis shows fewer.
 *
 * @beta
 */
export function ChartXAxis(_props: ChartXAxisProps): ReactElement {
  return <></>;
}

/**
 * The value axis in both orientations, with d3 nice ticks.
 *
 * @beta
 */
export function ChartYAxis(_props: ChartYAxisProps): ReactElement {
  return <></>;
}

Object.assign(ChartXAxis, { displayName: "Chart.XAxis" });
Object.assign(ChartYAxis, { displayName: "Chart.YAxis" });
