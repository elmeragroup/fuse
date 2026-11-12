// A live line chart's clock. Unit under test: createLiveClock, driven frame by frame through a fake
// host. Oracles: window ends read off the fake wall clock, domains worked out by hand from the
// readings with the 12 % margin (extent [0, 100] fits [−12, 112], [0, 200] fits [−24, 224],
// [0, 201] fits [−24.12, 225.12] and [0, 1000] fits [−120, 1120]),
// and the glide's midpoint on the CSS curve `cubic-bezier(0, 0.7, 0.5, 1)` that `--chart-ease`
// names, evaluated by `cubicBezier`, over the 480 ms that `--chart-update` names.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cubicBezier } from "./ease";
import { createLiveClock } from "./live-clock";
import type { LiveFrame } from "./live-clock";
import type { LiveClockHost, LiveFeed, LiveMode } from "./live-clock";
import { liveVertices } from "./live-window";
import type { LivePoint } from "./live-window";

/**
 * The values a frame draws that its domain does not hold: every vertex of its line, the entering
 * reading, the held readings and the tip among them, and the live dot. The invariant every frame
 * keeps is that there are none.
 */
function outside(frame: LiveFrame): number[] {
  const drawn = liveVertices(frame.points, frame.span, frame.now, frame.tip, frame.held).map(
    ({ value }) => value
  );
  if (frame.tip !== null) drawn.push(frame.tip.shown);
  return drawn.filter((value) => value < frame.domain[0] || value > frame.domain[1]);
}

const NOON = Date.UTC(2026, 9, 16, 12);
const SECOND = 1_000;

/** A host whose frames run when the test says, on a wall clock and a frame clock it sets. */
function fakeHost() {
  const frames = new Map<number, () => void>();
  let next = 0;
  const clocks = { epoch: NOON + 10 * SECOND, now: 0 };
  const host: LiveClockHost = {
    epoch: () => clocks.epoch,
    now: () => clocks.now,
    requestFrame: (callback) => {
      next += 1;
      frames.set(next, () => {
        callback(clocks.now);
      });
      return next;
    },
    cancelFrame: (handle) => {
      frames.delete(handle);
    },
  };
  /** Move both clocks on and run the frames that were waiting. */
  const advance = (ms: number): void => {
    clocks.epoch += ms;
    clocks.now += ms;
    const waiting = [...frames.values()];
    frames.clear();
    for (const run of waiting) run();
  };
  return { host, advance, pending: () => frames.size };
}

/** Readings of 0 at noon and 100 ten seconds later, in a 30 s window. */
const FEED: LiveFeed = {
  points: [
    { time: NOON, value: 0 },
    { time: NOON + 10 * SECOND, value: 100 },
  ],
  tip: 100,
  duration: 30 * SECOND,
};

/** FEED with a reading of 200 a second after its last. */
const RISEN: LiveFeed = {
  ...FEED,
  points: [...FEED.points, { time: NOON + 11 * SECOND, value: 200 }],
  tip: 200,
};

describe("createLiveClock", () => {
  it("rests at the latest reading until it runs, so the server and every browser draw alike", () => {
    const { host } = fakeHost();
    const clock = createLiveClock(host, FEED);
    expect(clock.get().now).toBe(NOON + 10 * SECOND);
    expect(clock.get().domain).toEqual([-12, 112]);
    expect(clock.get().tip).toEqual({ target: 100, shown: 100 });
  });

  it("ends the window at the wall clock on every frame, never before the latest reading", () => {
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    expect(clock.get().window).toEqual({ start: NOON - 20 * SECOND + 16, end: NOON + 10 * SECOND + 16 });
    advance(250);
    expect(clock.get().now).toBe(NOON + 10 * SECOND + 266);
    // A reading stamped ahead of the wall clock pulls the window's end up to it.
    clock.feed({ ...FEED, points: [...FEED.points, { time: NOON + 20 * SECOND, value: 50 }], tip: 50 });
    advance(16);
    expect(clock.get().now).toBe(NOON + 20 * SECOND);
  });

  it("glides the domain and the tip from what they show to the new fit on the update curve", () => {
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    clock.feed(RISEN);
    // The frame after the feed starts the glide where the domain showed.
    advance(16);
    expect(clock.get().domain).toEqual([-12, 112]);
    expect(clock.get().tip).toEqual({ target: 200, shown: 100 });
    advance(240);
    const eased = cubicBezier([0, 0.7, 0.5, 1])(0.5);
    const [low, high] = clock.get().domain;
    expect(low).toBeCloseTo(-12 - 12 * eased, 9);
    expect(high).toBeCloseTo(112 + 112 * eased, 9);
    expect(clock.get().tip?.shown).toBeCloseTo(100 + 100 * eased, 9);
    advance(240);
    expect(clock.get().domain).toEqual([-24, 224]);
    expect(clock.get().tip).toEqual({ target: 200, shown: 200 });
  });

  it("retargets a glide mid-way from where it got to, without a jump", () => {
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    clock.feed(RISEN);
    advance(16);
    advance(240);
    const before = clock.get().tip?.shown ?? 0;
    clock.feed({ ...RISEN, points: [...RISEN.points, { time: NOON + 12 * SECOND, value: 0 }], tip: 0 });
    advance(0);
    expect(clock.get().tip?.shown).toBe(before);
    advance(480);
    expect(clock.get().tip?.shown).toBe(0);
  });

  it("stays still under reduced motion: no frame runs, and each feed redraws once at the wall clock", () => {
    const { host, advance, pending } = fakeHost();
    const clock = createLiveClock(host, FEED);
    let drawn = 0;
    clock.subscribe(() => {
      drawn += 1;
    });
    clock.setMode("still");
    expect(pending()).toBe(0);
    expect(drawn).toBe(1);
    advance(5 * SECOND);
    expect(drawn).toBe(1);
    clock.feed(RISEN);
    expect(drawn).toBe(2);
    expect(clock.get().now).toBe(NOON + 15 * SECOND);
    expect(clock.get().domain).toEqual([-24, 224]);
    expect(clock.get().tip).toEqual({ target: 200, shown: 200 });
  });

  it("holds its frame while paused and glides to what it missed once it runs again", () => {
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    const held = clock.get();
    clock.setMode("paused");
    clock.feed(RISEN);
    advance(2 * SECOND);
    expect(clock.get()).toBe(held);
    clock.setMode("live");
    advance(16);
    expect(clock.get().now).toBe(NOON + 10 * SECOND + 2 * SECOND + 32);
    expect(clock.get().tip?.shown).toBe(100);
  });

  it("runs no frame while out of view or with no subscriber", () => {
    const { host, pending } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.setMode("live");
    expect(pending()).toBe(0);
    const stop = clock.subscribe(() => undefined);
    expect(pending()).toBe(1);
    clock.setVisible(false);
    expect(pending()).toBe(0);
    clock.setVisible(true);
    expect(pending()).toBe(1);
    stop();
    expect(pending()).toBe(0);
  });

  it("settles the domain and the tip on their targets when reduced motion takes over mid-glide", () => {
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    clock.feed(RISEN);
    advance(16);
    advance(120);
    clock.setMode("still");
    expect(clock.get().domain).toEqual([-24, 224]);
    expect(clock.get().tip).toEqual({ target: 200, shown: 200 });
  });

  it("glides a reading a newer one overtakes from where it showed, inside the domain all the way", () => {
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    clock.feed(RISEN);
    advance(16);
    advance(120);
    const overtaken = NOON + 11 * SECOND;
    const before = clock.get().held.get(overtaken);
    // 200 has risen part of the way from 100 when 300 arrives a second later.
    expect(before).toBeGreaterThan(100);
    expect(before).toBeLessThan(200);
    clock.feed({ ...RISEN, points: [...RISEN.points, { time: NOON + 12 * SECOND, value: 300 }], tip: 300 });
    advance(0);
    expect(clock.get().held.get(overtaken)).toBe(before);
    for (let step = 0; step < 15; step += 1) {
      expect(outside(clock.get())).toEqual([]);
      advance(40);
    }
    // At rest the reading holds its own value, and the domain fits [0, 300] with its 12 % margin.
    expect(clock.get().held.has(overtaken)).toBe(false);
    expect(clock.get().domain).toEqual([-36, 336]);
  });

  it("fits the domain to the segment entering at the left edge, by its outer reading", () => {
    // In a 5 s window ending at 10 s, the line enters from 1000 at 0 s and runs down to 0 at 10 s,
    // so the window shows values up to 500 at its left edge, which the outer reading bounds.
    const { host } = fakeHost();
    const clock = createLiveClock(host, {
      points: [
        { time: NOON, value: 1000 },
        { time: NOON + 10 * SECOND, value: 0 },
      ],
      tip: 0,
      duration: 5 * SECOND,
    });
    expect(clock.get().span).toEqual({ first: 1, end: 2 });
    expect(clock.get().domain).toEqual([-120, 1120]);
  });

  it("lets every reading's glide end within the update duration, however fast readings arrive", () => {
    // Readings every 100 ms for 100 s. A glide starts in the frame after its reading and lasts
    // 480 ms, so at any frame only the readings of the last 480 ms, at most five, still glide.
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    let points = FEED.points;
    let most = 0;
    for (let step = 1; step <= 1_000; step += 1) {
      const value = step % 2 === 0 ? 0 : 100;
      points = [...points, { time: NOON + 10 * SECOND + step * 100, value }];
      clock.feed({ points, tip: value, duration: 30 * SECOND });
      advance(100);
      most = Math.max(most, clock.get().held.size);
    }
    expect(most).toBeLessThanOrEqual(5);
    advance(480);
    expect(clock.get().held.size).toBe(0);
  });

  it("knows a reading by its time, so it glides when Root's value sets the tip apart", () => {
    // A reading of 200 arrives while Root's value says 201: the reading grows from the line's end,
    // 100, to 200, the tip from 100 to 201, both on the update curve.
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, FEED);
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    clock.feed({ ...RISEN, tip: 201 });
    advance(16);
    advance(240);
    const eased = cubicBezier([0, 0.7, 0.5, 1])(0.5);
    expect(clock.get().held.get(NOON + 11 * SECOND)).toBeCloseTo(100 + 100 * eased, 9);
    expect(clock.get().tip?.shown).toBeCloseTo(100 + 101 * eased, 9);
    advance(240);
    expect(clock.get().held.size).toBe(0);
    expect(clock.get().tip).toEqual({ target: 201, shown: 201 });
    const [low, high] = clock.get().domain;
    expect(low).toBeCloseTo(-24.12, 9);
    expect(high).toBeCloseTo(225.12, 9);
  });

  it("holds a batch's middle reading in the domain from the first frame that draws it", () => {
    // From a flat 0, whose domain is [−1, 1], readings of 100 and 0 arrive at once. Only the newest
    // glides, so the 100 draws at once, and the domain's glide, which starts at [−1, 1], widens to
    // it: [−1, 100].
    const { host, advance } = fakeHost();
    const clock = createLiveClock(host, {
      points: [{ time: NOON, value: 0 }],
      tip: 0,
      duration: 30 * SECOND,
    });
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    expect(clock.get().domain).toEqual([-1, 1]);
    clock.feed({
      points: [
        { time: NOON, value: 0 },
        { time: NOON + SECOND, value: 100 },
        { time: NOON + 2 * SECOND, value: 0 },
      ],
      tip: 0,
      duration: 30 * SECOND,
    });
    advance(16);
    expect(clock.get().domain).toEqual([-1, 100]);
    // The spike leaves. The domain eases back from what it showed: unmoved in a frame at +0 ms, and
    // half-way through the 480 ms on the curve, its top at 100 + (1 − 100) × eased.
    clock.feed({
      points: [
        { time: NOON, value: 0 },
        { time: NOON + 2 * SECOND, value: 0 },
      ],
      tip: 0,
      duration: 30 * SECOND,
    });
    advance(0);
    expect(clock.get().domain).toEqual([-1, 100]);
    advance(240);
    const eased = cubicBezier([0, 0.7, 0.5, 1])(0.5);
    const [low, high] = clock.get().domain;
    expect(low).toBe(-1);
    expect(high).toBeCloseTo(100 - 99 * eased, 9);
    expect(high).toBeGreaterThan(1);
    expect(high).toBeLessThan(100);
  });

  it("holds a reading in the domain as its glide ends while the domain still eases", () => {
    // A 1 s window: 100 arrives, and 40 ms later the expired 0 leaves as 99.99 arrives, so the
    // domain eases toward [99.99 ± a tenth] while 100 still draws.
    const { host, advance } = fakeHost();
    const start = NOON + 10 * SECOND;
    const clock = createLiveClock(host, {
      points: [{ time: start - SECOND, value: 0 }],
      tip: 0,
      duration: SECOND,
    });
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    const hundred = { time: start + 16, value: 100 };
    clock.feed({ points: [{ time: start - SECOND, value: 0 }, hundred], tip: 100, duration: SECOND });
    advance(40);
    clock.feed({ points: [hundred, { time: start + 56, value: 99.99 }], tip: 99.99, duration: SECOND });
    for (let step = 0; step < 40; step += 1) {
      advance(16);
      expect(outside(clock.get())).toEqual([]);
    }
  });

  it("glides a correction that arrives with a newer reading from where it showed", () => {
    // A reading at 1 s glides from 0 to 100. 100 ms in, it is corrected to 0 as a reading at 1.1 s
    // arrives: it turns back from where it got to and reaches 0 within 480 ms of the correction.
    const { host, advance } = fakeHost();
    const at = NOON + SECOND;
    const base = { time: NOON, value: 0 };
    const clock = createLiveClock(host, { points: [base], tip: 0, duration: 30 * SECOND });
    clock.subscribe(() => undefined);
    clock.setMode("live");
    advance(16);
    clock.feed({ points: [base, { time: at, value: 100 }], tip: 100, duration: 30 * SECOND });
    advance(16);
    advance(100);
    const before = clock.get().held.get(at) ?? Number.NaN;
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(100);
    clock.feed({
      points: [base, { time: at, value: 0 }, { time: at + 100, value: 0 }],
      tip: 0,
      duration: 30 * SECOND,
    });
    advance(0);
    expect(clock.get().held.get(at)).toBe(before);
    advance(240);
    const eased = cubicBezier([0, 0.7, 0.5, 1])(0.5);
    expect(clock.get().held.get(at)).toBeCloseTo(before - before * eased, 9);
    advance(240);
    expect(clock.get().held.has(at)).toBe(false);
  });

  it("draws every frame inside its domain, whatever the feed and the mode do", () => {
    // Oracle: the invariants themselves. Every value a frame draws lies inside the domain it shows,
    // and a loop frame that no time separates from the loop frame before never shows a narrower domain.
    const value = fc.integer({ min: -1_000, max: 1_000 });
    const step = fc.oneof(
      fc.record({
        kind: fc.constant("append" as const),
        values: fc.array(value, { minLength: 1, maxLength: 3 }),
        gap: fc.integer({ min: 1, max: 2_000 }),
      }),
      fc.record({ kind: fc.constant("correct" as const), pick: fc.nat(), value }),
      fc.record({ kind: fc.constant("drop" as const), count: fc.integer({ min: 1, max: 3 }) }),
      fc.record({ kind: fc.constant("value" as const), value: fc.option(value, { nil: undefined }) }),
      fc.record({
        kind: fc.constant("mode" as const),
        mode: fc.constantFrom<LiveMode>("live", "still", "paused"),
      }),
      fc.record({
        kind: fc.constant("advance" as const),
        ms: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 600 })),
      })
    );
    fc.assert(
      fc.property(
        value,
        fc.constantFrom(SECOND, 5 * SECOND),
        fc.array(step, { maxLength: 60 }),
        (first, duration, steps) => {
          const { host, advance } = fakeHost();
          let points: LivePoint[] = [{ time: NOON + 10 * SECOND, value: first }];
          let standalone: number | undefined;
          const feedOf = (): LiveFeed => ({
            points,
            tip: points.length === 0 ? null : (standalone ?? points.at(-1)?.value ?? null),
            duration,
          });
          const clock = createLiveClock(host, feedOf());
          clock.subscribe(() => undefined);
          clock.setMode("live");
          let mode: LiveMode = "live";
          let before = { at: host.now(), domain: clock.get().domain };
          for (const next of steps) {
            const shown = clock.get();
            switch (next.kind) {
              case "append": {
                let time = points.at(-1)?.time ?? NOON + 10 * SECOND;
                const added = next.values.map((each) => {
                  time += next.gap;
                  return { time, value: each };
                });
                points = [...points, ...added];
                break;
              }
              case "correct": {
                const index = points.length === 0 ? -1 : next.pick % points.length;
                points = points.map((point, at) =>
                  at === index ? { time: point.time, value: next.value } : point
                );
                break;
              }
              case "drop":
                points = points.slice(next.count);
                break;
              case "value":
                standalone = next.value;
                break;
              case "mode":
                clock.setMode(next.mode);
                mode = next.mode;
                break;
              case "advance":
                advance(next.ms);
                break;
            }
            if (next.kind !== "mode" && next.kind !== "advance") clock.feed(feedOf());
            expect(outside(clock.get())).toEqual([]);
            if (next.kind === "advance" && mode === "live") {
              const { domain } = clock.get();
              if (host.now() === before.at) {
                expect(domain[0]).toBeLessThanOrEqual(before.domain[0]);
                expect(domain[1]).toBeGreaterThanOrEqual(before.domain[1]);
              }
              before = { at: host.now(), domain };
            } else if (clock.get() !== shown) {
              // A frame drawn outside the loop rests on its target, as reduced motion and a first
              // reading do, so the next loop frame compares with nothing before it.
              before = { at: Number.NaN, domain: clock.get().domain };
            }
          }
        }
      ),
      { seed: 20261018, numRuns: 500 }
    );
  });
});
