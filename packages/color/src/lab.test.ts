import { describe, expect, it } from "vitest";

import * as Lab from "./lab.ts";

function parsed(input: string): Lab.Lab {
  const result = Lab.parse(input);
  if (result._tag === "err") {
    throw new Error(`expected ${input} to parse: ${result.error.message}`);
  }
  return result.value;
}

function srgb(input: string): readonly number[] {
  const color = Lab.toSrgb(parsed(input));
  return [color.r, color.g, color.b, color.alpha];
}

describe("parse", () => {
  it("reads the plain-number form Chromium serializes, in any letter case", () => {
    const color = parsed("lab(50 25 -50 / 0.25)");
    expect([color.l, color.a, color.b, color.alpha]).toEqual([50, 25, -50, 0.25]);
    expect(parsed("LAB(99.5 -3 4 / 0.5)")).toMatchObject({ l: 99.5, a: -3, b: 4, alpha: 0.5 });
    expect(parsed("lab(100 0 0)")).toMatchObject({ l: 100, a: 0, b: 0, alpha: 1 });
  });

  it("clamps lightness and alpha as CSS does at parse time", () => {
    expect(parsed("lab(120 0 0 / 2)")).toMatchObject({ l: 100, alpha: 1 });
    expect(parsed("lab(-5 0 0)").l).toBe(0);
    expect(parsed("lab(1e400 0 0 / -1e400)")).toMatchObject({ l: 100, alpha: 0 });
  });

  it("refuses malformed text, percentages, none, and axes beyond 1e6", () => {
    for (const input of [
      "lab(50 0)",
      "lab(50, 0, 0)",
      "lab(50% 0 0)",
      "lab(50 20% 0)",
      "lab(50 0 0 / 50%)",
      "lab(none 0 0)",
      "lab(50 1e200 0)",
      "lab(50 0 -1000001)",
      "lab(50 1e400 0)",
      "oklab(0.5 0 0)",
    ]) {
      expect(Lab.parse(input)._tag === "err", input).toBe(true);
    }
    expect(parsed("lab(50 1e6 -1e6)")).toMatchObject({ a: 1e6, b: -1e6 });
  });
});

describe("toSrgb", () => {
  it("maps the D50 white and black points to sRGB white and black", () => {
    // Bradford adaptation carries the D50 white to D65, where sRGB's white sits.
    for (const channel of srgb("lab(100 0 0)").slice(0, 3)) {
      expect(channel).toBeCloseTo(1, 6);
    }
    expect(srgb("lab(0 0 0)")).toEqual([0, 0, 0, 1]);
  });

  it("recovers sRGB red from its published CIE Lab coordinates", () => {
    // CSS Color 4 gives sRGB red as lab(54.29 80.8 69.89) under D50.
    const [r = 0, g = 0, b = 0] = srgb("lab(54.29 80.8 69.89)");
    expect(r).toBeCloseTo(1, 3);
    expect(g).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });

  it("keeps the alpha", () => {
    expect(srgb("lab(50 0 0 / 0.4)")[3]).toBe(0.4);
  });
});
