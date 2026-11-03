// Unit under test: springEasing, a spring sampled as a CSS linear() easing. Oracle: the closed-form
// response of a damped oscillator of mass 1 released from rest at 0 towards 1, x'' = k(1 - x) - c x',
// written out below for each damping regime. The test evaluates the linear() stops as CSS Easing 2
// defines them, a piecewise-linear curve through each stop, and needs the curve within 0.5% of the
// travel of the oscillator at every sampled moment, and the duration to end once the oscillator stays
// within 0.1% of its target.
import { describe, expect, it } from "vitest";

import { CHART_SPRINGS } from "./motion";
import { springEasing } from "./spring";

/** The oscillator's position at `t` seconds. */
function oscillator(stiffness: number, damping: number, t: number): number {
  const natural = Math.sqrt(stiffness);
  const ratio = damping / (2 * natural);
  if (ratio < 1) {
    const damped = natural * Math.sqrt(1 - ratio * ratio);
    const decay = Math.exp(-ratio * natural * t);
    return 1 - decay * (Math.cos(damped * t) + ((ratio * natural) / damped) * Math.sin(damped * t));
  }
  if (ratio === 1) return 1 - Math.exp(-natural * t) * (1 + natural * t);
  const root = natural * Math.sqrt(ratio * ratio - 1);
  const [fast, slow] = [-ratio * natural - root, -ratio * natural + root];
  return 1 - (fast * Math.exp(slow * t) - slow * Math.exp(fast * t)) / (fast - slow);
}

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
  ["the crosshair", CHART_SPRINGS.crosshair, 300, 30],
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

  it("overshoots its target where the oscillator does and never where it does not", () => {
    const peak = (easing: string) =>
      Math.max(...Array.from({ length: 1001 }, (_, step) => evaluateLinear(easing, step / 1000)));
    // Damping ratio 0.625 passes the target by e^(-0.625π/√(1-0.625²)), 8.1%. The tooltip's spring
    // is critically damped, so its glide never passes the place it rests on.
    expect(peak(springEasing({ stiffness: 400, damping: 25 }).easing)).toBeCloseTo(1.081, 2);
    expect(peak(springEasing(CHART_SPRINGS.glide).easing)).toBeLessThanOrEqual(1);
  });
});
