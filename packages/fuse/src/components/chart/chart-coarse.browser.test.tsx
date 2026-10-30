// Coarse series in Chromium, after ticket svg-3's checks. Unit under test: a series whose interval
// is coarser than Root's, from its own slots to the drawn steps, bars, emphasis, time state and
// motion. Oracles: pixels worked out by hand on quarter-hour grids, where an hour covers 4
// quarters, and the eased progress of motion-frames.json.
import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { installFrameClock } from "../../../test/chart/frame-clock";
import type { FrameClock } from "../../../test/chart/frame-clock";
import { easedAt, lineVertices, plotOf } from "../../../test/chart/panel-readers";
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

  it("runs each hour's step across its 4 quarters (W4, B1-4)", async () => {
    // Eight quarters of 50 px on 400 px: hour 0 at 1 runs 0 to 200 at y = 150 on [0, 4] over
    // 200 px, and hour 1 at 2 runs 200 to 400 at y = 100, with the riser at 200.
    const { host } = renderThemed(
      <Hourly data={quarters(8, [1, 2])}>
        <Chart.Line dataKey="kwh" curve="step-after" />
      </Hourly>
    );
    const d = () =>
      // DOM audit: the line is aria-hidden plot output, so its slot is the only locator.
      host
        .querySelector('[data-slot="chart-line"][data-part="solid"]:not([data-outgoing] *)')
        ?.getAttribute("d");
    await expect.poll(d).toBe("M0,150L200,150L200,100L400,100");
  });

  it("emphasises the hour an explicit quarter names, and marks two quarters of one hour once (W6, Q1-5)", async () => {
    // 00:15 lies in hour 0, which draws one bar from quarter 0, so that bar takes the emphasis.
    // The Marker's 00:15 and 00:30 both fall in hour 0, so it draws one dot.
    const { host } = renderThemed(
      <Hourly data={quarters(8, [1, 2])}>
        <Chart.Bar dataKey="kwh" emphasis={{ x: quarterAt(1) }} />
        <Chart.Marker dataKey="kwh" at={{ x: [quarterAt(1), quarterAt(2)] }} />
      </Hourly>
    );
    // DOM audit: bars and marker dots are aria-hidden plot output, so their slots locate them.
    const bars = () =>
      [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) => bar.hasAttribute("data-emphasis"));
    await expect.poll(bars).toEqual([true, false]);
    expect(host.querySelectorAll('[data-slot="chart-marker"] [data-slot="chart-dot"]')).toHaveLength(1);
  });

  it("dates an hour's bar by the hour's own end, past the domain's last quarter (W3, B1-3)", async () => {
    // The domain holds 00:00 and 00:15. With now at 00:45, hour 0 runs to 01:00 and holds now.
    const { host } = renderThemed(
      <Hourly data={quarters(2, [1])} now={quarterAt(3)}>
        <Chart.Bar dataKey="kwh" />
      </Hourly>
    );
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    await expect
      .poll(() => host.querySelector('[data-slot="chart-bar"]')?.getAttribute("data-time"))
      .toBe("current");
  });
});

describe("a coarse path's motion on a time axis under Panels (W5)", () => {
  const QUARTER = 15 * 60 * 1000;
  /** Oslo midnight on 1 October 2025, under summer time. */
  const MIDNIGHT = Date.UTC(2025, 8, 30, 22);
  type Hour = { readonly start: Date; readonly kwh?: number; readonly avg?: number };

  /** Quarters from `from`, with each hour's usage and average on its first quarter. */
  function hours(from: number, values: readonly number[]): Hour[] {
    return Array.from({ length: values.length * 4 }, (_, index): Hour => {
      const value = values[index / 4];
      const start = new Date(from + index * QUARTER);
      return index % 4 === 0 && value !== undefined ? { start, kwh: value, avg: value } : { start };
    });
  }

  /**
   * Usage bars over an average line, both hourly, on a 480 px quarter-hour grid, each Panel on a
   * domain of [0, 8] that no update moves, so an update that adds a bar moves the marks.
   */
  function Hours({ data }: { readonly data: readonly Hour[] }): ReactNode {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 480 }}>
          <Chart.Root
            data={data}
            config={{
              kwh: { label: "Forbruk", color: "chart-1", interval: "hour" },
              avg: { label: "Snitt", color: "chart-2", interval: "hour" },
            }}
            xKey="start"
            interval="quarter-hour"
            timeZone="Europe/Oslo"
            data-intro="none"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Forbruk og snitt">
            <Chart.Panel series={["kwh"]} yInclude={[8]}>
              <Chart.Bar dataKey="kwh" />
            </Chart.Panel>
            <Chart.Panel series={["avg"]} yInclude={[8]}>
              <Chart.Line dataKey="avg" curve="linear" />
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The usage bars' spans along x. */
  function barSpans(host: HTMLElement): (readonly [number, number])[] {
    const plot = plotOf(host, 0);
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    return [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) => {
      const box = bar.getBoundingClientRect();
      return [box.left - plot.left, box.right - plot.left] as const;
    });
  }

  it("slides three hours by one hour, every vertex 160 px on one clock, and rests on the new hours", async () => {
    // 12 quarters of 40 px: hour k's centre lies at 160k + 80, so the line's vertices rest at 80,
    // 240 and 400 (each on the 1 px column from its centre, at 80.5, 240.5 and 400.5), and hour
    // k's bar runs 160k + 20 to 160k + 140. The window moves one hour: hour 0 leaves to -80, hours
    // 1 and 2 move left by 160, and hour 3 arrives from 560 to 400, each 160 px times the progress.
    clock = installFrameClock();
    const { host, rerender } = renderThemed(<Hours data={hours(MIDNIGHT, [1, 2, 3])} />);
    await expect
      .poll(() => barSpans(host))
      .toEqual([
        [20, 140],
        [180, 300],
        [340, 460],
      ]);
    rerender(<Hours data={hours(MIDNIGHT + 4 * QUARTER, [2, 3, 4])} />);
    const start = clock.now();
    clock.frameAt(start + 240);
    const moved = 160 * easedAt(240);
    const xs = lineVertices(host).map(([x]) => x);
    [80 - moved, 240 - moved, 400 - moved, 560 - moved].forEach((expected, index) => {
      expect(Math.abs((xs[index] ?? Number.NaN) - expected), `vertex ${String(index)}`).toBeLessThanOrEqual(
        1
      );
    });
    clock.frameAt(start + 600);
    // On [0, 8] over 200 px, 2, 3 and 4 draw at 150, 125 and 100.
    expect(lineVertices(host)).toEqual([
      [80.5, 150],
      [240.5, 125],
      [400.5, 100],
    ]);
    expect(barSpans(host)).toEqual([
      [20, 140],
      [180, 300],
      [340, 460],
    ]);
  });

  it("grows a fourth hour out of the last hour when the next day shares no slot", async () => {
    // The next day has 16 quarters of 30 px, so its hours centre at 60, 180, 300 and 420. The
    // fourth hour grows from the old last vertex, at 400 and 3, y = 125, toward 420 and 7, y = 25.
    clock = installFrameClock();
    const { host, rerender } = renderThemed(<Hours data={hours(MIDNIGHT, [1, 2, 3])} />);
    await expect.poll(() => barSpans(host)).toHaveLength(3);
    rerender(<Hours data={hours(MIDNIGHT + 96 * QUARTER, [4, 5, 6, 7])} />);
    const start = clock.now();
    clock.frameAt(start + 240);
    const eased = easedAt(240);
    const [x, y] = lineVertices(host)[3] ?? [Number.NaN, Number.NaN];
    expect(Math.abs(x - (400 + 20 * eased))).toBeLessThanOrEqual(1);
    expect(Math.abs(y - (125 - 100 * eased))).toBeLessThanOrEqual(1);
    clock.frameAt(start + 600);
    expect(barSpans(host)).toEqual([
      [15, 105],
      [135, 225],
      [255, 345],
      [375, 465],
    ]);
  });
});

describe("window aggregates over a coarse series (X2, B2-1)", () => {
  it("counts an hourly reading once in the legend's shares", async () => {
    // Four quarters: p reads 1 on each, 4 in all, and the hourly kwh reads 4 once for the hour.
    // Each total is 4, so each share is 50 %, though kwh's 4 is held at all four quarters.
    const midnight = Date.UTC(2025, 8, 30, 22);
    const rows = Array.from({ length: 4 }, (_, index): { start: Date; p: number; kwh?: number } => {
      const row = { start: new Date(midnight + index * 15 * 60_000), p: 1 };
      return index === 0 ? { ...row, kwh: 4 } : row;
    });
    const { host } = renderThemed(
      <LocaleProvider locale="en-US">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={rows}
            config={{
              p: { label: "P", color: "chart-1" },
              kwh: { label: "Usage", color: "chart-2", interval: "hour" },
            }}
            xKey="start"
            interval="quarter-hour"
            timeZone="Europe/Oslo"
            aria-label="Shares">
            <Chart.LegendShare dataKey="p" />
            <Chart.LegendShare dataKey="kwh" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the shares are text parts located by their slot.
    const shares = () =>
      [...host.querySelectorAll('[data-slot="chart-legend-share"]')].map((share) => share.textContent);
    await expect.poll(shares).toEqual(["50%", "50%"]);
  });
});

describe("the past fade of path-form hourly bars (X6, B2-4)", () => {
  // 104 quarters of 1 October 2025 in Oslo, just above the path form's 100 slots, on 416 px with no
  // axes, so each quarter is 4 px and each hour 16 px. Hourly usage reads 1 on each hour's first
  // quarter. An hour is past only once it ends, so the dimmed span ends on a whole hour.
  const midnight = Date.UTC(2025, 8, 30, 22);
  const rows = Array.from({ length: 104 }, (_, index): { start: Date; kwh?: number } => {
    const start = new Date(midnight + index * 15 * 60_000);
    return index % 4 === 0 ? { start, kwh: 1 } : { start };
  });

  function Faded({ now }: { readonly now: Date }): ReactNode {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 416 }}>
          <Chart.Root
            data={rows}
            config={{ kwh: { label: "Forbruk", color: "chart-1", interval: "hour" } }}
            xKey="start"
            interval="quarter-hour"
            timeZone="Europe/Oslo"
            now={now}
            data-fade="past"
            data-intro="none"
            aria-label="Forbruk per time">
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The width the past mask dims, from the plot's start. */
  function pastWidth(host: HTMLElement): number {
    // DOM audit: the past mask is an aria-hidden paint server; its first rect spans the past.
    return Number(host.querySelector('mask[id$="-past"] > rect')?.getAttribute("width"));
  }

  it("dims nothing at 00:30, while hour 0 runs to 01:00", async () => {
    const { host } = renderThemed(<Faded now={new Date(midnight + 30 * 60_000)} />);
    await expect.poll(() => pastWidth(host)).toBe(0);
  });

  it("dims hour 0's 16 px at 01:30, not the 6 quarters that have ended", async () => {
    const { host } = renderThemed(<Faded now={new Date(midnight + 90 * 60_000)} />);
    await expect.poll(() => pastWidth(host)).toBe(16);
  });
});
