// Unit under test: layout/momentum.ts, the momentum spring, as createChartMotion's momentum move
// schedules it, on a clock the test steps frame by frame.
// Oracles, written by hand: a mark sent from 0 to 100 that is sent to 10 while it still rises keeps
// rising for a frame and turns back without a jump, where a plain move turns at once, and settles
// within twice the update's 480 ms, the longest a softened turn may take; the gauge's
// contract, that a mark never passes the value it reads, never leaves the values it moved between
// (so never the sweep), rests on its target exactly, and carries no velocity out of a delay it has
// not left, even when a retarget lands in an entrance's delay, a degree ahead of a fast rise, or
// several times before the next frame; a resize that doubles the plot's width mid-turn doubles every
// x coordinate the spring moves between, so the mark stays between the doubled target and twice the
// highest value it drew; and a mark at rest, or under reduced motion, moves as it did.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createChartMotion } from "../chart-motion";
import type { MarkValues, MotionHost, Placement, ValueAxis } from "../chart-motion";

/** A clock and a frame queue the test advances by hand. */
function manualFrames() {
  let now = 0;
  let queue: ((time: number) => void)[] = [];
  const host: MotionHost = {
    now: () => now,
    requestFrame: (callback) => {
      queue.push(callback);
      return queue.length;
    },
    cancelFrame: () => {
      queue = [];
    },
  };
  /** Run the next frame, `ms` after the last. */
  const frame = (ms = 16): void => {
    now += ms;
    const due = queue;
    queue = [];
    for (const callback of due) callback(now);
  };
  return { host, frame };
}

/**
 * A loop with one mark whose every drawn value lands in `drawn`: a size by default, which a resize
 * leaves alone, or a coordinate along `axes`, which it maps.
 */
function oneMark({
  motion: mode = "full",
  axes = [],
}: { motion?: "full" | "reduced"; axes?: readonly ValueAxis[] } = {}) {
  const { host, frame } = manualFrames();
  const motion = createChartMotion(host, mode === "reduced");
  const drawn: number[] = [];
  const write = (values: MarkValues): void => {
    drawn.push(values[0] ?? Number.NaN);
  };
  const place = (value: number, placement: Placement): void => {
    motion.place("mark", [value], write, placement, { axes });
  };
  return { frame, drawn, place };
}

/** The gauge's sweep, in degrees from its start. */
const SWEEP = 270;

/** Run frames of `ms` until the mark rests on `target`, at most `limit` of them. */
function settle(mark: ReturnType<typeof oneMark>, target: number, ms = 16, limit = 200): void {
  for (let index = 0; index < limit && mark.drawn.at(-1) !== target; index += 1) mark.frame(ms);
}

/** Every value drawn from `from` on, which a retarget's checks read. */
function after(mark: ReturnType<typeof oneMark>, from: number): number[] {
  return mark.drawn.slice(from);
}

/** A mark sent from 0 to 100 and seven frames into its rise, then sent to 10 by `placement`. */
function retarget(placement: Placement) {
  const mark = oneMark();
  mark.place(0, { kind: "snap" });
  mark.place(100, { kind: "move" });
  for (let index = 0; index < 7; index += 1) mark.frame();
  const before = mark.drawn.slice(-2);
  const shown = mark.drawn.at(-1) ?? Number.NaN;
  mark.place(10, placement);
  // The placement draws where the mark showed, before the browser paints.
  const atPlace = mark.drawn.at(-1) ?? Number.NaN;
  mark.frame();
  const after = mark.drawn.at(-1) ?? Number.NaN;
  return { ...mark, before, shown, atPlace, after };
}

describe("a momentum move", () => {
  it("keeps rising for the frame after a lower target lands mid-rise, where a plain move turns at once", () => {
    const kept = retarget({ kind: "move", momentum: "keep" });
    const [previous = Number.NaN, shown = Number.NaN] = kept.before;
    expect(shown).toBeGreaterThan(previous);
    expect(shown).toBeLessThan(100);
    expect(kept.atPlace).toBe(kept.shown);
    expect(kept.after).toBeGreaterThan(kept.shown);
    // The frame's step is no larger than the rise's own step before it: the course bends.
    expect(kept.after - kept.shown).toBeLessThanOrEqual(shown - previous);
    const plain = retarget({ kind: "move" });
    expect(plain.atPlace).toBe(plain.shown);
    expect(plain.after).toBeLessThan(plain.shown);
  });

  it("turns back toward the new target without crossing it, and rests on it within twice the update's 480 ms", () => {
    const kept = retarget({ kind: "move", momentum: "keep" });
    for (let index = 0; index < 60; index += 1) kept.frame();
    const settling = kept.drawn.slice(kept.drawn.indexOf(kept.after));
    expect(Math.min(...settling)).toBeGreaterThanOrEqual(10);
    expect(kept.drawn.at(-1)).toBe(10);
  });

  it("moves a mark at rest on the update curve, as a plain move does", () => {
    const kept = oneMark();
    kept.place(0, { kind: "snap" });
    kept.place(100, { kind: "move", momentum: "keep" });
    const plain = oneMark();
    plain.place(0, { kind: "snap" });
    plain.place(100, { kind: "move" });
    for (let index = 0; index < 10; index += 1) {
      kept.frame();
      plain.frame();
    }
    expect(kept.drawn).toEqual(plain.drawn);
  });

  it("snaps under reduced motion", () => {
    const mark = oneMark({ motion: "reduced" });
    mark.place(0, { kind: "snap" });
    mark.place(100, { kind: "move", momentum: "keep" });
    expect(mark.drawn).toEqual([0, 100]);
  });

  it("carries no velocity out of an entrance's delay, so a retarget at 64 ms of 160 stays on the dial", () => {
    const mark = oneMark();
    mark.place(210.6, { kind: "enter", from: [0], delay: 160, duration: 1000 });
    for (let index = 0; index < 4; index += 1) mark.frame();
    // The entrance still waits in its delay at its start.
    expect(mark.drawn.at(-1)).toBe(0);
    const from = mark.drawn.length;
    mark.place(243, { kind: "move", momentum: "keep" });
    settle(mark, 243);
    const values = after(mark, from);
    expect(Math.max(...values)).toBeLessThanOrEqual(243);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(values.at(-1)).toBe(243);
  });

  it("settles onto a target a degree ahead of a fast rise without passing it", () => {
    const mark = oneMark();
    mark.place(0, { kind: "snap" });
    mark.place(270, { kind: "move" });
    mark.frame(16);
    const shown = mark.drawn.at(-1) ?? Number.NaN;
    // The rise has started, so the mark moves fast toward a target a degree ahead.
    expect(shown).toBeGreaterThan(0);
    const from = mark.drawn.length;
    mark.place(shown + 1, { kind: "move", momentum: "keep" });
    settle(mark, shown + 1);
    const values = after(mark, from);
    expect(Math.max(...values)).toBeLessThanOrEqual(shown + 1);
    expect(values.at(-1)).toBe(shown + 1);
  });

  it.each([
    ["two", [27, 20]],
    ["three", [27, 20, 15]],
  ] as const)(
    "keeps its position, velocity and clock through %s retargets before the next frame",
    (_, targets) => {
      const mark = oneMark();
      mark.place(0, { kind: "snap" });
      mark.place(270, { kind: "move" });
      for (let index = 0; index < 5; index += 1) mark.frame();
      const [previous = Number.NaN, shown = Number.NaN] = mark.drawn.slice(-2);
      expect(shown).toBeGreaterThan(previous);
      for (const target of targets) mark.place(target, { kind: "move", momentum: "keep" });
      // Every placement draws where the mark showed.
      expect(mark.drawn.at(-1)).toBe(shown);
      mark.frame();
      // The rise carries on for the frame, as one retarget's does, where a lost velocity falls.
      expect(mark.drawn.at(-1)).toBeGreaterThan(shown);
      const last = targets.at(-1) ?? Number.NaN;
      settle(mark, last);
      expect(Math.max(...mark.drawn)).toBeLessThanOrEqual(270);
      expect(mark.drawn.at(-1)).toBe(last);
    }
  );

  it("carries a resize's scale into a spring it moves on, so it stays in the resized span and rests on the resized target", () => {
    const { frame, drawn, place } = oneMark({ axes: ["x"] });
    place(0, { kind: "snap" });
    place(100, { kind: "move" });
    for (let index = 0; index < 7; index += 1) frame();
    place(10, { kind: "move", momentum: "keep" });
    frame();
    const high = Math.max(...drawn);
    const from = drawn.length;
    // The box doubles in width, so every x coordinate doubles: the target 10 lands on 20, and the
    // values the mark moved between, 0 to its highest, on 0 to twice that.
    place(20, { kind: "settle", scale: { x: 2, y: 1, to: {} } });
    for (let index = 0; index < 120 && drawn.at(-1) !== 20; index += 1) frame();
    const values = drawn.slice(from);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(value).toBeLessThanOrEqual(2 * high + 1e-9);
    }
    expect(values.at(-1)).toBe(20);
  });
});

/** Whether no value crosses `target` from the side `start` lies on. */
function neverPasses(values: readonly number[], start: number, target: number): boolean {
  const side = Math.sign(start - target);
  return values.every((value) => Math.sign(value - target) * side >= 0);
}

describe("a momentum move's contract, over random courses on the manual clock", () => {
  /** A course: a start, a first target with its delay and duration, frames, then retargets. */
  const course = fc.record({
    start: fc.double({ min: 0, max: SWEEP, noNaN: true }),
    first: fc.double({ min: 0, max: SWEEP, noNaN: true }),
    delay: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 300 })),
    duration: fc.constantFrom(480, 1000),
    frames: fc.integer({ min: 0, max: 40 }),
    ms: fc.integer({ min: 4, max: 40 }),
    targets: fc.array(fc.double({ min: 0, max: SWEEP, noNaN: true }), { minLength: 1, maxLength: 3 }),
  });

  it("never passes its target, never leaves the values it moved between, and rests on its target", () => {
    fc.assert(
      fc.property(course, ({ start, first, delay, duration, frames, ms, targets }) => {
        const mark = oneMark();
        mark.place(start, { kind: "snap" });
        mark.place(first, { kind: "enter", from: [start], delay, duration });
        for (let index = 0; index < frames; index += 1) mark.frame(ms);
        const shown = mark.drawn.at(-1) ?? Number.NaN;
        const from = mark.drawn.length;
        for (const target of targets) mark.place(target, { kind: "move", momentum: "keep" });
        const last = targets.at(-1) ?? Number.NaN;
        settle(mark, last, ms, 400);
        const values = after(mark, from);
        const low = Math.min(start, first, ...targets);
        const high = Math.max(start, first, ...targets);
        expect(neverPasses(values, shown, last)).toBe(true);
        for (const value of values) {
          expect(value).toBeGreaterThanOrEqual(Math.max(0, low) - 1e-9);
          expect(value).toBeLessThanOrEqual(Math.min(SWEEP, high) + 1e-9);
        }
        expect(values.at(-1)).toBe(last);
      })
    );
  });

  it("carries no velocity out of a delay it has not left: it moves only between where it waits and its target", () => {
    fc.assert(
      fc.property(course, ({ start, first, duration, ms, targets }) => {
        const delay = 300;
        const mark = oneMark();
        mark.place(start, { kind: "snap" });
        mark.place(first, { kind: "enter", from: [start], delay, duration });
        // Frames that stay inside the delay.
        const frames = Math.floor((delay - 1) / ms);
        for (let index = 0; index < frames; index += 1) mark.frame(ms);
        expect(mark.drawn.every((value) => value === start)).toBe(true);
        const from = mark.drawn.length;
        for (const target of targets) mark.place(target, { kind: "move", momentum: "keep" });
        const last = targets.at(-1) ?? Number.NaN;
        settle(mark, last, ms, 400);
        for (const value of after(mark, from)) {
          expect(value).toBeGreaterThanOrEqual(Math.min(start, last) - 1e-9);
          expect(value).toBeLessThanOrEqual(Math.max(start, last) + 1e-9);
        }
      })
    );
  });
});
