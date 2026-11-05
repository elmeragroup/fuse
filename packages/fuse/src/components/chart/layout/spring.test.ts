// Unit under test: springEasing, a spring sampled as a CSS linear() easing. Oracle: the closed-form
// response of a damped oscillator of mass 1 released from rest at 0 towards 1, x'' = k(1 - x) - c x',
// in test/chart/oscillator.ts. The test evaluates the linear() stops as CSS Easing 2 defines them,
// a piecewise-linear curve through each stop, and needs the curve within 0.5% of the
// travel of the oscillator at every sampled moment, and the duration to end once the oscillator stays
// within 0.1% of its target. followSpring is checked against the same oscillator and the owner's
// decision for pointer-paced steps: 300/30 for keyboard and slow steps, a stiffest spring
// that settles in about 120 ms, and one damping ratio throughout.
import { describe, expect, it } from "vitest";

import { oscillator, settling } from "../../../../test/chart/oscillator";
import { CHART_SPRINGS } from "./motion";
import { easingCurve, followSpring, springEasing } from "./spring";

/** A CSS linear() easing's output at input progress `p`, per CSS Easing 2. */
function evaluateLinear(easing: string, p: number): number {
  const body = /^linear\((.*)\)$/u.exec(easing)?.[1];
  if (body === undefined) throw new Error(`not a linear() easing: ${easing}`);
  const stops = body.split(",").map((entry) => entry.trim().split(/\s+/u));
  // Stops without an input spread evenly between their neighbours; the sampler writes every input
  // but the first and the last.
  const points = stops.map(([output = "0", input], index) => ({
    output: Number(output),
    input:
      input === undefined
        ? index === 0
          ? 0
          : index === stops.length - 1
            ? 1
            : Number.NaN
        : Number.parseFloat(input) / 100,
  }));
  if (points.some(({ input }) => Number.isNaN(input))) throw new Error(`a stop without its input: ${easing}`);
  for (let index = 1; index < points.length; index += 1) {
    const [before, after] = [points[index - 1], points[index]];
    if (before === undefined || after === undefined) continue;
    if (p <= after.input) {
      const span = after.input - before.input;
      return span === 0
        ? after.output
        : before.output + ((p - before.input) / span) * (after.output - before.output);
    }
  }
  return points.at(-1)?.output ?? 1;
}

const CASES = [
  // The follow spring, which the crosshair and the active dots follow a slow step on.
  ["the follow spring", CHART_SPRINGS.follow, 300, 30],
  ["the tooltip", CHART_SPRINGS.glide, 100, 20],
  ["the slot label", CHART_SPRINGS.ticker, 400, 35],
  ["a bouncy spring", { stiffness: 400, damping: 25 }, 400, 25],
  ["an overdamped spring", { stiffness: 100, damping: 40 }, 100, 40],
] as const;

describe("springEasing", () => {
  it.each(CASES)("keeps %s on the oscillator's path at every moment", (_name, spring, stiffness, damping) => {
    expect([spring.stiffness, spring.damping]).toEqual([stiffness, damping]);
    const { duration, easing } = springEasing(spring);
    for (let step = 0; step <= 200; step += 1) {
      const progress = step / 200;
      const expected = oscillator(stiffness, damping, (progress * duration) / 1000);
      expect(
        Math.abs(evaluateLinear(easing, progress) - expected),
        `at ${String(progress * duration)} ms`
      ).toBeLessThan(0.005);
    }
  });

  it.each(CASES)(
    "ends %s once the oscillator stays within 0.1% of its target",
    (_name, spring, stiffness, damping) => {
      const { duration, easing } = springEasing(spring);
      expect(evaluateLinear(easing, 0)).toBe(0);
      expect(evaluateLinear(easing, 1)).toBe(1);
      // Past the duration the oscillator never strays 0.1% from its target, and some moment in the
      // last 50 ms before it still did, so the curve ends no later than it must.
      for (let ms = duration; ms <= duration + 2000; ms += 1) {
        expect(Math.abs(1 - oscillator(stiffness, damping, ms / 1000)), `at ${String(ms)} ms`).toBeLessThan(
          0.001
        );
      }
      const late = Array.from({ length: 50 }, (_, index) => duration - 1 - index);
      expect(late.some((ms) => Math.abs(1 - oscillator(stiffness, damping, ms / 1000)) >= 0.001)).toBe(true);
    }
  );

  // Unit under test: easingCurve, which plays the stops springEasing keeps as numbers. Oracle: the
  // easing string the browser plays, evaluated as CSS Easing 2 defines it.
  it.each(CASES)("plays %s's stops exactly as the browser plays its easing", (_name, spring) => {
    const { easing, stops } = springEasing(spring);
    const played = easingCurve(stops);
    for (let step = 0; step <= 1000; step += 1) {
      expect(played(step / 1000), String(step / 1000)).toBeCloseTo(evaluateLinear(easing, step / 1000), 12);
    }
  });

  it("overshoots its target where the oscillator does and never where it does not", () => {
    const peak = (easing: string) =>
      Math.max(...Array.from({ length: 1001 }, (_, step) => evaluateLinear(easing, step / 1000)));
    // Damping ratio 0.625 passes the target by e^(-0.625π/√(1-0.625²)), 8.1%. The tooltip's spring
    // is critically damped, so its glide never passes the place it rests on.
    expect(peak(springEasing({ stiffness: 400, damping: 25 }).easing)).toBeCloseTo(1.081, 2);
    expect(peak(springEasing(CHART_SPRINGS.glide).easing)).toBeLessThanOrEqual(1);
  });
});

describe("followSpring", () => {
  // Pointer speeds in CSS pixels per millisecond: a slow scrub, a steady sweep and a flick.
  const speeds = [0, 0.1, 0.5, 1, 1.5, 2, 2.5, 5, 50];

  it("follows a keyboard step and a slow pointer on 300/30", () => {
    for (const speed of [null, 0, 0.1]) {
      const { stiffness, damping } = followSpring(speed);
      expect([stiffness, damping], String(speed)).toEqual([300, 30]);
    }
  });

  it("settles a flick in about 120 ms, and never slower as the pointer speeds up", () => {
    const times = speeds.map((speed) => {
      const { stiffness, damping } = followSpring(speed);
      return settling(stiffness, damping);
    });
    expect(times[0]).toBe(506);
    expect(Math.abs((times.at(-1) ?? 0) - 120)).toBeLessThanOrEqual(5);
    times.forEach((time, index) => {
      expect(time, String(speeds[index])).toBeLessThanOrEqual(times[index - 1] ?? time);
    });
  });

  it("keeps 300/30's damping ratio, so no speed overshoots more than a slow step does", () => {
    const ratio = 30 / (2 * Math.sqrt(300));
    for (const speed of speeds) {
      const { stiffness, damping } = followSpring(speed);
      expect(damping / (2 * Math.sqrt(stiffness)), String(speed)).toBeCloseTo(ratio, 6);
    }
  });
});
