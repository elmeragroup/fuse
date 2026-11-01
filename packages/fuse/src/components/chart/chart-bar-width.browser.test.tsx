// One width for every bar of a series, in Chromium at 1x and 2x. Unit under test: the element
// form's bars from the model to each polygon's points, for the 96 quarter-hour bars of the bar
// chart page's price demos, at rest and in a tween frame. Oracle: widths and gaps worked by hand.
// A 460 px plot over 96 slots gives each slot 460 / 96 = 4.79 px, and the 25 % band gap leaves
// each bar 3.59 px. Rounded down to whole device pixels, that is 3 px at 1x and 7 device pixels,
// 3.5 px, at 2x. The bars' starts lie 4.79 px apart, 4 or 5 device pixels at 1x and 9 or 10 at
// 2x, so a gap is 1 or 2 px at 1x and 1 or 1.5 px at 2x. Over 80 slots a slot is 5.75 px and its
// bar 4.31 px, which rounds down to 4 px at both ratios.
import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import "../../../dist/styles.css";
import { drawnRect } from "../../../test/chart/bar-box";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { bars } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

type MetricsCdp = {
  send: ((
    method: "Emulation.setDeviceMetricsOverride",
    params: { width: number; height: number; deviceScaleFactor: number; mobile: boolean }
  ) => Promise<void>) &
    ((method: "Emulation.clearDeviceMetricsOverride") => Promise<void>);
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): MetricsCdp => cdp() as MetricsCdp;

afterEach(async () => {
  await session().send("Emulation.clearDeviceMetricsOverride");
});

/**
 * Each pixel ratio, the width worked by hand for 96 bars and the gaps between them, and the width
 * for 80 bars.
 */
const CASES = [
  { dpr: 1, width: 3, gaps: [1, 2], fewer: 4 },
  { dpr: 2, width: 3.5, gaps: [1, 1.5], fewer: 4 },
] as const;

/** A day's first quarters, a few below zero as the price demos' midday quarters are. */
function quarters(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `q${String(index)}`,
    price: index % 7 === 3 ? -0.1 : 0.2 + (index % 5) / 10,
  }));
}

function Quarters({
  orientation,
  count = 96,
}: {
  readonly orientation: "vertical" | "horizontal";
  readonly count?: number;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 460 }}>
        <Chart.Root
          data-intro="none"
          data={quarters(count)}
          config={{ price: { label: "Spotpris", color: "chart-1" } }}
          xKey="name"
          orientation={orientation}
          style={orientation === "horizontal" ? { "--chart-plot-height": "460px" } : undefined}
          aria-label="Spotpris per kvarter">
          <Chart.Bar dataKey="price" />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** Each bar's span along the slot axis, in CSS pixels of its layer, in slot order. */
function spans(host: HTMLElement, orientation: "vertical" | "horizontal"): (readonly [number, number])[] {
  return bars(host).map((bar) => {
    const rect = drawnRect(bar);
    return orientation === "vertical" ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height];
  });
}

/** The distinct values of a list to a millionth of a pixel, past the points' float error, ascending. */
function distinct(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value * 1e6) / 1e6))].toSorted((a, b) => a - b);
}

describe("one width for every bar of a series", () => {
  for (const orientation of ["vertical", "horizontal"] as const) {
    for (const { dpr, width, gaps } of CASES) {
      it(`draws 96 ${orientation} bars ${String(width)} px wide at ${String(dpr)}x, ${gaps.join(" or ")} px apart`, async () => {
        await session().send("Emulation.setDeviceMetricsOverride", {
          width: 1024,
          height: 1024,
          deviceScaleFactor: dpr,
          mobile: false,
        });
        const { host } = renderThemed(<Quarters orientation={orientation} />);
        await expect.poll(() => bars(host)).toHaveLength(96);
        const drawn = spans(host, orientation);
        expect(distinct(drawn.map(([start, end]) => end - start))).toEqual([width]);
        expect(distinct(drawn.slice(1).map(([start], k) => start - (drawn[k]?.[1] ?? 0)))).toEqual(gaps);
      });
    }
  }

  for (const { dpr, width, fewer } of CASES) {
    it(`keeps every bar one width at ${String(dpr)}x in each frame from 96 bars to 80`, async () => {
      await session().send("Emulation.setDeviceMetricsOverride", {
        width: 1024,
        height: 1024,
        deviceScaleFactor: dpr,
        mobile: false,
      });
      // The update drops the last 16 quarters, so each kept bar widens from its 96-slot width to
      // its 80-slot width. Every bar moves on one clock, so no frame may draw two widths, and a
      // frame's width lies between the two rests'.
      const clock = installFrameClock();
      try {
        const { host, rerender } = renderThemed(<Quarters orientation="vertical" />);
        await expect.poll(() => bars(host)).toHaveLength(96);
        const start = clock.now();
        rerender(<Quarters orientation="vertical" count={80} />);
        for (const ms of [60, 120, 240]) {
          clock.frameAt(start + ms);
          const widths = distinct(spans(host, "vertical").map(([from, to]) => to - from));
          expect(widths, `at ${String(ms)} ms`).toHaveLength(1);
          expect(widths[0], `at ${String(ms)} ms`).toBeGreaterThanOrEqual(width);
          expect(widths[0], `at ${String(ms)} ms`).toBeLessThanOrEqual(fewer);
        }
        clock.frameAt(start + 2000);
        expect(bars(host)).toHaveLength(80);
        expect(distinct(spans(host, "vertical").map(([from, to]) => to - from))).toEqual([fewer]);
      } finally {
        clock.restore();
      }
    });
  }
});
