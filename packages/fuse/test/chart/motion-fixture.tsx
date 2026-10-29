/**
 * E11's motion fixture, written by hand: two stacked daily series, p under q. Data A covers 1 to
 * 10 October 2025, update B covers 2 to 11 October with new values on 4 and 7 October, and update
 * C covers 1 to 9 November. `.scratch/charts-v1/tools/l05-oracles/motion_fixture.py` holds the same
 * values and writes the expected geometry to `motion-frames.json`, and a test checks both agree.
 */
import type { ReactNode } from "react";

import { Chart } from "../../src/components/chart/chart-namespace";
import type { ChartConfig } from "../../src/components/chart/chart-types";
import { LocaleProvider } from "../../src/intl/locale-context";

/** One fixture row. */
export type MotionRow = { readonly day: Date; readonly p: number; readonly q: number };

/** Oslo midnight of a day in October or November 2025, in summer time up to 26 October. */
export function oslo(month: 10 | 11, date: number): Date {
  return new Date(Date.UTC(2025, month - 1, date, month === 10 && date <= 26 ? -2 : -1));
}

function rows(
  month: 10 | 11,
  values: readonly (readonly [day: number, p: number, q: number])[]
): MotionRow[] {
  return values.map(([date, p, q]) => ({ day: oslo(month, date), p, q }));
}

export const MOTION_A = rows(10, [
  [1, 4, 2],
  [2, 6, 3],
  [3, 5, 2],
  [4, 7, 4],
  [5, 3, 2],
  [6, 6, 3],
  [7, 8, 3],
  [8, 5, 2],
  [9, 4, 3],
  [10, 6, 2],
]);

export const MOTION_B = rows(10, [
  [2, 6, 3],
  [3, 5, 2],
  [4, 5, 3],
  [5, 3, 2],
  [6, 6, 3],
  [7, 7, 4],
  [8, 5, 2],
  [9, 4, 3],
  [10, 6, 2],
  [11, 5, 2],
]);

export const MOTION_C = rows(11, [
  [1, 8, 4],
  [2, 10, 5],
  [3, 9, 3],
  [4, 12, 6],
  [5, 7, 4],
  [6, 9, 5],
  [7, 11, 5],
  [8, 10, 4],
  [9, 8, 3],
]);

export const MOTION_CONFIG = {
  p: { label: "Grunnlast", color: "chart-1", stack: "day", format: { preset: "energy", unit: "kWh" } },
  q: { label: "Topp", color: "chart-2", stack: "day", format: { preset: "energy", unit: "kWh" } },
} as const satisfies ChartConfig;

/**
 * The fixture as a daily stacked bar chart in Oslo, 400 px wide with no axes, so the plot is the
 * whole frame width.
 *
 * @param props - The rows, an optional controlled window and extra parts.
 * @returns The chart.
 */
export function MotionChart({
  data,
  xRange,
  children,
}: {
  readonly data: readonly MotionRow[];
  readonly xRange?: readonly [Date, Date];
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <Chart.Root
          data={data}
          config={MOTION_CONFIG}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          xRange={xRange}
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="p" />
          <Chart.Bar dataKey="q" />
          {children}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}
