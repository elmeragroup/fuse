// Coarse series in Chromium, after ticket svg-3's checks. Unit under test: a series whose interval
// is coarser than Root's, from its own slots to the drawn steps, bars, emphasis, time state and
// motion. Oracles: pixels worked out by hand on quarter-hour grids, where an hour covers 4
// quarters, and the eased progress of motion-frames.json.
import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import type { FrameClock } from "../../../test/chart/frame-clock";
import { bars as barsIn } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

let clock: FrameClock | null = null;

afterEach(() => {
  clock?.restore();
  clock = null;
});

describe("coarse series on a quarter-hour grid", () => {
  /** Oslo's 1 October 2025 starts at 22:00 UTC the day before, under summer time. */
  const quarterAt = (index: number) => new Date(Date.UTC(2025, 8, 30, 22, index * 15));
  type Quarter = { readonly start: Date; readonly kwh?: number };

  /** Quarters 0 to `count` - 1, with each hour's value on its first quarter. */
  function quarters(count: number, hours: readonly number[]): Quarter[] {
    return Array.from({ length: count }, (_, index): Quarter => {
      const value = hours[index / 4];
      return index % 4 === 0 && value !== undefined
        ? { start: quarterAt(index), kwh: value }
        : { start: quarterAt(index) };
    });
  }

  function Hourly({
    data,
    now,
    children,
  }: {
    readonly data: readonly Quarter[];
    readonly now?: Date;
    readonly children: ReactNode;
  }): ReactNode {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={data}
            config={{ kwh: { label: "Forbruk", color: "chart-1", interval: "hour" } }}
            xKey="start"
            interval="quarter-hour"
            timeZone="Europe/Oslo"
            yInclude={[4]}
            data-intro="none"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Forbruk per time"
            now={now}>
            {children}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("emphasises the hour an explicit quarter names, and marks two quarters of one hour once (W6, Q1-5)", async () => {
    // 00:15 lies in hour 0, which draws one bar from quarter 0, so that bar takes the emphasis.
    // The Marker's 00:15 and 00:30 both fall in hour 0, so it draws one dot.
    const { host } = renderThemed(
      <Hourly data={quarters(8, [1, 2])}>
        <Chart.Bar dataKey="kwh" emphasis={{ x: quarterAt(1) }} />
        <Chart.Marker dataKey="kwh" at={{ x: [quarterAt(1), quarterAt(2)] }} />
      </Hourly>
    );
    // Bars and marker dots are aria-hidden plot output, so their slots locate them.
    const bars = () => barsIn(host).map((bar) => bar.hasAttribute("data-emphasis"));
    await expect.poll(bars).toEqual([true, false]);
    expect(host.querySelectorAll('[data-slot="chart-marker"] [data-slot="chart-dot"]')).toHaveLength(1);
  });
});
