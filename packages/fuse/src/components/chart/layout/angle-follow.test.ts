// The polar follower's spring. Unit under test: angle-follow.ts. Oracles, worked by hand: a
// critically damped spring, ζ = 1 and ω = 20, released 10° from its target from rest, is
// (10 + 200 · 0.05) · e⁻¹ = 20/e° away after 50 ms; an underdamped spring's first overshoot, at
// t = π/ω_d, is e^(−πζ/√(1−ζ²)) of the release, 0.43% for 300/30; and an overdamped spring from rest
// replays `springPosition`, the spring easings' own closed form, mirrored.
import { describe, expect, it } from "vitest";

import { followSettled, followStep, shortTarget } from "./angle-follow";
import { springPosition } from "./spring";

describe("followStep", () => {
  it("moves a critically damped spring 20/e° from a 10° release after 50 ms", () => {
    const { angle } = followStep({ angle: 10, velocity: 0 }, 0, 50, { stiffness: 400, damping: 40 });
    expect(angle).toBeCloseTo(20 / Math.E, 9);
  });

  it("overshoots a 300/30 spring by 0.43% of its release at its first turn", () => {
    const zeta = 30 / (2 * Math.sqrt(300));
    const damped = Math.sqrt(300) * Math.sqrt(1 - zeta * zeta);
    const { angle, velocity } = followStep({ angle: 100, velocity: 0 }, 0, (1000 * Math.PI) / damped, {
      stiffness: 300,
      damping: 30,
    });
    expect(angle).toBeCloseTo(-100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)), 9);
    // The turn is where the velocity crosses zero.
    expect(velocity).toBeCloseTo(0, 9);
  });

  it("replays an overdamped spring's release from rest", () => {
    const spring = { stiffness: 100, damping: 40 };
    for (const ms of [10, 50, 200]) {
      const { angle } = followStep({ angle: 30, velocity: 0 }, 90, ms, spring);
      expect(angle).toBeCloseTo(30 + 60 * springPosition(spring, ms / 1000), 9);
    }
  });

  it("keeps a glide's angle and velocity bit-equal across a retarget", () => {
    const spring = { stiffness: 807, damping: 49 };
    const mid = followStep({ angle: 0, velocity: 0 }, 90, 40, spring);
    expect(followStep(mid, 120, 0, spring)).toBe(mid);
    // The next frame starts from that angle and speed: a spring released from rest at the same
    // angle would move the other way at first only if the speed were lost.
    const next = followStep(mid, 120, 16, spring);
    const fromRest = followStep({ angle: mid.angle, velocity: 0 }, 120, 16, spring);
    expect(next.angle - mid.angle).toBeGreaterThan(fromRest.angle - mid.angle);
  });
});

describe("shortTarget", () => {
  it.each([
    [350, 10, 370],
    [10, 350, -10],
    [725, 0, 720],
    [0, 180, 180],
    [0, -180, 180],
    [90, 270, 270],
  ])("unwraps %s → %s to %s, a half turn clockwise", (shown, target, expected) => {
    expect(shortTarget(shown, target)).toBe(expected);
  });
});

describe("followSettled", () => {
  it.each([
    [{ angle: 90.005, velocity: 0.05 }, true],
    [{ angle: 90.02, velocity: 0 }, false],
    [{ angle: 90, velocity: 0.2 }, false],
  ])("reads %o as settled at 90°: %s", (state, expected) => {
    expect(followSettled(state, 90)).toBe(expected);
  });
});
