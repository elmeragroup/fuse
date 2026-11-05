"use client";

import { useActiveIndex, useChartReadout } from "./chart-readout";
import { useChartStore } from "./chart-store";
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
  const active = useActiveIndex(readout, true);
  const near = useChartStore(readout.store, (snapshot) => snapshot.near);
  return active === null ? null : readout.point(active, near);
}
