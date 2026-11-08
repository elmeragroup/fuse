import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import * as Hex from "./hex.ts";
import * as Oklab from "./oklab.ts";
import { getOrThrow } from "./result.ts";
import { grey, srgb } from "./srgb.arbitrary.ts";
import * as Srgb from "./srgb.ts";

function hex(input: string): Srgb.Srgb {
  return getOrThrow(Hex.parse(input));
}

function parsed(input: string): Oklab.Oklab {
  const result = Oklab.parse(input);
  if (result._tag === "err") {
    throw new Error(`expected ${input} to parse: ${result.error.message}`);
  }
  return result.value;
}

describe("parse", () => {
  it("reads the plain-number form Chromium serializes a color-mix(in oklab, …) as, in any letter case", () => {
    expect(parsed("oklab(0.5 0.1 -0.1 / 0.9)")).toMatchObject({ l: 0.5, a: 0.1, b: -0.1, alpha: 0.9 });
    expect(parsed("OKLAB(0.62796 0.22486 0.12585)")).toMatchObject({
      l: 0.62796,
      a: 0.22486,
      b: 0.12585,
      alpha: 1,
    });
    expect(parsed("oklab( .5   1e-1\t-1e-1 /50% )")).toMatchObject({ l: 0.5, a: 0.1, b: -0.1, alpha: 0.5 });
  });

  it("clamps lightness and alpha as CSS does at parse time", () => {
    expect(parsed("oklab(1.2 0 0 / 2)")).toMatchObject({ l: 1, alpha: 1 });
    expect(parsed("oklab(-0.5 0 0 / -10%)")).toMatchObject({ l: 0, alpha: 0 });
    expect(parsed("oklab(1e400 0 0 / -1e400)")).toMatchObject({ l: 1, alpha: 0 });
  });

  it("refuses malformed text, component percentages, none, and axes beyond 1e6", () => {
    for (const input of [
      "oklab(0.5 0)",
      "oklab(0.5, 0, 0)",
      "oklab(0.5 0 0 / )",
      "oklab(0.5 0 0)x",
      " oklab(0.5 0 0)",
      "oklab(50% 0 0)",
      "oklab(0.5 40% 0)",
      "oklab(none 0 0)",
      "oklab(0.5 0 none)",
      "oklab(0.5 1e200 0)",
      "oklab(0.5 0 -1000001)",
      "oklab(0.5 1e400 0)",
      "oklch(0.5 0 0)",
    ]) {
      expect(Oklab.parse(input)._tag === "err", input).toBe(true);
    }
    expect(parsed("oklab(0.5 1e6 -1e6)")).toMatchObject({ a: 1e6, b: -1e6 });
  });

  it("names the oklab notation in its error", () => {
    expect(Oklab.parse("oklab(0.5 0)")).toMatchObject({
      _tag: "err",
      error: {
        _tag: "InvalidColor",
        notation: "oklab",
        message: 'Expected an oklab() color, received "oklab(0.5 0)"',
      },
    });
  });
});

describe("make", () => {
  it("refuses components outside their ranges, naming the component", () => {
    expect(Oklab.make({ l: 1.5, a: 0, b: 0, alpha: 1 })).toMatchObject({
      _tag: "err",
      error: { message: "Oklab l must be a finite number in 0..1, received 1.5" },
    });
    expect(Oklab.make({ l: 0.5, a: -1_000_001, b: 0, alpha: 1 })).toMatchObject({
      _tag: "err",
      error: { message: "Oklab a must be a finite number in -1000000..1000000, received -1000001" },
    });
    expect(Oklab.make({ l: 0.5, a: 0, b: Number.NaN, alpha: 1 })).toMatchObject({
      _tag: "err",
      error: { message: "Oklab b must be a finite number in -1000000..1000000, received NaN" },
    });
    expect(Oklab.make({ l: 0.5, a: 0.1, b: -0.1, alpha: 0.3 })).toMatchObject({
      _tag: "ok",
      value: { _tag: "Oklab", l: 0.5, a: 0.1, b: -0.1, alpha: 0.3 },
    });
  });
});

describe("toLinearSrgb", () => {
  it("matches reference linear sRGB, including a dark color and one outside the gamut", () => {
    // colorjs.io 0.5.2 `to("srgb-linear")`, cross-checked with culori 4.0.1 `converter("lrgb")`.
    // oklab(0.45 -0.05 -0.15) sits just outside the gamut with r below 0, and oklab(0.9 -0.3 0.2)
    // far outside it.
    const references = [
      ["oklab(0.6 0.1 -0.1)", [0.34909, 0.1250649, 0.4881128]],
      ["oklab(0.45 -0.05 -0.15)", [-0.0127061, 0.0893412, 0.3941386]],
      ["oklab(0.9 -0.3 0.2)", [-0.2144156, 1.2125683, -0.0378709]],
      ["oklab(0.2 0.02 0.01)", [0.0138847, 0.006096, 0.0054265]],
    ] as const;
    for (const [input, [r, g, b]] of references) {
      const linear = Oklab.toLinearSrgb(parsed(input));
      expect(linear.r, `${input} r`).toBeCloseTo(r, 6);
      expect(linear.g, `${input} g`).toBeCloseTo(g, 6);
      expect(linear.b, `${input} b`).toBeCloseTo(b, 6);
    }
  });

  it("maps the achromatic ends to black and white and keeps the alpha", () => {
    expect(Hex.formatOpaque(Oklab.toSrgb(parsed("oklab(0 0 0)")))).toBe("#000000");
    expect(Hex.formatOpaque(Oklab.toSrgb(parsed("oklab(1 0 0)")))).toBe("#FFFFFF");
    expect(Oklab.toSrgb(parsed("oklab(0.5 0 0 / 0.4)")).alpha).toBe(0.4);
  });
});

describe("fromSrgb", () => {
  it("reproduces Björn Ottosson's published OKLab values for white and the sRGB primaries", () => {
    // From "A perceptual color space for image processing" (2020), table of sRGB examples.
    const published = [
      ["#ffffff", [1, 0, 0]],
      ["#ff0000", [0.62796, 0.22486, 0.12585]],
      ["#00ff00", [0.86644, -0.23389, 0.1795]],
      ["#0000ff", [0.45201, -0.03246, -0.31153]],
    ] as const;
    for (const [input, expected] of published) {
      const { l, a, b } = Oklab.fromSrgb(hex(input));
      [l, a, b].forEach((value, axis) => {
        expect(
          Math.abs(value - (expected[axis] ?? Number.NaN)),
          `${input} axis ${String(axis)}`
        ).toBeLessThan(1e-5);
      });
    }
  });

  it("maps black to the origin and keeps the alpha", () => {
    const black = Oklab.fromSrgb(hex("#000000"));
    expect([black.l, black.a, black.b]).toEqual([0, 0, 0]);
    // A subnormal blue channel underflows unevenly in the matrix and once left the lightness at
    // -7e-111. It sits at black, so its lightness is 0.
    const subnormal = getOrThrow(Srgb.make({ r: 0, g: 0, b: 3.5e-323, alpha: 1 }));
    expect(Oklab.fromSrgb(subnormal).l).toBe(0);
    const translucent = getOrThrow(Srgb.make({ r: 0.2, g: 0.4, b: 0.6, alpha: 0.3 }));
    expect(Oklab.fromSrgb(translucent).alpha).toBe(0.3);
  });

  it("puts every grey on the achromatic axis", () => {
    fc.assert(
      fc.property(grey, (color) => {
        const { a, b } = Oklab.fromSrgb(color);
        expect(Math.abs(a)).toBeLessThan(1e-6);
        expect(Math.abs(b)).toBeLessThan(1e-6);
      })
    );
  });
});

describe("deltaE", () => {
  it("measures 100 per unit of OKLab distance, so white and black sit 100 apart", () => {
    expect(Oklab.deltaE(hex("#ffffff"), hex("#000000"))).toBeCloseTo(100, 5);
    // 100 times the distance between Ottosson's published red and blue coordinates.
    expect(Oklab.deltaE(hex("#ff0000"), hex("#0000ff"))).toBeCloseTo(53.71, 2);
  });

  it("is zero on one color, symmetric, and ignores alpha", () => {
    fc.assert(
      fc.property(srgb, srgb, (left, right) => {
        expect(Oklab.deltaE(left, left)).toBe(0);
        expect(Oklab.deltaE(left, right)).toBe(Oklab.deltaE(right, left));
        const opaque = getOrThrow(Srgb.make({ r: left.r, g: left.g, b: left.b, alpha: 1 }));
        expect(Oklab.deltaE(opaque, right)).toBe(Oklab.deltaE(left, right));
      })
    );
  });
});
