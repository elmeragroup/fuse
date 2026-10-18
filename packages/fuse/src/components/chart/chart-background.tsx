"use client";

import type { ReactElement } from "react";

import type { ChartBackgroundPattern, ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Background`, a closed part.
 *
 * @beta
 */
export type ChartBackgroundProps = ChartLayerProps & {
  /** The pattern drawn behind the marks. */
  variant?: ChartBackgroundPattern;
};

/**
 * A decorative pattern behind the marks.
 *
 * @beta
 */
export function ChartBackground(_props: ChartBackgroundProps): ReactElement {
  return <></>;
}

Object.assign(ChartBackground, { displayName: "Chart.Background" });
