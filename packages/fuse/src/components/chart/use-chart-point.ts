"use client";

import { useActivePoint } from "./chart-active-point";
import { useChartReadout } from "./chart-readout";
import type { ChartPoint } from "./chart-types";

/**
 * The active point of the enclosing chart, or null when nothing is active. The caller renders on
 * every index change, so keep the component that reads it small, such as a headline figure. A
 * pending reading reports null with no quality, and a missing one reports null with `"missing"`.
 *
 * @returns The active point, or null.
 * @throws When no `Chart.Root` encloses the caller, as `part-outside-root`.
 * @beta
 */
export function useChartPoint(): ChartPoint | null {
  const readout = useChartReadout("useChartPoint");
  const { index, near } = useActivePoint(readout, true);
  return index === null ? null : readout.point(index, near);
}
