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
