import { describe, expect, it } from "vitest";

import { oklchToSrgb } from "./contrast";
import { parseOklch } from "./oklch";

// Reference points from CSS Color 4: the sRGB primaries' published OKLCH coordinates.
const SRGB_RED = "oklch(0.627955 0.257683 29.2339)";
const SRGB_BLUE = "oklch(0.452014 0.313214 264.052)";

describe("oklchToSrgb", () => {
  it("maps the achromatic endpoints to sRGB black and white", () => {
    const white = oklchToSrgb(parseOklch("oklch(1 0 0)"));
    const black = oklchToSrgb(parseOklch("oklch(0 0 0)"));
    for (const channel of [white.r, white.g, white.b]) {
      expect(channel).toBeCloseTo(1, 5);
    }
    expect([black.r, black.g, black.b]).toEqual([0, 0, 0]);
  });

  it("recovers the sRGB primaries from their published OKLCH coordinates", () => {
    const red = oklchToSrgb(parseOklch(SRGB_RED));
    expect(red.r).toBeCloseTo(1, 3);
    expect(red.g).toBeCloseTo(0, 3);
    expect(red.b).toBeCloseTo(0, 3);

    const blue = oklchToSrgb(parseOklch(SRGB_BLUE));
    expect(blue.r).toBeCloseTo(0, 3);
    expect(blue.g).toBeCloseTo(0, 3);
    expect(blue.b).toBeCloseTo(1, 3);
  });

  it("carries the value's alpha, in number or percentage form", () => {
    expect(oklchToSrgb(parseOklch("oklch(0.5 0 0)")).alpha).toBe(1);
    expect(oklchToSrgb(parseOklch("oklch(0.3209 0.10325 38.8 / 0.7)")).alpha).toBe(0.7);
    expect(oklchToSrgb(parseOklch("oklch(1 0 0 / 10%)")).alpha).toBe(0.1);
  });

  it("clips out-of-gamut channels into 0..1", () => {
    const vivid = oklchToSrgb(parseOklch("oklch(0.9 0.4 150)"));
    for (const channel of [vivid.r, vivid.g, vivid.b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    expect(vivid.g).toBeCloseTo(1, 9);
  });
});
