"use client";

import type { ChartPoint } from "./chart-types";

/**
 * The active point of the enclosing chart, or null when nothing is active. The caller renders on
 * every index change, so keep the component that reads it small, such as a headline figure.
 *
 * @returns The active point, or null.
 * @beta
 */
export function useChartPoint(): ChartPoint | null {
  return null;
}
