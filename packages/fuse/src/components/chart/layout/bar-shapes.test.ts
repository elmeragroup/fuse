// Unit under test: barParts, the shapes each bar look draws, and drawnBar, which snaps them. Oracles:
// evilcharts' looks as the layer 05 CSS drew them, worked by hand: the blocks look's whole 10 px
// squares 2 px apart from the base, max(10, floor(length / 12) × 12 − 2), at most 10 px wide and
// centred; the striped cap 2 px thick, 2 px past the far end; the expandable strip of 12 % in the
// bar's middle; and the isometric faces 10 px deep. The pixel floor's property reads the device
// grid itself: a drawn edge is a whole number of device pixels from the plot's origin, and a body
// with any width keeps one device pixel of it.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { barRect, columnRect } from "./bar-geometry";
import type { BarCell } from "./bar-geometry";
import { barParts, drawnBar } from "./bar-shapes";
import type { BarVariant } from "./bar-shapes";
import { WHOLE_BAND, barSpan, frameRect, optionBand, plotFrame, slotBand } from "./plot-frame";
import type { PlotFrame, PlotRect } from "./plot-frame";

const UP = { orientation: "vertical", negative: false } as const;

describe("barParts", () => {
  it("draws the default look as the bar itself", () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 };
    expect(barParts("default", rect, UP, 100)).toEqual({ body: rect });
  });

  it("stacks whole squares from the base over a track to the plot's top", () => {
    // 41 px holds three squares and their gaps, 34 px, and a 30 px wide bar centres a 10 px column.
    expect(barParts("blocks", { x: 0, y: 59, width: 30, height: 41 }, UP, 100)).toEqual({
      body: { x: 10, y: 66, width: 10, height: 34 },
      track: { x: 10, y: 0, width: 10, height: 100 },
    });
  });

  it("keeps one square in a short bar and narrows the column inside a thin one", () => {
    // 4 px holds no whole square, so one 10 px square shows, and a 6 px bar keeps 4 px of it.
    expect(barParts("blocks", { x: 0, y: 96, width: 6, height: 4 }, UP, 100).body).toEqual({
      x: 1,
      y: 90,
      width: 4,
      height: 10,
    });
  });

  it("caps a striped bar 2 px past its far end, above a positive bar and below a negative one", () => {
    const rect = { x: 0, y: 20, width: 30, height: 40 };
    expect(barParts("striped", rect, UP, 100).cap).toEqual({ x: 0, y: 16, width: 30, height: 2 });
    expect(barParts("striped", rect, { orientation: "vertical", negative: true }, 100).cap).toEqual({
      x: 0,
      y: 62,
      width: 30,
      height: 2,
    });
    // A horizontal positive bar ends at its right edge.
    expect(barParts("striped", rect, { orientation: "horizontal", negative: false }, 100).cap).toEqual({
      x: 32,
      y: 20,
      width: 2,
      height: 40,
    });
  });

  it("rests an expandable bar as a strip of 12 % in its middle", () => {
    expect(barParts("expandable", { x: 0, y: 0, width: 50, height: 40 }, UP, 100).body).toEqual({
      x: 22,
      y: 0,
      width: 6,
      height: 40,
    });
  });
});

/** A plot of a given size whose origin sits at a page position, at a pixel ratio. */
function frameOf(
  width: number,
  height: number,
  options: {
    readonly dpr?: number;
    readonly left?: number;
    readonly top?: number;
    readonly orientation?: "vertical" | "horizontal";
    readonly count?: number;
    readonly domain?: readonly [number, number];
  } = {}
): PlotFrame {
  const { dpr = 1, left = 0, top = 0, orientation = "vertical", count = 1, domain = [0, 1] } = options;
  return plotFrame({ width, height, dpr, left, top }, orientation, count, domain);
}

/** A positive bar at a slot, from 0 to its value. */
function cellAt(position: number, value: number): BarCell {
  return {
    slot: position,
    position,
    extent: [Math.min(0, value), Math.max(0, value)],
    negative: value < 0,
    stackTop: true,
  };
}

const METRICS = { bandGap: 0.25, barGap: 2, seam: 2 };

describe("drawnBar", () => {
  it("adds a top face and a side face 10 px deep on the snapped body", () => {
    const parts = drawnBar(
      frameOf(100, 100),
      "isometric",
      { x: 10, y: 20, width: 30, height: 40 },
      { negative: false, top: 1 }
    );
    expect(parts.top).toBe("10,20 40,20 50,10 20,10");
    expect(parts.side).toBe("40,20 50,10 50,50 40,60");
  });

  it("counts whole blocks from each stacked segment's own base", () => {
    // B4-4: 4 and 6 stacked on 0–10 over 200 px. The upper segment runs from 120 px up to the top
    // and holds 10 whole squares from its base, [110, 120] up to [2, 12]. The lower one, cut 2 px
    // short at its top, runs from 122 px down to 200 px and holds 6 squares from 200 px.
    const frame = frameOf(40, 200, { domain: [0, 10] });
    const segment = (low: number, high: number, stackTop: boolean) =>
      barRect(
        frame,
        { slot: 0, position: 0, extent: [low, high], negative: false, stackTop },
        METRICS,
        WHOLE_BAND,
        "cut"
      );
    const tops = (rect: PlotRect) =>
      (drawnBar(frame, "blocks", rect, { negative: false, top: 1 }).blocks ?? []).map(({ y, height }) => [
        y,
        height,
      ]);
    expect(tops(segment(4, 10, true))).toEqual(
      Array.from({ length: 10 }, (_, index) => [110 - index * 12, 10])
    );
    expect(tops(segment(0, 4, false))).toEqual(
      Array.from({ length: 6 }, (_, index) => [190 - index * 12, 10])
    );
    // Only the stack's outer segment runs its faint track on over the empty column.
    expect(
      drawnBar(frame, "blocks", segment(0, 4, false), { negative: false, top: 0 }).track
    ).toBeUndefined();
    expect(drawnBar(frame, "blocks", segment(4, 10, true), { negative: false, top: 1 }).track?.[0]).toEqual({
      x: 15,
      y: 110,
      width: 10,
      height: 10,
    });
  });

  it("keeps a 1 px expandable strip for each of 100 categories on 200 px", () => {
    // B3-1 at DPR 1: each 2 px band's bar snaps to [2i, 2i + 2], whose 12 % strip [2i + 0.88,
    // 2i + 1.12] snaps both edges to 2i + 1. The floor keeps it at [2i + 1, 2i + 2].
    const frame = frameOf(200, 100, { count: 100 });
    for (const position of [0, 1, 49, 99]) {
      const { body } = drawnBar(
        frame,
        "expandable",
        barRect(frame, cellAt(position, 1), METRICS, WHOLE_BAND, "cut"),
        { negative: false, top: 1 }
      );
      expect([body.x, body.width], String(position)).toEqual([2 * position + 1, 1]);
    }
  });

  it("keeps a 1 px expandable strip for both series of a group over 50 categories on 400 px", () => {
    // Q3-1 at DPR 1: each 8 px band keeps 6 px from 8i + 1, split into 2 px bars at 8i + 1 and
    // 8i + 5. Their strips [8i + 1.88, 8i + 2.12] and [8i + 5.88, 8i + 6.12] snap to nothing, and
    // the floor keeps [8i + 2, 8i + 3] and [8i + 6, 8i + 7].
    const frame = frameOf(400, 100, { count: 50 });
    for (const position of [0, 7, 49]) {
      const strips = [0, 1].map((index) => {
        const rect = barRect(frame, cellAt(position, 1), METRICS, { index, count: 2 }, "cut");
        const { body } = drawnBar(frame, "expandable", rect, { negative: false, top: 1 });
        return [body.x, body.width];
      });
      expect(strips, String(position)).toEqual([
        [8 * position + 2, 1],
        [8 * position + 6, 1],
      ]);
    }
  });
});

const VARIANTS: readonly BarVariant[] = [
  "default",
  "hatched",
  "duotone",
  "duotone-reverse",
  "gradient",
  "striped",
  "blocks",
  "expandable",
  "isometric",
];

/** Whether a coordinate lies a whole number of device pixels from the plot's drawn origin. */
function onGrid(at: number, dpr: number): boolean {
  return Math.abs(at * dpr - Math.round(at * dpr)) < 1e-6;
}

/** A rectangle's extent along the slot axis and its two slot-axis edges. */
function along(frame: PlotFrame, rect: PlotRect): { size: number; edges: readonly number[] } {
  return frame.orientation === "vertical"
    ? { size: rect.width, edges: [rect.x, rect.x + rect.width] }
    : { size: rect.height, edges: [rect.y, rect.y + rect.height] };
}

/** Whether every edge of a rectangle lies on the device grid. */
function rectOnGrid(rect: PlotRect, dpr: number): boolean {
  return [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height].every((at) => onGrid(at, dpr));
}

describe("the pixel floor", () => {
  const plot = fc.record({
    length: fc.double({ min: 20, max: 2000, noNaN: true }),
    across: fc.double({ min: 40, max: 800, noNaN: true }),
    dpr: fc.double({ min: 1, max: 3, noNaN: true }),
    left: fc.double({ min: -300, max: 300, noNaN: true }),
    top: fc.double({ min: -300, max: 300, noNaN: true }),
    orientation: fc.constantFrom("vertical" as const, "horizontal" as const),
    count: fc.integer({ min: 1, max: 400 }),
    group: fc.integer({ min: 1, max: 4 }),
    bandGap: fc.double({ min: 0, max: 0.6, noNaN: true }),
    barGap: fc.double({ min: 0, max: 6, noNaN: true }),
  });

  it("keeps one device pixel along the slot axis for every drawn part of every look, at rest and mid-tween", () => {
    fc.assert(
      fc.property(
        plot,
        fc.constantFrom(...VARIANTS),
        fc.double({ min: -1000, max: 1000, noNaN: true }).filter((value) => Math.abs(value) > 1e-6),
        fc.nat(),
        fc.nat(),
        fc.nat(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (config, variant, value, at, other, sub, t) => {
          const { length, across, dpr, left, top, orientation, count, group, bandGap, barGap } = config;
          const vertical = orientation === "vertical";
          const frame = frameOf(vertical ? length : across, vertical ? across : length, {
            dpr,
            left,
            top,
            orientation,
            count,
            domain: [Math.min(0, value), Math.max(0, value)],
          });
          const metrics = { bandGap, barGap, seam: 2 };
          // A band keeps a share inside its gap, so every bar of a group has room, however
          // narrow the band and however wide the group's gaps.
          const band = { index: sub % group, count: group };
          const resting = barRect(frame, cellAt(at % count, value), metrics, band, "cut");
          const target = barRect(frame, cellAt(other % count, value / 2), metrics, band, "whole");
          // A tween frame lies between two drawn rectangles.
          const tween = {
            x: resting.x + (target.x - resting.x) * t,
            y: resting.y + (target.y - resting.y) * t,
            width: resting.width + (target.width - resting.width) * t,
            height: resting.height + (target.height - resting.height) * t,
          };
          for (const rect of [resting, tween]) {
            const parts = drawnBar(frame, variant, rect, { negative: value < 0, top: 1 });
            const rects = [
              parts.body,
              ...(parts.cap === undefined ? [] : [parts.cap]),
              ...(parts.track ?? []),
              ...(parts.blocks ?? []),
            ];
            // The default look draws the bar's own pixels, which every look's parts stay inside.
            const own = along(frame, drawnBar(frame, "default", rect, { negative: value < 0, top: 1 }).body);
            for (const part of rects) {
              expect(rectOnGrid(part, dpr)).toBe(true);
              const { size, edges } = along(frame, part);
              expect(size).toBeGreaterThanOrEqual(1 / dpr - 1e-9);
              expect(edges[0] ?? 0).toBeGreaterThanOrEqual((own.edges[0] ?? 0) - 1e-9);
              expect(edges[1] ?? 0).toBeLessThanOrEqual((own.edges[1] ?? 0) + 1e-9);
            }
            // Every block is a whole 10 px square on the device grid, 12 px from the next, so a
            // segment shows no fragment wherever its base lies.
            for (const block of [...(parts.blocks ?? []), ...(parts.track ?? [])]) {
              const extent = vertical ? block.height : block.width;
              expect(Math.abs(extent - 10)).toBeLessThanOrEqual(1 / dpr + 1e-9);
            }
          }
          // The active overlay and the tooltip row draw the band's own rectangles.
          const row = frameRect(frame, barSpan(frame, at % count, metrics, WHOLE_BAND), [0, across]);
          expect(along(frame, row).size).toBeGreaterThanOrEqual(1 / dpr - 1e-9);
        }
      )
    );
  });

  it("keeps one device pixel for every interaction band, covering the bar it marks", () => {
    // The crosshair band, the focused option and the tooltip anchor read optionBand, and the
    // grid's slot lines read slotBand. Each keeps a device pixel on the grid, however dense the
    // slots, and a band covers every bar drawn in it, a grouped one too.
    fc.assert(
      fc.property(
        plot,
        fc.constantFrom("band" as const, "point" as const),
        fc.nat(),
        fc.double({ min: 0.5, max: 1000, noNaN: true }),
        (config, xScale, at, value) => {
          const { length, across, dpr, left, top, orientation, count, bandGap } = config;
          const vertical = orientation === "vertical";
          const frame = frameOf(vertical ? length : across, vertical ? across : length, {
            dpr,
            left,
            top,
            orientation,
            count,
            domain: [0, value],
          });
          const position = at % count;
          for (const band of [optionBand(frame, position, xScale), slotBand(frame, position)]) {
            expect(band.every((edge) => onGrid(edge, dpr))).toBe(true);
            expect(band[1] - band[0]).toBeGreaterThanOrEqual(1 / dpr - 1e-9);
          }
          if (xScale === "point") return;
          // Any bar of the slot, alone or in a group, drawn wider than nothing.
          const metrics = { bandGap, barGap: config.barGap, seam: 2 };
          const sub = { index: at % config.group, count: config.group };
          const bar = along(frame, barRect(frame, cellAt(position, value), metrics, sub, "whole"));
          fc.pre(bar.size > 0);
          const [start, end] = optionBand(frame, position, "band");
          expect(bar.edges[0]).toBeGreaterThanOrEqual(start - 1e-9);
          expect(bar.edges[1]).toBeLessThanOrEqual(end + 1e-9);
        }
      )
    );
  });

  it("keeps the first of 400 bands on 200 px one pixel wide, under its bar", () => {
    // B4-1 at DPR 1: the first band [0, 0.5] and its bar [0.06, 0.44] both snap to an empty
    // span at 0, and both keep the pixel [0, 1].
    const frame = frameOf(200, 100, { count: 400 });
    expect(optionBand(frame, 0, "band")).toEqual([0, 1]);
    expect(along(frame, barRect(frame, cellAt(0, 1), METRICS, WHOLE_BAND, "whole")).edges).toEqual([0, 1]);
  });

  it("keeps one device pixel for every path column, however many share the plot", () => {
    fc.assert(
      fc.property(
        plot,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 1e-6, max: 1, noNaN: true }),
        (config, start, width) => {
          const { length, across, dpr, left, top, count } = config;
          const frame = frameOf(length, across, { dpr, left, top, count });
          // A column in slot units, somewhere in the window, a sliver of a slot or more wide.
          const x0 = start * (count - width);
          const rect = columnRect(frame, {
            x0,
            x1: x0 + width,
            top: 10,
            bottom: 100,
            slot: 0,
            position: null,
          });
          expect(rectOnGrid(rect, dpr)).toBe(true);
          expect(rect.width).toBeGreaterThanOrEqual(1 / dpr - 1e-9);
        }
      )
    );
  });

  it("draws every bar of a group whose gaps outgrow its band", () => {
    // 38 categories on 100 px keep 1.97 px inside each band's 25 % gap, less than the group's
    // 2 px gap. The gap takes half, 0.99 px, and each of the two bars 0.49 px, which the floor
    // turns into a pixel each.
    const frame = frameOf(100, 100, { count: 38 });
    const widths = [0, 1].map(
      (index) => barRect(frame, cellAt(5, 1), METRICS, { index, count: 2 }, "whole").width
    );
    expect(widths).toEqual([1, 1]);
  });

  it("keeps an empty span empty", () => {
    const frame = frameOf(100, 100);
    expect(frameRect(frame, [3, 3], [0, 50]).width).toBe(0);
    for (const variant of VARIANTS) {
      const parts = drawnBar(
        frame,
        variant,
        { x: 3, y: 50, width: 0, height: 50 },
        { negative: false, top: 1 }
      );
      for (const part of [parts.body, parts.cap, ...(parts.track ?? []), ...(parts.blocks ?? [])]) {
        if (part !== undefined) expect(part.width, variant).toBe(0);
      }
    }
  });
});
