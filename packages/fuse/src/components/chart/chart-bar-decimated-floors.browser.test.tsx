// The stack floors of decimated path-form columns and of the active overlay that reads them, in
// Chromium. Unit under test: the path form from the model to the drawn columns and the active overlay,
// through the bucket decimation, the plot frame's pixel floor and the stack floors' settlement.
// Oracles, none computed by the code under test: the active overlay draws its bucket's drawn column
// through a tween, a regroup and a sign change; columns of different series never share a pixel
// unless their plain readings do; and a floor on one side of the zero rule never lands on the other
// side's standing floor.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  activateFirst,
  activeOverlay,
  expectApart,
  SERIAL,
  seriesColumns,
  shownColumns,
  turnsIn,
} from "../../../test/chart/floor-charts";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { barLayerBox } from "../../../test/chart/marks";
import { emulatePixelRatio } from "../../../test/page-metrics";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

describe("decimated columns' stack floors and their readers", () => {
  it("gives a decimated window's active overlay its bucket column's floor in every frame", async () => {
    // 2,500 categories stack a = 1 and b = 1, 0.21 CSS px each on 0..1,200 over 256 px, and b falls
    // to 0. The first category is active, and its overlay draws a's geometry: in the first bucket
    // every slot reads alike, so the overlay draws what a's first column draws, floor and all.
    const config = {
      a: { label: "A", color: "chart-1", stack: "s" },
      b: { label: "B", color: "chart-2", stack: "s" },
    } as const satisfies ChartConfig;
    const chart = (b: number) => (
      <LocaleProvider locale="en-US">
        <div style={{ width: 1000 }}>
          <Chart.Root
            data-intro="none"
            data={Array.from({ length: 2500 }, (_, slot) => ({ day: `c${String(slot)}`, a: 1, b }))}
            config={config}
            xKey="day"
            yInclude={[1200]}
            style={{ "--chart-plot-height": "256px", "--chart-bar-seam": "0px" }}
            aria-label="Decimated">
            <Chart.Bar dataKey="a" />
            <Chart.Bar dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await emulatePixelRatio(1);
    const clock = installFrameClock();
    const { host, rerender, unmount } = renderThemed(chart(1));
    try {
      // DOM audit: the plot's single tab stop is the listbox's option.
      await activateFirst(host);
      const start = clock.now();
      rerender(chart(0));
      for (let time = 0; time <= 300; time += 20) {
        clock.frameAt(start + time);
        const column = seriesColumns(host, 0)[0] ?? { y: 0, height: 0 };
        const overlay = activeOverlay(host, 0);
        const what = `${String(time)} ms: column ${String(column.y)}+${String(column.height)}, overlay ${String(overlay.y)}+${String(overlay.height)}`;
        expect(overlay.height, what).toBeCloseTo(column.height, 6);
        if (column.height > SERIAL) expect(overlay.y, what).toBeCloseTo(column.y, 6);
      }
    } finally {
      unmount();
      clock.restore();
    }
  });

  it("never floors two series on one pixel while a slide regroups decimated buckets", async () => {
    // 2,500 categories stack a and b: c0 reads (1, 0), c1 (0, 1) and every other (0.001, 0.001),
    // all far under a device pixel on 0..1,200 over 256 px, so every pixel either series draws is
    // a floor. c0 to c2499 becomes c1 to c2500, a slide by a fifth of a bucket, so the old and the
    // new buckets' columns share pixels mid-tween. Each pixel takes one floor at most.
    const config = {
      a: { label: "A", color: "chart-1", stack: "s" },
      b: { label: "B", color: "chart-2", stack: "s" },
    } as const satisfies ChartConfig;
    const rows = (shift: number) =>
      Array.from({ length: 2500 }, (_, index) => {
        const slot = index + shift;
        return {
          day: `c${String(slot)}`,
          a: slot === 0 ? 1 : slot === 1 ? 0 : 0.001,
          b: slot === 0 ? 0 : slot === 1 ? 1 : 0.001,
        };
      });
    const chart = (shift: number) => (
      <LocaleProvider locale="en-US">
        <div style={{ width: 1000 }}>
          <Chart.Root
            data-intro="none"
            data={rows(shift)}
            config={config}
            xKey="day"
            yInclude={[1200]}
            style={{ "--chart-plot-height": "256px", "--chart-bar-seam": "0px" }}
            aria-label="Regroup">
            <Chart.Bar dataKey="a" />
            <Chart.Bar dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await emulatePixelRatio(1);
    const clock = installFrameClock();
    const { host, rerender, unmount } = renderThemed(chart(0));
    const columns = (series: number) => shownColumns(host, series);
    try {
      // Zero lies where no rounding turn falls within the 0.43 px the stacks reach, so no column
      // covers a pixel on its own: every drawn pixel is a floor.
      const page = barLayerBox(host).top + 256;
      expect(turnsIn(1, page, page - 0.43)).toBe(false);
      const start = clock.now();
      rerender(chart(1));
      let drawn = 0;
      for (let time = 20; time <= 460; time += 20) {
        clock.frameAt(start + time);
        const [a, b] = [columns(0), columns(1)];
        drawn += a.length + b.length;
        expectApart(a, b, `${String(time)} ms: a and b`);
      }
      expect(drawn).toBeGreaterThan(0);
    } finally {
      unmount();
      clock.restore();
    }
  });

  for (const [domain, height] of [
    [1000, 200],
    [1200, 256],
  ] as const) {
    it(`keeps a decimated overlay on its column while its reading turns over (${String(height)} px)`, async () => {
      // 2,500 identical categories stack a = 1 and b = 1, and a turns to -1, far under a device
      // pixel on -domain..domain. The first category is active. Its overlay draws a's geometry on
      // the side a's drawn tip lies in each frame, so every pixel it draws is one a's own columns
      // over the first bucket draw too.
      const config = {
        a: { label: "A", color: "chart-1", stack: "s" },
        b: { label: "B", color: "chart-2", stack: "s" },
      } as const satisfies ChartConfig;
      const chart = (a: number) => (
        <LocaleProvider locale="en-US">
          <div style={{ width: 1000 }}>
            <Chart.Root
              data-intro="none"
              data={Array.from({ length: 2500 }, (_, slot) => ({ day: `c${String(slot)}`, a, b: 1 }))}
              config={config}
              xKey="day"
              yInclude={[-domain, domain]}
              style={{ "--chart-plot-height": `${String(height)}px`, "--chart-bar-seam": "0px" }}
              aria-label="Turn">
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      await emulatePixelRatio(1);
      const clock = installFrameClock();
      const { host, rerender, unmount } = renderThemed(chart(1));
      try {
        // DOM audit: the plot's single tab stop is the listbox's option.
        await activateFirst(host);
        const start = clock.now();
        rerender(chart(-1));
        let floored = 0;
        for (let time = 0; time <= 600; time += 20) {
          clock.frameAt(start + time);
          const overlay = activeOverlay(host, 0);
          if (overlay.height <= SERIAL) continue;
          floored += 1;
          const columns = seriesColumns(host, 0, "every");
          const under = columns.filter(
            ({ x, y, width, height }) =>
              x <= overlay.x + SERIAL &&
              x + width >= overlay.x + overlay.width - SERIAL &&
              y <= overlay.y + SERIAL &&
              y + height >= overlay.y + overlay.height - SERIAL
          );
          expect(
            under.length,
            `${String(time)} ms: overlay ${JSON.stringify(overlay)} over a's ${JSON.stringify(columns.filter(({ x }) => x < overlay.x + overlay.width + 2))}`
          ).toBeGreaterThan(0);
        }
        // Once a turns over it owns the negative side, so its overlay draws the floor there.
        expect(floored).toBeGreaterThan(0);
      } finally {
        unmount();
        clock.restore();
      }
    });
  }

  it("never lets floors on either side of zero share a pixel while a decimated window slides (B7-1)", async () => {
    // Three stacked series over 2,500 categories on -1,000..1,000, 0.1 CSS px a unit, on a 120 x 200
    // plot at 1.5x, 0.3 px in from the left. Every reading is null but a few, and the window slides
    // by one category: the columns above and below zero arrive and leave in different buckets.
    const config = {
      a: { label: "A", color: "chart-1", stack: "s" },
      b: { label: "B", color: "chart-2", stack: "s" },
      c: { label: "C", color: "chart-3", stack: "s" },
    } as const satisfies ChartConfig;
    type Reading = { readonly a?: number; readonly b?: number; readonly c?: number };
    const before = new Map<number, Reading>([
      [7, { a: -20, c: -1 }],
      [8, { c: 0 }],
      [9, { c: 0 }],
      [10, { c: 1 }],
      [14, { a: -11, b: -1 }],
    ]);
    const after = new Map<number, Reading>([
      [7, { c: 1 }],
      [10, { b: -1 }],
    ]);
    const rows = (shift: number, readings: ReadonlyMap<number, Reading>) =>
      Array.from({ length: 2500 }, (_, index) => {
        const slot = index + shift;
        const own = readings.get(slot) ?? {};
        return { day: `c${String(slot)}`, a: own.a ?? null, b: own.b ?? null, c: own.c ?? null };
      });
    const chart = (shift: number, readings: ReadonlyMap<number, Reading>) => (
      <LocaleProvider locale="en-US">
        <div style={{ width: 120, paddingLeft: 0.3 }}>
          <Chart.Root
            data-intro="none"
            data={rows(shift, readings)}
            config={config}
            xKey="day"
            yInclude={[-1000, 1000]}
            style={{ "--chart-plot-height": "200px", "--chart-bar-seam": "0px" }}
            aria-label="Slide">
            <Chart.Bar dataKey="a" />
            <Chart.Bar dataKey="b" />
            <Chart.Bar dataKey="c" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await emulatePixelRatio(1.5);
    const clock = installFrameClock();
    const { host, rerender, unmount } = renderThemed(chart(0, before));
    const columns = (series: number) => shownColumns(host, series);
    try {
      const start = clock.now();
      rerender(chart(1, after));
      for (let time = 8; time <= 480; time += 8) {
        clock.frameAt(start + time);
        const [b, c] = [columns(1), columns(2)];
        expectApart(b, c, `${String(time)} ms: b and c`);
      }
    } finally {
      unmount();
      clock.restore();
    }
  });
});
