import { describe, expect, it } from "vitest";

import { mixOklch, oklchToSrgb, parseOklch } from "./oklch";

// Each expectation follows by hand from the CSS Color 4 interpolation rules
// (premultiplied lightness and chroma, shorter-arc hue). Chromium's own
// `color-mix(in oklch, …)` serializes the same values for these inputs.
describe("mixOklch", () => {
  it("moves 5% toward the second color, the internal light secondary hover", () => {
    // L 0.97 * 0.95 + 0.15 * 0.05 = 0.929; C 0 * 0.95 + 0.0041 * 0.05 = 0.000205;
    // H 0 * 0.95 + 49.31 * 0.05 = 2.4655.
    expect(mixOklch("oklch(0.97 0 0)", "oklch(0.15 0.0041 49.31)", 0.05)).toBe(
      "oklch(0.929 0.000205 2.4655)"
    );
  });

  it("keeps two achromatic colors achromatic", () => {
    // L 0.269 * 0.95 + 0.985 * 0.05 = 0.3048.
    expect(mixOklch("oklch(0.269 0 0)", "oklch(0.985 0 0)", 0.05)).toBe("oklch(0.3048 0 0)");
  });

  it("returns the same color when both inputs are equal", () => {
    expect(mixOklch("oklch(0.3209 0.10325 38.8)", "oklch(0.3209 0.10325 38.8)", 0.05)).toBe(
      "oklch(0.3209 0.10325 38.8)"
    );
  });

  it("interpolates hue along the shorter arc across 0 degrees", () => {
    // 300 - 20 = 280 > 180, so 20 becomes 380: 380 * 0.75 + 300 * 0.25 = 360, which is 0.
    expect(mixOklch("oklch(0.6 0.2 20)", "oklch(0.4 0.1 300)", 0.25)).toBe("oklch(0.55 0.175 0)");
  });

  it("premultiplies lightness and chroma by alpha", () => {
    // alpha 0.5 * 0.5 + 1 * 0.5 = 0.75; L (0.8 * 0.5 * 0.5 + 0.2 * 0.5) / 0.75 = 0.4;
    // C (0.1 * 0.5 * 0.5 + 0.1 * 0.5) / 0.75 = 0.1.
    expect(mixOklch("oklch(0.8 0.1 30 / 0.5)", "oklch(0.2 0.1 30)", 0.5)).toBe("oklch(0.4 0.1 30 / 0.75)");
  });

  it("rejects an amount outside 0..1", () => {
    expect(() => mixOklch("oklch(0.5 0 0)", "oklch(0.6 0 0)", 5)).toThrow(/0\.\.1/);
  });
});

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
