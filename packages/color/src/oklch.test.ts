import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { oklch } from "./oklch.arbitrary.ts";
import * as Oklch from "./oklch.ts";
import { getOrThrow } from "./result.ts";

function parsed(input: string): Oklch.Oklch {
  const result = Oklch.parse(input);
  if (result._tag === "err") {
    throw new Error(`expected ${input} to parse: ${result.error.message}`);
  }
  return result.value;
}

function components(color: Oklch.Oklch): readonly [number, number, number, number] {
  return [color.l, color.c, color.h, color.alpha];
}

/** The angle between two hues in degrees, so 359.9 and 0 are 0.1 apart. */
function hueDistance(left: number, right: number): number {
  const difference = Math.abs(left - right) % 360;
  return Math.min(difference, 360 - difference);
}

describe("parse", () => {
  it("reads the token spellings, with an alpha as a number or a percentage", () => {
    expect(components(parsed("oklch(0.47471 0.07313 217.18)"))).toEqual([0.47471, 0.07313, 217.18, 1]);
    expect(components(parsed("oklch(0.3209 0.10325 38.8 / 0.7)"))).toEqual([0.3209, 0.10325, 38.8, 0.7]);
    expect(components(parsed("oklch(1 0 0 / 40%)"))).toEqual([1, 0, 0, 0.4]);
  });

  it("reads any letter case, CSS whitespace and exponent notation", () => {
    expect(components(parsed("OKLCH(0.5 0.1 30)"))).toEqual([0.5, 0.1, 30, 1]);
    expect(parsed("oklch( 0.5   0.1\t30 /50% )").alpha).toBe(0.5);
    expect(components(parsed("oklch(.5 1e-1 3e1)"))).toEqual([0.5, 0.1, 30, 1]);
  });

  it("clamps and wraps out-of-range components as CSS does at parse time", () => {
    expect(components(parsed("oklch(1.2 -0.1 -30 / 2)"))).toEqual([1, 0, 330, 1]);
    expect(components(parsed("oklch(-0.5 0.1 720 / -10%)"))).toEqual([0, 0.1, 0, 0]);
  });

  it("refuses malformed text, other notations, surrounding whitespace and none", () => {
    for (const input of [
      "oklch(0.5 0.1)",
      "oklch(0.5, 0.1, 30)",
      "oklch(0.5 0.1 30 / )",
      "oklch(0.5 0.1 none)",
      "oklch(0.5 0.1 30)x",
      " oklch(0.5 0.1 30)",
      "oklch(50% 0.1 30)",
      "oklch(0.5 25% 30)",
      "oklch(0.5 0.1 30deg)",
      "oklch(0.5 0.1 0.5turn)",
      "oklab(0.5 0.1 0.1)",
      "#ffffff",
      "",
    ]) {
      expect(Oklch.parse(input)._tag === "err", input).toBe(true);
    }
  });

  it("refuses a chroma above 1e6 and a hue too large for a double, which have no end to clamp to", () => {
    for (const input of [
      "oklch(0.5 1e200 30)",
      "oklch(0.5 1000001 30)",
      "oklch(0.5 1e400 30)",
      "oklch(0.5 0.1 1e400)",
      "oklch(0.5 0.1 -1e400)",
    ]) {
      expect(Oklch.parse(input)._tag === "err", input).toBe(true);
    }
    expect(parsed("oklch(0.5 1e6 30)").c).toBe(1e6);
  });

  it("clamps a lightness, negative chroma or alpha too large for a double to its end", () => {
    expect(components(parsed("oklch(1e400 -1e400 30 / 1e400%)"))).toEqual([1, 0, 30, 1]);
    expect(components(parsed("oklch(-1e400 0.1 30 / -1e400)"))).toEqual([0, 0.1, 30, 0]);
  });

  it("names the notation and quotes the input in its error", () => {
    const result = Oklch.parse("oklch(0.5 0.1)");
    expect(result._tag === "err" && result.error).toMatchObject({
      _tag: "InvalidColor",
      notation: "oklch",
      message: 'Expected an oklch() color, received "oklch(0.5 0.1)"',
    });
  });

  it("bounds the quoted input in the message and keeps no copy of it on the error", () => {
    const input = `oklch(${"9".repeat(500)}`;
    const result = Oklch.parse(input);
    if (result._tag === "ok") throw new Error("expected a failure");
    expect(Object.values(result.error)).not.toContain(input);
    expect(result.error.message.length).toBeLessThan(120);
    expect(result.error.message.endsWith("…")).toBe(true);
  });
});

describe("make", () => {
  it("refuses components outside their ranges, naming the component", () => {
    expect(Oklch.make({ l: 0.5, c: 0.1, h: 360, alpha: 1 })).toMatchObject({
      _tag: "err",
      error: {
        _tag: "OutOfRange",
        quantity: "Oklch h",
        message: "Oklch h must be a finite number in 0..360 exclusive, received 360",
      },
    });
    expect(Oklch.make({ l: 0.5, c: 0.1, h: 30, alpha: Number.NaN })).toMatchObject({
      error: { quantity: "Oklch alpha" },
    });
  });

  it("brands a color so a spread copy with forged components is not an Oklch", () => {
    const valid = getOrThrow(Oklch.make({ l: 0.5, c: 0.1, h: 30, alpha: 1 }));
    // @ts-expect-error A spread copies the public fields but not the private brand field.
    // oxlint-disable-next-line typescript/no-misused-spread -- The test spreads a color on purpose, to show the copy is not an Oklch.
    const forged: Oklch.Oklch = { ...valid, h: 720, alpha: 3 };
    // The checked constructor refuses the components the spread tried to smuggle in.
    expect(Oklch.make({ l: forged.l, c: forged.c, h: forged.h, alpha: forged.alpha })._tag).toBe("err");
  });
});

describe("format", () => {
  it("writes up to seven decimals without trailing zeros, and alpha only when translucent", () => {
    expect(Oklch.format(getOrThrow(Oklch.make({ l: 0.929, c: 0.000205, h: 2.4655, alpha: 1 })))).toBe(
      "oklch(0.929 0.000205 2.4655)"
    );
    expect(Oklch.format(getOrThrow(Oklch.make({ l: 0.4, c: 0.1, h: 30, alpha: 0.75 })))).toBe(
      "oklch(0.4 0.1 30 / 0.75)"
    );
    expect(Oklch.format(getOrThrow(Oklch.make({ l: 1 / 3, c: 1e-9, h: 0, alpha: 1 })))).toBe(
      "oklch(0.3333333 0 0)"
    );
  });

  it("writes a hue that rounds up to 360 as 0, the same angle", () => {
    expect(Oklch.format(getOrThrow(Oklch.make({ l: 0.5, c: 0.1, h: 359.99999996, alpha: 1 })))).toBe(
      "oklch(0.5 0.1 0)"
    );
  });

  it("writes an alpha that rounds to 1 in the opaque form", () => {
    expect(Oklch.format(getOrThrow(Oklch.make({ l: 0.5, c: 0, h: 0, alpha: 0.95 + 0.05 - 1e-12 })))).toBe(
      "oklch(0.5 0 0)"
    );
  });

  it("returns every token literal's own spelling", () => {
    for (const literal of [
      "oklch(0.1749487 0.003804 164.5613)",
      "oklch(0.30579 0.03693 215.45 / 0.7)",
      "oklch(1 0 0 / 0.4)",
    ]) {
      expect(Oklch.format(parsed(literal))).toBe(literal);
    }
  });

  it("reads back what it writes to seven-decimal precision", () => {
    // Rounding to seven decimals moves a component at most half a step, 5e-8, plus the
    // representation error of the decimal the parser reads back.
    const halfStep = 5e-8 + 1e-15;
    fc.assert(
      fc.property(oklch, (color) => {
        const reread = parsed(Oklch.format(color));
        expect(Math.abs(reread.l - color.l)).toBeLessThanOrEqual(halfStep);
        expect(Math.abs(reread.c - color.c)).toBeLessThanOrEqual(halfStep);
        expect(hueDistance(reread.h, color.h)).toBeLessThanOrEqual(halfStep);
        expect(Math.abs(reread.alpha - color.alpha)).toBeLessThanOrEqual(halfStep);
        expect(Oklch.format(reread)).toBe(Oklch.format(color));
      })
    );
  });
});

// Each expectation follows by hand from the CSS Color 4 interpolation rules (premultiplied
// lightness and chroma, shorter-arc hue). Chromium's `color-mix(in oklch, …)` serializes the
// same values for these inputs.
describe("mix", () => {
  const mixed = (from: string, to: string, weight: number): string =>
    Oklch.format(Oklch.mix(parsed(from), parsed(to), getOrThrow(Oklch.makeMixWeight(weight))));

  it("moves 5% toward the second color, interpolating a hue written with zero chroma", () => {
    // L 0.97 * 0.95 + 0.15 * 0.05 = 0.929; C 0.0041 * 0.05 = 0.000205; H 49.31 * 0.05 = 2.4655.
    expect(mixed("oklch(0.97 0 0)", "oklch(0.15 0.0041 49.31)", 0.05)).toBe("oklch(0.929 0.000205 2.4655)");
  });

  it("keeps two achromatic colors achromatic", () => {
    // L 0.269 * 0.95 + 0.985 * 0.05 = 0.3048.
    expect(mixed("oklch(0.269 0 0)", "oklch(0.985 0 0)", 0.05)).toBe("oklch(0.3048 0 0)");
  });

  it("interpolates hue along the shorter arc across 0 degrees", () => {
    // 300 - 20 = 280 > 180, so 20 becomes 380: 380 * 0.75 + 300 * 0.25 = 360, which is 0.
    expect(mixed("oklch(0.6 0.2 20)", "oklch(0.4 0.1 300)", 0.25)).toBe("oklch(0.55 0.175 0)");
    // 10 - 350 = -340 < -180, so 10 becomes 370: 350 * 0.5 + 370 * 0.5 = 360, which is 0.
    expect(mixed("oklch(0.5 0.1 350)", "oklch(0.5 0.1 10)", 0.5)).toBe("oklch(0.5 0.1 0)");
  });

  it("premultiplies lightness and chroma by alpha", () => {
    // alpha 0.5 * 0.5 + 1 * 0.5 = 0.75; L (0.8 * 0.5 * 0.5 + 0.2 * 0.5) / 0.75 = 0.4;
    // C (0.1 * 0.5 * 0.5 + 0.1 * 0.5) / 0.75 = 0.1.
    expect(mixed("oklch(0.8 0.1 30 / 0.5)", "oklch(0.2 0.1 30)", 0.5)).toBe("oklch(0.4 0.1 30 / 0.75)");
  });

  it("mixes two transparent colors to transparent without dividing by zero", () => {
    expect(mixed("oklch(0.8 0.1 30 / 0)", "oklch(0.2 0.1 90 / 0)", 0.5)).toBe("oklch(0 0 60 / 0)");
  });

  it("returns an endpoint at weight 0 and 1, and a visible color mixed with itself", () => {
    // Premultiplying by alpha and dividing it back out can move a component by a rounding
    // step, so the comparison allows float error. A fully transparent mix has no color to
    // keep, so the self-mix property takes colors with some alpha.
    const expectSameColor = (actual: Oklch.Oklch, expected: Oklch.Oklch): void => {
      expect(actual.l).toBeCloseTo(expected.l, 12);
      expect(actual.c).toBeCloseTo(expected.c, 12);
      expect(hueDistance(actual.h, expected.h)).toBeLessThan(1e-9);
      expect(actual.alpha).toBeCloseTo(expected.alpha, 12);
    };
    const visible = oklch.filter((color) => color.alpha >= 0.001);
    fc.assert(
      fc.property(visible, visible, (from, to) => {
        expectSameColor(Oklch.mix(from, to, getOrThrow(Oklch.makeMixWeight(0))), from);
        expectSameColor(Oklch.mix(from, to, getOrThrow(Oklch.makeMixWeight(1))), to);
        expectSameColor(Oklch.mix(from, from, getOrThrow(Oklch.makeMixWeight(0.37))), from);
      })
    );
  });

  it("keeps a mix of two maximum-chroma colors within the chroma bound", () => {
    // Premultiplying by alpha can land a rounding step above the endpoints; the bound holds.
    const unitAlpha = fc.double({ min: 0.001, max: 1, noNaN: true, noDefaultInfinity: true });
    const weight = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(unitAlpha, unitAlpha, weight, (fromAlpha, toAlpha, share) => {
        const from = getOrThrow(Oklch.make({ l: 0.5, c: 1e6, h: 30, alpha: fromAlpha }));
        const to = getOrThrow(Oklch.make({ l: 0.5, c: 1e6, h: 90, alpha: toAlpha }));
        expect(Oklch.mix(from, to, getOrThrow(Oklch.makeMixWeight(share))).c).toBeCloseTo(1e6, 3);
      })
    );
  });

  it("refuses a weight outside 0..1", () => {
    for (const weight of [5, -0.01, Number.NaN]) {
      const result = Oklch.makeMixWeight(weight);
      expect(result._tag === "err" && result.error).toMatchObject({
        _tag: "OutOfRange",
        quantity: "MixWeight weight",
      });
    }
  });
});

// Reference points from CSS Color 4: the sRGB primaries' published OKLCH coordinates.
const SRGB_RED = "oklch(0.627955 0.257683 29.2339)";
const SRGB_BLUE = "oklch(0.452014 0.313214 264.052)";

describe("toSrgb", () => {
  it("maps the achromatic endpoints to sRGB black and white", () => {
    const white = Oklch.toSrgb(parsed("oklch(1 0 0)"));
    const black = Oklch.toSrgb(parsed("oklch(0 0 0)"));
    for (const channel of [white.r, white.g, white.b]) {
      expect(channel).toBeCloseTo(1, 5);
    }
    expect([black.r, black.g, black.b]).toEqual([0, 0, 0]);
  });

  it("recovers the sRGB primaries from their published OKLCH coordinates", () => {
    const red = Oklch.toSrgb(parsed(SRGB_RED));
    expect([red.r, red.g, red.b].map((channel) => Number(channel.toFixed(3)))).toEqual([1, 0, 0]);
    const blue = Oklch.toSrgb(parsed(SRGB_BLUE));
    expect([blue.r, blue.g, blue.b].map((channel) => Number(channel.toFixed(3)))).toEqual([0, 0, 1]);
  });

  it("keeps the alpha", () => {
    expect(Oklch.toSrgb(parsed("oklch(0.3209 0.10325 38.8 / 0.7)")).alpha).toBe(0.7);
    expect(Oklch.toSrgb(parsed("oklch(1 0 0 / 10%)")).alpha).toBe(0.1);
  });

  it("clips an out-of-gamut color's channels into 0..1, where linear sRGB keeps them", () => {
    const vivid = parsed("oklch(0.9 0.4 150)");
    expect(Oklch.toLinearSrgb(vivid).g).toBeGreaterThan(1);
    expect(Oklch.toLinearSrgb(vivid).r).toBeLessThan(0);
    const clipped = Oklch.toSrgb(vivid);
    expect([clipped.r, clipped.g]).toEqual([0, 1]);
  });
});
