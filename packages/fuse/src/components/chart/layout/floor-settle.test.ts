// Unit under test: settleFloors, the one owner of the stack floor's policy, and geometryRect's rule
// that an owner keeps its pixel through a seam. Oracles: spans worked by hand on a 200 px plot at
// 1x over -1,000..1,000, zero at 100 px, where up is positive; and for random spans, what the floor
// exists for: no series draws on another series' pixel where their own pixels do not already meet,
// the decision never depends on the order spans arrive in, and a resting stack with any length
// draws a device pixel.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { geometryRect } from "./bar-geometry";
import { settleFloors } from "./floor-settle";
import type { FloorSpan } from "./floor-settle";
import { floorAcross, plotFrame, snapY } from "./plot-frame";
import type { PlotFrame } from "./plot-frame";

/** A plot 200 px tall with zero in its middle, its top a fraction of a pixel into the page. */
function frameAt(dpr = 1, top = 0): PlotFrame {
  return plotFrame({ width: 100, height: 200, dpr, left: 0, top }, "vertical", 1, [-1000, 1000]);
}

const FRAME = frameAt();

/** A span over device pixel columns `from` to `to` of a series, from `base` to `tip` down the plot. */
function span(
  series: string,
  from: number,
  to: number,
  base: number,
  tip: number,
  frame: PlotFrame = FRAME
): FloorSpan {
  const [low, high] = [snapY(frame.box, Math.min(base, tip)), snapY(frame.box, Math.max(base, tip))];
  return { from, to, series, segment: { base, tip, plainFrom: low, plainTo: high } };
}

/** Which spans keep their floor, as 0s and 1s in span order. */
function keeps(spans: readonly FloorSpan[], frame: PlotFrame = FRAME): number[] {
  return [...settleFloors(spans, frame)];
}

describe("the floor's owners", () => {
  it("gives each side's floor to the series reaching farthest out", () => {
    // a covers 100 to 99.8 and b 99.8 to 99.6 above it, both snapping to nothing at 100, so b
    // floors 99 to 100. c hangs below, 100 to 100.3, and floors 100 to 101.
    expect(
      keeps([span("a", 0, 1, 100, 99.8), span("b", 0, 1, 99.8, 99.6), span("c", 0, 1, 100, 100.3)])
    ).toEqual([0, 1, 1]);
  });

  it("decides a tie by series key, whatever order the spans arrive in (Q7-1)", () => {
    // Halfway through [1, 1] to [1, 0] at 0.1 px a unit, s0 covers 100 to 99.9 and s1, falling to
    // 0, 99.95 to 99.9: both tips lie level, and s0 comes first by key.
    const s0 = span("s0", 0, 1, 100, 99.9);
    const s1 = span("s1", 0, 1, 99.95, 99.9);
    expect(keeps([s0, s1])).toEqual([1, 0]);
    expect(keeps([s1, s0])).toEqual([0, 1]);
  });

  it("lets a series' own spans share a pixel column and keep their floors", () => {
    // Two buckets of one series meet in pixel column 1, each 0.2 px above zero.
    expect(keeps([span("a", 0, 2, 100, 99.8), span("a", 1, 3, 100, 99.8)])).toEqual([1, 1]);
  });

  it("keeps no floor on a pixel another series covers on its own", () => {
    // a covers 99 to 100 on its own, 99.6 to 99.4 across the turn at 99.5. b above it snaps to
    // nothing at 99, 99.4 to 99.3, and its floor takes 98 to 99, clear of a: b keeps it. c below
    // zero snaps to nothing at 99, 99.45 to 99.48, and its floor down would take 99 to 100, a's:
    // c keeps none, and a, alone above zero, keeps its own, which adds nothing to its pixel.
    expect(keeps([span("a", 0, 1, 99.6, 99.4), span("b", 0, 1, 99.4, 99.3)])).toEqual([0, 1]);
    expect(keeps([span("a", 0, 1, 99.6, 99.4), span("c", 0, 1, 99.45, 99.48)])).toEqual([1, 0]);
  });

  it("never lets floors on either side of zero share a pixel (B7-1)", () => {
    // b's segment above zero snaps to nothing at 100 and floors 99 to 100. c's below zero, mid
    // crossing, snaps to nothing at 99 and would floor 99 to 100 too: the floor above stands.
    expect(keeps([span("b", 0, 1, 99.6, 99.55), span("c", 0, 1, 99.4, 99.45)])).toEqual([1, 0]);
  });

  it("keeps a coarse span's floor only where it wins every run it covers (B7-2)", () => {
    // An hourly a reads 1 over pixel columns 0 to 4, 0.21 px. b reads 0 in the first quarter and
    // 1 in the other three, on top of a. b reaches farther in three of a's four runs, so a keeps
    // no floor and b's quarters keep theirs: no pixel holds both.
    const spans = [
      span("a", 0, 4, 100, 99.79),
      span("b", 0, 1, 99.79, 99.79),
      span("b", 1, 2, 99.79, 99.58),
      span("b", 2, 3, 99.79, 99.58),
      span("b", 3, 4, 99.79, 99.58),
    ];
    expect(keeps(spans)).toEqual([0, 0, 1, 1, 1]);
  });
});

describe("the floor on random spans", () => {
  // Spans of up to four series over up to six pixel columns, each within two pixels of zero.
  const spanOf = fc.record({
    series: fc.constantFrom("a", "b", "c", "d"),
    from: fc.integer({ min: 0, max: 5 }),
    width: fc.integer({ min: 1, max: 3 }),
    base: fc.double({ min: 98, max: 102, noNaN: true }),
    tip: fc.double({ min: 98, max: 102, noNaN: true }),
  });
  const plot = fc.record({
    dpr: fc.constantFrom(1, 1.5, 2),
    top: fc.double({ min: 0, max: 1, noNaN: true }),
  });

  it("never draws one series on another's pixel where their own pixels do not meet", () => {
    fc.assert(
      fc.property(plot, fc.array(spanOf, { minLength: 1, maxLength: 6 }), ({ dpr, top }, raw) => {
        const frame = frameAt(dpr, top);
        const spans = raw.map(({ series, from, width, base, tip }) =>
          span(series, from, from + width, base, tip, frame)
        );
        const kept = settleFloors(spans, frame);
        const drawn = spans.map(({ segment }, id) =>
          kept[id] === 1
            ? floorAcross(frame, segment.plainFrom, segment.plainTo, [segment.base, segment.tip])
            : ([segment.plainFrom, segment.plainTo] as const)
        );
        spans.forEach((one, id) => {
          spans.forEach((other, them) => {
            if (them <= id || one.series === other.series) return;
            if (Math.min(one.to, other.to) <= Math.max(one.from, other.from)) return;
            const [a0, a1] = drawn[id] ?? [0, 0];
            const [b0, b1] = drawn[them] ?? [0, 0];
            const plain =
              Math.min(one.segment.plainTo, other.segment.plainTo) -
              Math.max(one.segment.plainFrom, other.segment.plainFrom);
            if (plain > 1e-9) return;
            expect(Math.min(a1, b1) - Math.max(a0, b0)).toBeLessThanOrEqual(1e-9);
          });
        });
      })
    );
  });

  it("decides alike whatever order the spans arrive in", () => {
    fc.assert(
      fc.property(
        plot,
        fc.array(spanOf, { minLength: 1, maxLength: 6 }),
        fc.integer(),
        ({ dpr, top }, raw, seed) => {
          const frame = frameAt(dpr, top);
          const spans = raw.map(({ series, from, width, base, tip }) =>
            span(series, from, from + width, base, tip, frame)
          );
          const order = spans
            .map((_, id) => id)
            .toSorted((a, b) => ((a * 7919 + seed) % 13) - ((b * 7919 + seed) % 13) || a - b);
          const kept = settleFloors(spans, frame);
          const shuffled = settleFloors(
            order.map((id) => spans[id] ?? spans[0] ?? span("a", 0, 1, 100, 100)),
            frame
          );
          order.forEach((id, at) => {
            expect(shuffled[at]).toBe(kept[id]);
          });
        }
      )
    );
  });

  it("draws a device pixel for every resting stack with any length", () => {
    // A resting stack: up to four series over up to five slots, each a run of pixel columns, every
    // reading stacking on d3's diverging offset at 0.1 px a unit, the first series hourly over
    // every slot when asked, the others one span a slot.
    const stack = fc.record({
      slots: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 5 }),
      series: fc.integer({ min: 1, max: 4 }),
      coarse: fc.boolean(),
      values: fc.array(fc.integer({ min: -3, max: 3 }), { minLength: 20, maxLength: 20 }),
    });
    fc.assert(
      fc.property(plot, stack, ({ dpr, top }, { slots, series, coarse, values }) => {
        const frame = frameAt(dpr, top);
        const at = (value: number) => 100 - value * 0.1;
        const value = (key: number, slot: number) =>
          (key === 0 && coarse ? values[0] : values[key * 5 + slot]) ?? 0;
        const spans: FloorSpan[] = [];
        let from = 0;
        slots.forEach((width, slot) => {
          let up = 0;
          let down = 0;
          for (let key = 0; key < series; key += 1) {
            const reading = value(key, slot);
            const [base, tip] =
              reading > 0 ? [up, (up += reading)] : reading < 0 ? [down, (down += reading)] : [0, 0];
            // The hourly first series draws one span over every slot, from its first slot.
            if (key === 0 && coarse) {
              if (slot === 0)
                spans.push(
                  span(
                    "s0",
                    0,
                    slots.reduce((sum, own) => sum + own, 0),
                    at(base),
                    at(tip),
                    frame
                  )
                );
              continue;
            }
            spans.push(span(`s${String(key)}`, from, from + width, at(base), at(tip), frame));
          }
          from += width;
        });
        const kept = settleFloors(spans, frame);
        const length = spans.some(({ segment }) => segment.base !== segment.tip);
        const shows = spans.some(({ segment }, id) => {
          const [low, high] =
            kept[id] === 1
              ? floorAcross(frame, segment.plainFrom, segment.plainTo, [segment.base, segment.tip])
              : [segment.plainFrom, segment.plainTo];
          return high - low > 1e-9;
        });
        if (length) expect(shows).toBe(true);
      })
    );
  });
});

describe("the owner's pixel through a seam", () => {
  /** The value-axis span of a segment's rectangle at a place, down the plot. */
  const spanAt = (frame: PlotFrame, base: number, tip: number, seam: number, place: "outer" | "inner") => {
    const rect = geometryRect(frame, [10, 20, base, tip, seam, 1], place);
    return [rect.y, rect.y + rect.height] as const;
  };

  it("keeps the owner one device pixel past its base where the seam takes its whole length", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 1.5, 2),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 1e-6, max: 1.9, noNaN: true }),
        fc.constantFrom(1, -1),
        (dpr, top, length, direction) => {
          // A 2 px seam takes the whole of a segment up to 2 px long, from its base at 100 px.
          const frame = frameAt(dpr, top);
          const tip = 100 - direction * length;
          const [from, to] = spanAt(frame, 100, tip, 2, "outer");
          expect(to - from).toBeCloseTo(1 / dpr, 9);
          // Its base stays on the snapped base, and its pixel lies toward its tip.
          const [base] = spanAt(frame, 100, 100, 0, "inner");
          expect(direction === 1 ? to : from).toBeCloseTo(base, 9);
          // Any other segment the seam takes keeps nothing.
          const [start, end] = spanAt(frame, 100, tip, 2, "inner");
          expect(end - start).toBe(0);
        }
      )
    );
  });
});
