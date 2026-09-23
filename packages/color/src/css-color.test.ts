import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import * as CssColor from "./css-color.ts";
import { getOrThrow } from "./result.ts";
import * as Srgb from "./srgb.ts";

function parsed(input: string): CssColor.CssColor {
  const result = CssColor.parse(input);
  if (result._tag === "err") {
    throw new Error(`expected ${input} to parse: ${result.error.message}`);
  }
  return result.value;
}

function srgbChannels(input: string): readonly [number, number, number, number] {
  const color = CssColor.toSrgb(parsed(input));
  return [color.r, color.g, color.b, color.alpha];
}

describe("parse", () => {
  it("reads each notation into the space it writes", () => {
    expect(parsed("oklch(0.5 0.1 30)")._tag).toBe("Oklch");
    expect(parsed("OKLCH(0.5 0.1 30)")._tag).toBe("Oklch");
    expect(parsed("#5c6773")._tag).toBe("Srgb");
    expect(parsed("rgb(255, 255, 255)")._tag).toBe("Srgb");
    expect(parsed("rgba(0, 0, 0, 0)")._tag).toBe("Srgb");
    expect(parsed("lab(100 0 0)")._tag).toBe("Lab");
  });

  it("fails a malformed color with its notation's error", () => {
    const result = CssColor.parse("oklch(0.5 0.1)");
    expect(result._tag === "err" && result.error.notation).toBe("oklch");
    const rgb = CssColor.parse("rgb(1 2)");
    expect(rgb._tag === "err" && rgb.error.notation).toBe("rgb");
    const lab = CssColor.parse("lab(50 0)");
    expect(lab._tag === "err" && lab.error.notation).toBe("lab");
  });

  it("refuses names and other color functions with the combined notation's error", () => {
    for (const input of [
      "white",
      "transparent",
      "oklab(0.5 0 0)",
      "hsl(0 0% 100%)",
      "color(srgb 1 1 1)",
      "",
    ]) {
      const result = CssColor.parse(input);
      expect(result._tag === "err" && result.error.message, input).toBe(
        `Expected an oklch(), lab(), rgb() or hex color, received ${JSON.stringify(input)}`
      );
    }
  });
});

// CSS number text across the whole double range and past it: every JavaScript spelling of a
// finite double, and integers with exponents from -400 to 400, which overflow to infinity or
// underflow to 0 at the ends.
const cssNumber = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }).map(String),
  fc
    .tuple(fc.constantFrom("", "+", "-"), fc.nat(), fc.integer({ min: -400, max: 400 }))
    .map(([sign, digits, exponent]) => `${sign}${digits}e${exponent}`),
  fc.double({ min: -2, max: 2, noNaN: true }).map(String)
);
const alpha = fc.option(
  fc.tuple(cssNumber, fc.constantFrom("", "%")).map(([value, percent]) => `${value}${percent}`),
  { nil: undefined }
);
const hexDigits = fc.string({
  unit: fc.constantFrom(..."0123456789abcdefABCDEF".split("")),
  minLength: 6,
  maxLength: 6,
});
const colorText = fc.oneof(
  fc
    .tuple(cssNumber, cssNumber, cssNumber, alpha)
    .map(([l, c, h, a]) => (a === undefined ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${a})`)),
  fc
    .tuple(cssNumber, cssNumber, cssNumber, alpha)
    .map(([l, a, b, opacity]) =>
      opacity === undefined ? `lab(${l} ${a} ${b})` : `lab(${l} ${a} ${b} / ${opacity})`
    ),
  fc
    .tuple(cssNumber, cssNumber, cssNumber, fc.option(cssNumber, { nil: undefined }))
    .map(([r, g, b, a]) => (a === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`)),
  hexDigits.map((digits) => `#${digits}`)
);

describe("toSrgb", () => {
  it("converts every color parse accepts, however large its components", () => {
    fc.assert(
      fc.property(colorText, (input) => {
        const result = CssColor.parse(input);
        if (result._tag === "ok") {
          const srgb = CssColor.toSrgb(result.value);
          for (const channel of [srgb.r, srgb.g, srgb.b, srgb.alpha]) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(1);
          }
        }
      }),
      {
        numRuns: 2000,
        examples: [
          ["oklch(0 1e6 0)"],
          ["oklch(1 1e6 200)"],
          ["lab(0 1e6 -1e6)"],
          ["lab(100 -1e6 1e6)"],
          ["rgba(1e400, -1e400, 1e-400, 1e400)"],
        ],
      }
    );
  });

  it("passes an sRGB color through and converts an OKLCH one", () => {
    expect(srgbChannels("#5c6773")).toEqual([92 / 255, 103 / 255, 115 / 255, 1]);
    const white = srgbChannels("oklch(1 0 0 / 40%)");
    expect(white).toEqual([1, 1, 1, 0.4]);
    expect(CssColor.toSrgb(getOrThrow(Srgb.make({ r: 0.1, g: 0.2, b: 0.3, alpha: 1 })))).toEqual(
      getOrThrow(Srgb.make({ r: 0.1, g: 0.2, b: 0.3, alpha: 1 }))
    );
  });
});
