/**
 * The fill of a root without one, such as a ghost Button, against what a real file showed on
 * 2026-10-20: Figma drew a focus ring's spread over a fill at alpha 0.001 and not over a fill at
 * alpha 0. The fill must also change no pixel, so it moves no 8-bit channel by half a step.
 */
import { describe, expect, it } from "vitest";

import type { ShadowSpec } from "../../src/components/kit-spec.ts";
import { rootFill } from "./root-layer.ts";

const RING: ShadowSpec = {
  color: { kind: "variable", variable: { collection: "Fuse tokens", name: "ring" } },
  offsetX: 0,
  offsetY: 0,
  radius: { kind: "literal", value: 0 },
  spread: { kind: "literal", value: 2 },
};

describe("rootFill", () => {
  it("gives a ringed root without a fill one that Figma counts and that shows nothing", () => {
    const fill = rootFill({ fill: undefined, shadows: [RING] });
    if (fill?.kind !== "literal") {
      throw new Error("a ringed root without a fill gets no literal fill");
    }
    expect(fill.color.a).toBeGreaterThanOrEqual(0.001);
    expect(fill.color.a * 255).toBeLessThan(0.5);
  });
});
