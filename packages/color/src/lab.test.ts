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

describe("make", () => {
  it("refuses components outside their ranges, naming the component", () => {
    expect(Lab.make({ l: 101, a: 0, b: 0, alpha: 1 })).toMatchObject({
      _tag: "err",
      error: { message: "Lab l must be a finite number in 0..100, received 101" },
    });
    expect(Lab.make({ l: 50, a: 1_000_001, b: 0, alpha: 1 })).toMatchObject({
      _tag: "err",
      error: { message: "Lab a must be a finite number in -1000000..1000000, received 1000001" },
    });
    expect(Lab.make({ l: 50, a: 0, b: Number.NaN, alpha: 1 })).toMatchObject({
      _tag: "err",
      error: { message: "Lab b must be a finite number in -1000000..1000000, received NaN" },
    });
  });
});

describe("toSrgb", () => {
  it("matches reference linear sRGB, including the dark linear branches and outside the gamut", () => {
    // colorjs.io 0.5.2 `to("srgb-linear")`, cross-checked with culori 4.0.1. lab(5 10 -10) takes
    // the L <= 8 linear y branch and the fx^3 <= epsilon linear x branch; lab(2 0 0) is a dark
    // neutral on the linear y branch; lab(30 80 -110) is out of gamut with g below 0.
    const references = [
      ["lab(50 20 -30)", [0.2341466, 0.1500557, 0.4044469]],
      ["lab(40 -30 40)", [0.0372282, 0.1449063, 0.0056957]],
      ["lab(5 10 -10)", [0.0105459, 0.0032987, 0.0135948]],
      ["lab(2 0 0)", [0.0022141, 0.0022141, 0.0022141]],
      ["lab(30 80 -110)", [0.0768094, -0.0198143, 0.9810998]],
    ] as const;
    for (const [input, [r, g, b]] of references) {
      const linear = Lab.toLinearSrgb(parsed(input));
      expect(linear.r, `${input} r`).toBeCloseTo(r, 5);
      expect(linear.g, `${input} g`).toBeCloseTo(g, 5);
      expect(linear.b, `${input} b`).toBeCloseTo(b, 5);
    }
  });

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
