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
  seriesColumns,
  shownColumns,
  stackChart,
  times,
  turnsIn,
  tweenFrames,
} from "../../../test/chart/floor-charts";
import { barLayerBox } from "../../../test/chart/marks";
import { SERIAL } from "../../../test/chart/world-model";
import { renderThemed } from "../../../test/themed-browser-render";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const AB = {
  a: { label: "A", color: "chart-1", stack: "s" },
  b: { label: "B", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

/** 2,500 categories, the decimated path form's, from c{shift} on, each category's readings by `row`. */
function categories(row: (slot: number) => Readonly<Record<string, number | null>>, shift = 0) {
  return Array.from({ length: 2500 }, (_, index) => {
    const slot = index + shift;
    return { day: `c${String(slot)}`, ...row(slot) };
  });
}

describe("decimated columns' stack floors and their readers", () => {
  it("gives a decimated window's active overlay its bucket column's floor in every frame", async () => {
    // 2,500 categories stack a = 1 and b = 1, 0.21 CSS px each on 0..1,200 over 256 px, and b falls
    // to 0. The first category is active, and its overlay draws a's geometry: in the first bucket
    // every slot reads alike, so the overlay draws what a's first column draws, floor and all.
    const chart = (b: number) =>
      stackChart({
        config: AB,
        data: categories(() => ({ a: 1, b })),
        include: [1200],
        height: 256,
        width: 1000,
      });
    await tweenFrames(
      renderThemed,
      chart(1),
      chart(0),
      { times: times(0, 300, 20), ready: activateFirst },
      (host, time) => {
        const column = seriesColumns(host, 0)[0] ?? { y: 0, height: 0 };
        const overlay = activeOverlay(host, 0);
        const what = `${String(time)} ms: column ${String(column.y)}+${String(column.height)}, overlay ${String(overlay.y)}+${String(overlay.height)}`;
        expect(overlay.height, what).toBeCloseTo(column.height, 6);
        if (column.height > SERIAL) expect(overlay.y, what).toBeCloseTo(column.y, 6);
      }
    );
  });

  it("never floors two series on one pixel while a slide regroups decimated buckets", async () => {
    // 2,500 categories stack a and b: c0 reads (1, 0), c1 (0, 1) and every other (0.001, 0.001),
    // all far under a device pixel on 0..1,200 over 256 px, so every pixel either series draws is
    // a floor. c0 to c2499 becomes c1 to c2500, a slide by a fifth of a bucket, so the old and the
    // new buckets' columns share pixels mid-tween. Each pixel takes one floor at most.
    const chart = (shift: number) =>
      stackChart({
        config: AB,
        data: categories(
          (slot) => ({
            a: slot === 0 ? 1 : slot === 1 ? 0 : 0.001,
            b: slot === 0 ? 0 : slot === 1 ? 1 : 0.001,
          }),
          shift
        ),
        include: [1200],
        height: 256,
        width: 1000,
      });
    let drawn = 0;
    await tweenFrames(
      renderThemed,
      chart(0),
      chart(1),
      {
        times: times(20, 460, 20),
        ready: (host) => {
          // Zero lies where no rounding turn falls within the 0.43 px the stacks reach, so no column
          // covers a pixel on its own: every drawn pixel is a floor.
          const page = barLayerBox(host).top + 256;
          expect(turnsIn(1, page, page - 0.43)).toBe(false);
        },
      },
      (host, time) => {
        const [a, b] = [shownColumns(host, 0), shownColumns(host, 1)];
        drawn += a.length + b.length;
        expectApart(a, b, `${String(time)} ms: a and b`);
      }
    );
    expect(drawn).toBeGreaterThan(0);
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
      const chart = (a: number) =>
        stackChart({
          config: AB,
          data: categories(() => ({ a, b: 1 })),
          include: [-domain, domain],
          height,
          width: 1000,
        });
      let floored = 0;
      await tweenFrames(
        renderThemed,
        chart(1),
        chart(-1),
        { times: times(0, 600, 20), ready: activateFirst },
        (host, time) => {
          const overlay = activeOverlay(host, 0);
          if (overlay.height <= SERIAL) return;
          floored += 1;
          const columns = seriesColumns(host, 0, "every");
          const under = columns.filter(
            ({ x, y, width, height: tall }) =>
              x <= overlay.x + SERIAL &&
              x + width >= overlay.x + overlay.width - SERIAL &&
              y <= overlay.y + SERIAL &&
              y + tall >= overlay.y + overlay.height - SERIAL
          );
          expect(
            under.length,
            `${String(time)} ms: overlay ${JSON.stringify(overlay)} over a's ${JSON.stringify(columns.filter(({ x }) => x < overlay.x + overlay.width + 2))}`
          ).toBeGreaterThan(0);
        }
      );
      // Once a turns over it owns the negative side, so its overlay draws the floor there.
      expect(floored).toBeGreaterThan(0);
    });
  }

  it("never lets floors on either side of zero share a pixel while a decimated window slides (B7-1)", async () => {
    // Three stacked series over 2,500 categories on -1,000..1,000, 0.1 CSS px a unit, on a 120 x 200
    // plot at 1.5x, 0.3 px in from the left. Every reading is null but a few, and the window slides
    // by one category: the columns above and below zero arrive and leave in different buckets.
    const config = {
      ...AB,
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
    const chart = (shift: number, readings: ReadonlyMap<number, Reading>) =>
      stackChart({
        config,
        data: categories((slot) => {
          const own = readings.get(slot) ?? {};
          return { a: own.a ?? null, b: own.b ?? null, c: own.c ?? null };
        }, shift),
        include: [-1000, 1000],
        height: 200,
        width: 120,
        left: 0.3,
      });
    await tweenFrames(
      renderThemed,
      chart(0, before),
      chart(1, after),
      { dpr: 1.5, times: times(8, 480, 8) },
      (host, time) => {
        expectApart(shownColumns(host, 1), shownColumns(host, 2), `${String(time)} ms: b and c`);
      }
    );
  });
});
