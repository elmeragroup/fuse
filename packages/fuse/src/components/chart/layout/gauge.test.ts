// A gauge's geometry. Unit under test: gaugeOffset, gaugePlace, litNotches, notchLayout,
// rulerSpacing, rulerTicks, rangeOffsets, dotRings and reached. Oracles, written by hand: a 270° sweep reads 3.9 of 0–5 kWh at
// 0.78 · 270 = 210.6°; 40 notches light round(40 · 0.78) = 31, and any reading above `min` lights
// one; a 2 px gap at the notches' inner edge, 0.84 of a 100 px radius, spans 2 / 84 rad; and the
// round ruler steps of 0–5 kWh (1 kWh, minors of 0.2), 0–300 øre (50, minors of 10) and 0–100 %
// (20, minors of 5), and 0–11 kW (1, after the steps of 2 that leave a remainder); and Dots' rings 0.07 apart from 0.76 in, whose dots sit near 0.07 apart along
// a 270° arc: 0.76 · 3π/2 / 0.07 ≈ 51.2 gaps, so 52 dots, and 0.69 · 3π/2 / 0.07 ≈ 46.4, so 47; and
// a full turn, which closes on itself: 40 notches and 40 gaps at 9° a pair, and no mark on max.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  dotRings,
  gaugeOffset,
  gaugePlace,
  litNotches,
  notchCentre,
  notchLayout,
  rangeOffsets,
  reached,
  rulerSpacing,
  rulerTicks,
} from "./gauge";
import { sweepOf } from "./polar-angle";

const GAUGE = sweepOf(-135, 135);
const KWH = { min: 0, max: 5 };

describe("gaugeOffset and gaugePlace", () => {
  it("places a reading on its share of the sweep and clamps one past either end", () => {
    expect(gaugeOffset(KWH, GAUGE, 3.9)).toBeCloseTo(210.6, 12);
    expect(gaugeOffset(KWH, GAUGE, 5.6)).toBe(270);
    expect(gaugeOffset(KWH, GAUGE, -1)).toBe(0);
    expect([5.6, -1, 3.9, 5, 0].map((value) => gaugePlace(KWH, value))).toEqual([
      "over",
      "under",
      "within",
      "within",
      "within",
    ]);
  });

  it("reads a domain that starts above 0 from its own minimum", () => {
    // 60 øre on a 20–120 øre dial sits 40 % of the way along.
    expect(gaugeOffset({ min: 20, max: 120 }, GAUGE, 60)).toBeCloseTo(108, 12);
  });
});

describe("litNotches", () => {
  it("lights the reading's share in whole notches, rounded", () => {
    expect(litNotches(210.6, 270, 40)).toBe(31);
    expect(litNotches(270, 270, 40)).toBe(40);
    expect(litNotches(0, 270, 40)).toBe(0);
  });

  it("lights one notch for any reading above the minimum", () => {
    expect(litNotches(0.01, 270, 40)).toBe(1);
  });

  it("never lights fewer notches for a larger offset", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 270, noNaN: true }),
        fc.double({ min: 0, max: 270, noNaN: true }),
        (a, b) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          expect(litNotches(low, 270, 40)).toBeLessThanOrEqual(litNotches(high, 270, 40));
        }
      )
    );
  });
});

describe("notchLayout", () => {
  it("gives every gap 2 px at the notches' inner edge and every notch the rest in equal shares", () => {
    const layout = notchLayout(GAUGE, 40, { scale: 100, dpr: 1 });
    const gap = (2 / 84) * (180 / Math.PI);
    expect(layout.step - layout.width).toBeCloseTo(gap, 12);
    expect(layout.width).toBeCloseTo((270 - 39 * gap) / 40, 12);
    // The last notch ends on the sweep's end.
    expect(notchCentre(layout, 39) + layout.width / 2).toBeCloseTo(270, 12);
    expect(layout.corner).toBeCloseTo(0.015, 12);
  });

  it("rounds the gap to whole device pixels, one at least", () => {
    // 2 CSS px at a 1.5 dpr is 3 device px; at 0.4 it rounds to 1 device px, 2.5 CSS px.
    const sharp = notchLayout(GAUGE, 40, { scale: 100, dpr: 1.5 });
    expect(sharp.step - sharp.width).toBeCloseTo((2 / 84) * (180 / Math.PI), 12);
    const coarse = notchLayout(GAUGE, 40, { scale: 100, dpr: 0.4 });
    expect(coarse.step - coarse.width).toBeCloseTo((2.5 / 84) * (180 / Math.PI), 12);
  });
});

describe("a full turn", () => {
  const TURN = sweepOf(0, 360);

  it("closes with a gap as wide as every other between its last notch and its first", () => {
    const layout = notchLayout(TURN, 40, { scale: 100, dpr: 1 });
    // 40 gaps share the turn with 40 notches, so a notch and a gap make up 9°.
    expect(layout.step).toBeCloseTo(9, 12);
    const lastEnd = notchCentre(layout, 39) + layout.width / 2;
    const firstStart = notchCentre(layout, 0) - layout.width / 2 + 360;
    expect(firstStart - lastEnd).toBeCloseTo(layout.step - layout.width, 12);
  });

  it("draws no tick or dot on max, which lies on min", () => {
    const ticks = rulerTicks(KWH, TURN, { ticks: 25, majorEvery: 5 });
    expect(ticks).toHaveLength(25);
    expect(ticks.at(-1)?.value).toBeCloseTo(4.8, 12);
    const [ring] = dotRings(TURN, 1);
    expect(ring?.offsets.at(-1)).toBeLessThan(360);
  });
});

describe("rulerSpacing and rulerTicks", () => {
  it("picks round majors that divide the domain, with minors by the step's leading digit", () => {
    expect(rulerSpacing(KWH)).toEqual({ ticks: 25, majorEvery: 5 });
    expect(rulerSpacing({ min: 0, max: 300 })).toEqual({ ticks: 30, majorEvery: 5 });
    expect(rulerSpacing({ min: 0, max: 100 })).toEqual({ ticks: 20, majorEvery: 4 });
    // 0–11 kW takes no step of 2, but takes one of 1 kW for 11 majors.
    expect(rulerSpacing({ min: 0, max: 11 })).toEqual({ ticks: 55, majorEvery: 5 });
    // 0–7.3 has no round step that divides it.
    expect(rulerSpacing({ min: 0, max: 7.3 })).toEqual({ ticks: 20, majorEvery: 5 });
  });

  it("lays the ticks evenly from min to max, majors on their interval", () => {
    const ticks = rulerTicks(KWH, GAUGE, { ticks: 25, majorEvery: 5 });
    expect(ticks).toHaveLength(26);
    expect(ticks.filter(({ major }) => major).map(({ value }) => value)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ticks[5]?.offset).toBeCloseTo(54, 12);
    expect(ticks.at(-1)).toEqual({ value: 5, offset: 270, major: true });
  });
});

describe("rangeOffsets", () => {
  it("clamps a range to the domain, in either order, and drops one outside it", () => {
    expect(rangeOffsets(KWH, GAUGE, 5, 4)).toEqual({ start: 216, end: 270 });
    expect(rangeOffsets(KWH, GAUGE, 4, 9)).toEqual({ start: 216, end: 270 });
    expect(rangeOffsets(KWH, GAUGE, 6, 9)).toBeNull();
  });
});

describe("dotRings and reached", () => {
  it("steps the rings in from 0.76 and spaces each ring's dots about as far apart, end to end", () => {
    const rings = dotRings(GAUGE, 2);
    expect(rings.map(({ radius }) => radius)).toEqual([0.76, 0.69]);
    expect(rings.map(({ offsets }) => offsets.length)).toEqual([52, 47]);
    expect(rings[0]?.offsets[0]).toBe(0);
    expect(rings[0]?.offsets.at(-1)).toBeCloseTo(270, 12);
    expect(rings[0]?.offsets[1]).toBeCloseTo(270 / 51, 12);
  });

  it("draws one to six rings", () => {
    expect(dotRings(GAUGE, 9)).toHaveLength(6);
    expect(dotRings(GAUGE, 0)).toHaveLength(1);
  });

  it("reaches the marks at or behind a reading above the minimum, and none at it", () => {
    expect([0, 100, 100.0000000001, 101].map((mark) => reached(mark, 100))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(reached(0, 0)).toBe(false);
  });
});
