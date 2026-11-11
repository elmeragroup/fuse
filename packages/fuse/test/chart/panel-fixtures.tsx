/**
 * The composed-Panel fixture the Panel browser suites share: the fall-back day under two Panels.
 */
import type { ReactNode } from "react";

import { Chart } from "../../src/components/chart/chart-namespace";
import type { ChartConfig } from "../../src/components/chart/chart-types";
import { LocaleProvider } from "../../src/intl/locale-context";

/** Midnight in Oslo on 2025-10-26, under summer time, UTC+2. */
const DAY_START = Date.UTC(2025, 9, 25, 22);
export const QUARTER = 15 * 60 * 1000;

export type DayRow = { readonly start: Date; readonly price: number; readonly kwh?: number };

/**
 * The fall-back day's 100 quarters. Quarter q's price is (q mod 4) / 4, and hour k's consumption,
 * written on its :00 quarter alone, is (k mod 5) + 1, scaled by `scale`.
 *
 * @param scale - The factor on every hour's consumption.
 * @returns The rows.
 */
export function day(scale = 1): DayRow[] {
  return Array.from({ length: 100 }, (_, q): DayRow => {
    const row = { start: new Date(DAY_START + q * QUARTER), price: (q % 4) / 4 };
    return q % 4 === 0 ? { ...row, kwh: (((q / 4) % 5) + 1) * scale } : row;
  });
}

const COMPOSED_CONFIG = {
  kwh: { label: "Forbruk", color: "chart-1", interval: "hour", format: { preset: "energy", unit: "kWh" } },
  price: { label: "Pris", color: "chart-2" },
} as const satisfies ChartConfig;

/** Two Panels with no axes, so each plot is the whole 400 px row, 200 px tall. */
export function Composed({
  data = day(),
  width = 400,
  top,
  bottom,
}: {
  readonly data?: readonly DayRow[];
  readonly width?: number;
  readonly top?: ReactNode;
  readonly bottom?: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width }}>
        <button type="button">før</button>
        <Chart.Root
          data={data}
          config={COMPOSED_CONFIG}
          xKey="start"
          interval="quarter-hour"
          timeZone="Europe/Oslo"
          data-intro="none"
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Forbruk og pris">
          <Chart.Panel series={["kwh"]} yInclude={[5]}>
            <Chart.Bar dataKey="kwh" />
            {top}
          </Chart.Panel>
          <Chart.Panel series={["price"]} yInclude={[1]}>
            <Chart.Line dataKey="price" curve="linear" />
            {bottom}
          </Chart.Panel>
          <Chart.Table />
        </Chart.Root>
        <button type="button">etter</button>
      </div>
    </LocaleProvider>
  );
}
