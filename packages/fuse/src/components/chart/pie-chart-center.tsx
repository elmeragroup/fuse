"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartLayerProps, ChartFractionDigits, ValueFormat } from "./chart-types";

/**
 * Props for `PieChart.Track`, a closed part.
 *
 * @beta
 */
export type PieChartTrackProps = ChartLayerProps;

/**
 * Props for `PieChart.Center`, a closed part.
 *
 * @beta
 */
export type PieChartCenterProps = ChartLayerProps & {
  /** The centre's content, such as `CenterValue` over a `CenterLabel`. */
  children?: ReactNode;
};

/**
 * Props for `PieChart.CenterValue`, a closed part.
 *
 * @beta
 */
export type PieChartCenterValueProps = ChartLayerProps & {
  /** The value format. The category's config `format`, then Root's `valueFormat`, is the default. */
  format?: ValueFormat;
};

/**
 * Props for `PieChart.CenterShare`, a closed part.
 *
 * @beta
 */
export type PieChartCenterShareProps = ChartLayerProps & {
  /** The percentage digits. */
  format?: ChartFractionDigits;
};

/**
 * Props for `PieChart.CenterMax`, a closed part.
 *
 * @beta
 */
export type PieChartCenterMaxProps = ChartLayerProps & {
  /** The maximum's format. The value's format is the default. */
  format?: ValueFormat;
};

/**
 * Props for `PieChart.CenterLabel`, a closed part.
 *
 * @beta
 */
export type PieChartCenterLabelProps = ChartLayerProps & {
  /** The label text, such as "av" between the value and the maximum. */
  children?: ReactNode;
};

/**
 * The unfilled sweep behind a gauge or behind each ring.
 *
 * @beta
 */
export function PieChartTrack(_props: PieChartTrackProps): ReactElement {
  return <></>;
}

/**
 * The text in the hole of a donut, a gauge or a radial chart.
 *
 * @beta
 */
export function PieChartCenter(_props: PieChartCenterProps): ReactElement {
  return <></>;
}

/**
 * The active slice's or ring's value. With nothing active, the total, or nothing when the
 * categories' formats differ, because a sum of kWh and kr means nothing.
 *
 * @beta
 */
export function PieChartCenterValue(_props: PieChartCenterValueProps): ReactElement {
  return <></>;
}

/**
 * The active slice's or ring's share as a percentage, a slice over the absolute total of the
 * slices and a ring over its own maximum. With nothing active, a gauge pie prints its total over
 * `max`, and a radial chart prints the sum of its values over the sum of its maxima when every ring
 * shares one format. Otherwise it renders an empty element, so surrounding text still lays out.
 * A slice's share prints the number the pie's labels and legend print, because the slices' shares
 * round together and sum to 100 %. A ring's share against its own maximum rounds alone.
 *
 * @beta
 */
export function PieChartCenterShare(_props: PieChartCenterShareProps): ReactElement {
  return <></>;
}

/**
 * The maximum the value fills, which is a gauge pie's `max` or the active ring's `max` or `maxKey`
 * value. With nothing active, a radial chart prints the sum of its maxima when every ring shares
 * one format. It renders an empty element without a maximum. A maximum is a value, not a share, so
 * it prints through the value format and never rounds with a share set. `CenterValue`, a `CenterLabel`
 * reading "av" and `CenterMax` give "3,9 av 5 kWh".
 *
 * @beta
 */
export function PieChartCenterMax(_props: PieChartCenterMaxProps): ReactElement {
  return <></>;
}

/**
 * A text line in the centre.
 *
 * @beta
 */
export function PieChartCenterLabel(_props: PieChartCenterLabelProps): ReactElement {
  return <></>;
}

Object.assign(PieChartTrack, { displayName: "PieChart.Track" });
Object.assign(PieChartCenter, { displayName: "PieChart.Center" });
Object.assign(PieChartCenterValue, { displayName: "PieChart.CenterValue" });
Object.assign(PieChartCenterShare, { displayName: "PieChart.CenterShare" });
Object.assign(PieChartCenterMax, { displayName: "PieChart.CenterMax" });
Object.assign(PieChartCenterLabel, { displayName: "PieChart.CenterLabel" });
