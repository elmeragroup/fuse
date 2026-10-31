// Unit under test: Root's animation loop. Oracles: test/chart/motion-frames.json, whose midpoints
// .scratch/charts-v1/tools/l05-oracles/motion_fixture.py writes by hand from 480 ms on
// cubic-bezier(0, 0.7, 0.5, 1) for a reference line moving from 0.5 to 0.7, and the rules of
// .scratch/charts-v1/reviews/motion-decision.md: a second update continues from the drawn value,
// reduced motion and a range step draw the target at once. The host is a hand-driven clock.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import frames from "../../../test/chart/motion-frames.json" with { type: "json" };
import { SAME_PLOT, createChartMotion, createFrameOwner } from "./chart-motion";
import type { MarkValues, Placement } from "./chart-motion";

/** A clock and a frame queue that the test advances by hand. */
function host() {
  let now = 0;
  let queued: ((time: number) => void) | null = null;
  return {
    host: {
      now: () => now,
      requestFrame: (callback: (time: number) => void) => {
        queued = callback;
        return 1;
      },
      cancelFrame: () => {
        queued = null;
      },
    },
    /** Run the next frame at a time. */
    frameAt(time: number): void {
      now = time;
      const callback = queued;
      queued = null;
      callback?.(time);
    },
    pending: () => queued !== null,
  };
}

const { from, to, at } = frames.references.line;

/** The oracle's eased progress at a time, from its hand-written line positions. */
function eased(ms: 120 | 240 | 360): number {
  return (at[ms] - from) / (to - from);
}

/** A mark that records what the loop wrote. */
function recorder() {
  const writes: number[] = [];
  return { writes, write: (values: MarkValues) => writes.push(values[0] ?? Number.NaN) };
}

describe("the motion loop", () => {
  it("draws a snap at once and schedules no frame", () => {
    const clock = host();
    const motion = createChartMotion(clock.host);
    const mark = recorder();
    motion.place("line", [from], mark.write, { kind: "snap" });
    expect(mark.writes).toEqual([from]);
    expect(clock.pending()).toBe(false);
  });

  it("moves a data update through the oracle's midpoints and ends on the target", () => {
    const clock = host();
    const motion = createChartMotion(clock.host);
    const mark = recorder();
    motion.place("line", [from], mark.write, { kind: "snap" });
    motion.place("line", [to], mark.write, { kind: "move" });
    // The update rewinds the mark to what it drew before the browser paints.
    expect(mark.writes.at(-1)).toBe(from);
    for (const ms of [120, 240, 360] as const) {
      clock.frameAt(ms);
      expect(mark.writes.at(-1), String(ms)).toBeCloseTo(at[ms], 6);
    }
    clock.frameAt(480);
    expect(mark.writes.at(-1)).toBe(to);
    expect(clock.pending()).toBe(false);
  });

  it("continues a second update from the drawn value, with no jump", () => {
    const clock = host();
    const motion = createChartMotion(clock.host);
    const mark = recorder();
    motion.place("line", [from], mark.write, { kind: "snap" });
    motion.place("line", [to], mark.write, { kind: "move" });
    clock.frameAt(240);
    const drawn = mark.writes.at(-1) ?? Number.NaN;
    expect(drawn).toBeCloseTo(at[240], 6);
    // The second update heads back to the first value, from where the mark is.
    motion.place("line", [from], mark.write, { kind: "move" });
    expect(mark.writes.at(-1)).toBe(drawn);
    // Its first frame draws the same value, and later frames head back toward 0.5.
    clock.frameAt(240);
    expect(mark.writes.at(-1)).toBe(drawn);
    clock.frameAt(360);
    const later = mark.writes.at(-1) ?? Number.NaN;
    expect(later).toBeLessThan(drawn);
    expect(later).toBeGreaterThan(from);
    clock.frameAt(240 + 480);
    expect(mark.writes.at(-1)).toBe(from);
  });

  it("lets a running update finish when a resize places the same target", () => {
    const clock = host();
    const motion = createChartMotion(clock.host);
    const mark = recorder();
    motion.place("line", [from], mark.write, { kind: "snap" });
    motion.place("line", [to], mark.write, { kind: "move" });
    clock.frameAt(120);
    // The re-render drew the target, so the new writer redraws the tween's value at once, and the
    // tween keeps its clock: 240 ms in is the oracle's 240 ms value, not a fresh start's.
    const redrawn = recorder();
    motion.place("line", [to], redrawn.write, { kind: "settle", scale: SAME_PLOT });
    expect(redrawn.writes).toHaveLength(1);
    expect(redrawn.writes[0]).toBeCloseTo(at[120], 6);
    clock.frameAt(240);
    expect(redrawn.writes.at(-1)).toBeCloseTo(at[240], 6);
    expect(mark.writes.at(-1)).toBeCloseTo(at[120], 6);
  });

  it("starts every mark one commit places on one clock, so marks with equal numbers draw alike", () => {
    // The clock reads 0 when the first mark is placed and 5 by the second, in the same task.
    let now = 0;
    const queued: ((time: number) => void)[] = [];
    const motion = createChartMotion({
      now: () => now,
      requestFrame: (callback) => queued.push(callback),
      cancelFrame: () => undefined,
    });
    const first = recorder();
    const second = recorder();
    motion.place("bar", [from], first.write, { kind: "snap" });
    motion.place("guide", [from], second.write, { kind: "snap" });
    motion.place("bar", [to], first.write, { kind: "move" });
    now = 5;
    motion.place("guide", [to], second.write, { kind: "move" });
    now = 120;
    queued.at(-1)?.(120);
    expect(first.writes.at(-1)).toBeCloseTo(at[120], 6);
    expect(second.writes.at(-1)).toBe(first.writes.at(-1));
  });

  it("draws every update at once under reduced motion", () => {
    const clock = host();
    const motion = createChartMotion(clock.host, true);
    const mark = recorder();
    motion.place("line", [from], mark.write, { kind: "snap" });
    motion.place("line", [to], mark.write, { kind: "move" });
    expect(mark.writes).toEqual([from, to]);
    expect(clock.pending()).toBe(false);
  });

  it("holds an entering mark at its start until its delay passes", () => {
    const clock = host();
    const motion = createChartMotion(clock.host);
    const mark = recorder();
    motion.place("bar", [10], mark.write, { kind: "enter", from: [0], delay: 32 });
    clock.frameAt(32);
    expect(mark.writes.at(-1)).toBe(0);
    clock.frameAt(32 + 480);
    expect(mark.writes.at(-1)).toBe(10);
  });

  it("draws every moving mark at its target when a range step finishes them", () => {
    const clock = host();
    const motion = createChartMotion(clock.host);
    const mark = recorder();
    motion.place("line", [from], mark.write, { kind: "snap" });
    motion.place("line", [to], mark.write, { kind: "move" });
    clock.frameAt(120);
    motion.finish();
    expect(mark.writes.at(-1)).toBe(to);
    expect(clock.pending()).toBe(false);
  });

  it("keeps a bar and a guide at one value together when a width-only resize retargets the bar at 120 ms", () => {
    // B3-2: both head from 100 to 140 px. At 120 ms the plot's width doubles, so the bar's x and
    // width double and its y keeps its target, and the guide keeps its whole target. At 240 ms both
    // sit at 100 + 40 times the oracle's eased progress at 240 ms.
    const clock = host();
    const motion = createChartMotion(clock.host);
    const bar: number[][] = [];
    const guide: number[][] = [];
    const drawBar = (values: MarkValues) => bar.push([...values]);
    const drawGuide = (values: MarkValues) => guide.push([...values]);
    // The bar's x and width run along x, and its y and the guide's along y.
    motion.place("bar", [10, 100, 20], drawBar, { kind: "snap" }, { axes: ["x", "y", "x"] });
    motion.place("guide", [100], drawGuide, { kind: "snap" }, { axes: ["y"] });
    motion.place("bar", [10, 140, 20], drawBar, { kind: "move" }, { axes: ["x", "y", "x"] });
    motion.place("guide", [140], drawGuide, { kind: "move" }, { axes: ["y"] });
    clock.frameAt(120);
    // The plot doubles its width, which leaves y alone.
    motion.place(
      "bar",
      [20, 140, 40],
      drawBar,
      { kind: "settle", scale: { x: 2, y: 1 } },
      { axes: ["x", "y", "x"] }
    );
    clock.frameAt(240);
    const expected = 100 + 40 * eased(240);
    expect(bar.at(-1)?.[1]).toBeCloseTo(expected, 6);
    expect(guide.at(-1)?.[0]).toBe(bar.at(-1)?.[1]);
  });

  it("maps each frame's running tweens by that frame's own resize (E6)", () => {
    // Two Panels each tween a bar's tip from 0 toward 100 px. At 120 ms the first Panel doubles its
    // height and the second halves it, so the first bar heads for 200 and the second for 50, and
    // each mark's drawn tip scales by its own Panel's factor only. At 480 ms each rests on its own
    // new target.
    const clock = host();
    const motion = createChartMotion(clock.host);
    const top = recorder();
    const bottom = recorder();
    const [upper, lower] = [createFrameOwner("panel"), createFrameOwner("panel")];
    motion.place("top", [0], top.write, { kind: "snap" }, { axes: ["y"], owner: upper });
    motion.place("bottom", [0], bottom.write, { kind: "snap" }, { axes: ["y"], owner: lower });
    motion.place("top", [100], top.write, { kind: "move" }, { axes: ["y"], owner: upper });
    motion.place("bottom", [100], bottom.write, { kind: "move" }, { axes: ["y"], owner: lower });
    clock.frameAt(120);
    const drawn = 100 * eased(120);
    motion.place(
      "top",
      [200],
      top.write,
      { kind: "settle", scale: { x: 1, y: 2, to: { at: 2 } } },
      { axes: ["y"], owner: upper }
    );
    expect(top.writes.at(-1)).toBeCloseTo(drawn * 2, 6);
    expect(bottom.writes.at(-1)).toBeCloseTo(drawn, 6);
    motion.place(
      "bottom",
      [50],
      bottom.write,
      { kind: "settle", scale: { x: 1, y: 0.5, to: { at: 0.5 } } },
      { axes: ["y"], owner: lower }
    );
    expect(bottom.writes.at(-1)).toBeCloseTo(drawn / 2, 6);
    expect(top.writes.at(-1)).toBeCloseTo(drawn * 2, 6);
    clock.frameAt(240);
    expect(top.writes.at(-1)).toBeCloseTo(200 * eased(240), 6);
    expect(bottom.writes.at(-1)).toBeCloseTo(50 * eased(240), 6);
    clock.frameAt(480);
    expect([top.writes.at(-1), bottom.writes.at(-1)]).toEqual([200, 50]);
  });

  it("restarts a running mark that a data update leaves alone, with the marks it moves", () => {
    // At 240 ms a second update retargets the bar and leaves the guide's target alone. Both start
    // over from what they drew, so 120 ms later the guide has covered the oracle's eased share of
    // the way that remained.
    const clock = host();
    const motion = createChartMotion(clock.host);
    const guide = recorder();
    const bar = recorder();
    motion.place("guide", [0], guide.write, { kind: "snap" });
    motion.place("bar", [0], bar.write, { kind: "snap" });
    motion.place("guide", [100], guide.write, { kind: "move" });
    motion.place("bar", [100], bar.write, { kind: "move" });
    clock.frameAt(240);
    const drawn = guide.writes.at(-1) ?? Number.NaN;
    expect(drawn).toBeCloseTo(100 * eased(240), 6);
    clock.frameAt(240);
    motion.place("bar", [50], bar.write, { kind: "move" });
    clock.frameAt(360);
    expect(guide.writes.at(-1)).toBeCloseTo(drawn + (100 - drawn) * eased(120), 6);
  });

  it("draws a bar's top and a guide at its value alike through any sequence of updates, resizes and frames", () => {
    // The guide follows the bar's value, so the two always share a target y. A commit places the
    // bar every time, and the guide only when its target changes, or by chance when a resize
    // re-renders it. Expectation: the bar's drawn y equals the guide's drawn y in every frame.
    const operation = fc.oneof(
      fc.record({
        kind: fc.constant("update" as const),
        y: fc.integer({ min: 0, max: 200 }),
        x: fc.integer({ min: 0, max: 400 }),
      }),
      fc.record({
        kind: fc.constant("resize" as const),
        scaleX: fc.double({ min: 0.25, max: 4, noNaN: true }),
        scaleY: fc.constantFrom(1, 0.5, 2, 1.5),
        placeGuide: fc.boolean(),
      }),
      fc.record({ kind: fc.constant("wait" as const), ms: fc.integer({ min: 1, max: 300 }) })
    );
    fc.assert(
      fc.property(fc.array(operation, { minLength: 1, maxLength: 12 }), (operations) => {
        const queued: ((time: number) => void)[] = [];
        let now = 0;
        const motion = createChartMotion({
          now: () => now,
          requestFrame: (callback) => queued.push(callback),
          cancelFrame: () => undefined,
        });
        // The numbers each mark last drew, in place order.
        let barDrawn: MarkValues = [0, 100, 20];
        let guideDrawn: MarkValues = [100];
        const drawBar = (values: MarkValues): void => {
          barDrawn = values;
        };
        const drawGuide = (values: MarkValues): void => {
          guideDrawn = values;
        };
        let target = { x: 0, y: 100, width: 20 };
        motion.place("bar", [target.x, target.y, target.width], drawBar, { kind: "snap" });
        motion.place("guide", [target.y], drawGuide, { kind: "snap" });
        const frame = (): void => {
          const callback = queued.pop();
          queued.length = 0;
          callback?.(now);
        };
        for (const step of operations) {
          if (step.kind === "wait") {
            now += step.ms;
            frame();
          } else {
            const next =
              step.kind === "update"
                ? { ...target, x: step.x, y: step.y }
                : { x: target.x * step.scaleX, y: target.y * step.scaleY, width: target.width * step.scaleX };
            const placement: Placement =
              step.kind === "update"
                ? { kind: "move" }
                : // Each resize is a measurement of its own, which names it, as Root's are.
                  { kind: "settle", scale: { x: step.scaleX, y: step.scaleY, to: {} } };
            motion.place("bar", [next.x, next.y, next.width], drawBar, placement, { axes: ["x", "y", "x"] });
            if (next.y !== target.y || (step.kind === "resize" && step.placeGuide)) {
              motion.place("guide", [next.y], drawGuide, placement, { axes: ["y"] });
            }
            target = next;
            // The commit's task ends before the next frame.
            now += 1;
          }
          expect(guideDrawn[0]).toBe(barDrawn[1]);
        }
        now += 1000;
        frame();
        expect([barDrawn[1], guideDrawn[0]]).toEqual([target.y, target.y]);
      })
    );
  });
});

describe("joining marks", () => {
  /** Two bars, each placed at a rest of [middle, tip] under its anchor. */
  function twoBars(motion: ReturnType<typeof createChartMotion>, placement: Placement) {
    motion.place("bar 0", [10, 50], () => undefined, placement, { anchor: "a 0" });
    motion.place("bar 1", [30, 70], () => undefined, placement, { anchor: "a 1" });
  }
  const leads = [
    { anchor: "a 0", pick: (values: MarkValues) => [...values], rest: (values: MarkValues) => [...values] },
    { anchor: "a 1", pick: (values: MarkValues) => [...values], rest: (values: MarkValues) => [...values] },
  ];

  it("rests a follower of two bars on both bars' rests, in their order (B2-4)", () => {
    const motion = createChartMotion(host().host);
    twoBars(motion, { kind: "snap" });
    const drawn: MarkValues[] = [];
    // The follower's own target, the slot centres, is not where the bars rest.
    motion.place("marker", [20, 50, 60, 70], (values) => drawn.push(values), { kind: "join", leads });
    expect(drawn.at(-1)).toEqual([10, 50, 30, 70]);
  });

  it("rests a joined follower on its bars' rests under reduced motion too (B2-5)", () => {
    const motion = createChartMotion(host().host);
    motion.setReduced(true);
    twoBars(motion, { kind: "move" });
    const drawn: MarkValues[] = [];
    motion.place("marker", [20, 50, 60, 70], (values) => drawn.push(values), { kind: "join", leads });
    expect(drawn).toEqual([[10, 50, 30, 70]]);
  });

  it("tweens a joined follower on its bars' clock from their drawn numbers to their rests", () => {
    const clock = host();
    const motion = createChartMotion(clock.host);
    twoBars(motion, { kind: "snap" });
    motion.place("bar 0", [20, 50], () => undefined, { kind: "move" }, { anchor: "a 0" });
    const drawn: MarkValues[] = [];
    motion.place("marker", [0, 0, 0, 0], (values) => drawn.push(values), { kind: "join", leads });
    // Bar 0 moves from 10 to 20 and bar 1 rests, so the follower starts on both drawn numbers.
    expect(drawn.at(-1)).toEqual([10, 50, 30, 70]);
    clock.frameAt(120);
    expect(drawn.at(-1)?.[0]).toBeCloseTo(10 + 10 * eased(120), 9);
    expect(drawn.at(-1)?.slice(1)).toEqual([50, 30, 70]);
  });
});

describe("joining staggered marks (Q3-1)", () => {
  it("draws each lead's numbers on that lead's own clock and delay", () => {
    // Two bars grow from 0 in an entrance, the second 200 ms after the first. At 120 ms the first
    // has its eased progress and the second still sits at 0, so the follower draws the same.
    const clock = host();
    const motion = createChartMotion(clock.host);
    motion.place(
      "bar 0",
      [10, 50],
      () => undefined,
      { kind: "enter", from: [10, 0], delay: 0 },
      { anchor: "a 0" }
    );
    motion.place(
      "bar 1",
      [30, 70],
      () => undefined,
      { kind: "enter", from: [30, 0], delay: 200 },
      { anchor: "a 1" }
    );
    const drawn: MarkValues[] = [];
    const lead = (anchor: string) => ({
      anchor,
      pick: (values: MarkValues) => [...values],
      rest: (values: MarkValues) => [...values],
    });
    motion.place("marker", [0, 0, 0, 0], (values) => drawn.push(values), {
      kind: "join",
      leads: [lead("a 0"), lead("a 1")],
    });
    expect(drawn.at(-1)).toEqual([10, 0, 30, 0]);
    clock.frameAt(120);
    expect(drawn.at(-1)?.[1]).toBeCloseTo(50 * eased(120), 6);
    expect(drawn.at(-1)?.slice(2)).toEqual([30, 0]);
    // 120 ms into the second bar's own tween it reaches the same eased share of 70.
    clock.frameAt(320);
    expect(drawn.at(-1)?.[3]).toBeCloseTo(70 * eased(120), 6);
    clock.frameAt(1000);
    expect(drawn.at(-1)).toEqual([10, 50, 30, 70]);
  });
});
