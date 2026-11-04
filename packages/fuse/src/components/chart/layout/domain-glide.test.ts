import { describe, expect, it } from "vitest";

import frames from "../../../../test/chart/motion-frames.json" with { type: "json" };
import type { MotionHost } from "../chart-motion";
import { createDomainGlide } from "./domain-glide";

/** A hand-driven clock with one queue of frames, run at a chosen time. */
function clock() {
  let time = 0;
  let queue: ((time: number) => void)[] = [];
  const host: MotionHost = {
    now: () => time,
    requestFrame: (callback) => queue.push(callback),
    cancelFrame: () => {
      queue = [];
    },
  };
  return {
    host,
    at: (ms: number) => {
      time = ms;
      const due = queue;
      queue = [];
      for (const callback of due) callback(time);
    },
  };
}

/** The oracle's eased progress, from its hand-written line positions on cubic-bezier(0, 0.7, 0.5, 1). */
function eased(ms: 120 | 240 | 360): number {
  const { from, to, at } = frames.references.line;
  return (at[ms] - from) / (to - from);
}

describe("the domain glide", () => {
  // Unit under test: createDomainGlide. Oracle: motion-frames.json's eased progress at 120, 240 and
  // 360 ms of the 480 ms update, which a Python script wrote by hand from the update curve.
  it("glides from the drawn domains to the new ones over 480 ms on the update curve", () => {
    const { host, at } = clock();
    const glide = createDomainGlide({ x: [0, 10], y: [0, 100] }, host);
    glide.to({ x: [0, 20], y: [-100, 100] }, "glide");
    at(0);
    expect(glide.get()).toEqual({ x: [0, 10], y: [0, 100] });
    at(240);
    expect(glide.get().x[1]).toBeCloseTo(10 + 10 * eased(240), 6);
    expect(glide.get().y[0]).toBeCloseTo(-100 * eased(240), 6);
    at(480);
    expect(glide.get()).toEqual({ x: [0, 20], y: [-100, 100] });
  });

  it("retargets from where a glide has got to", () => {
    const { host, at } = clock();
    const glide = createDomainGlide({ x: [0, 10], y: [0, 1] }, host);
    glide.to({ x: [0, 20], y: [0, 1] }, "glide");
    at(0);
    at(120);
    const reached = 10 + 10 * eased(120);
    glide.to({ x: [0, 10], y: [0, 1] }, "glide");
    at(120);
    expect(glide.get().x[1]).toBeCloseTo(reached, 6);
    at(360);
    expect(glide.get().x[1]).toBeCloseTo(reached + (10 - reached) * eased(240), 6);
  });

  it("snaps at once, and tells its listeners once per change", () => {
    const { host } = clock();
    const glide = createDomainGlide({ x: [0, 10], y: [0, 1] }, host);
    let heard = 0;
    glide.subscribe(() => {
      heard += 1;
    });
    glide.to({ x: [0, 5], y: [0, 1] }, "snap");
    glide.to({ x: [0, 5], y: [0, 1] }, "snap");
    expect(glide.get()).toEqual({ x: [0, 5], y: [0, 1] });
    expect(heard).toBe(1);
  });
});
