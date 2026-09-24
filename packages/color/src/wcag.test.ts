import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import * as Hex from "./hex.ts";
import { getOrThrow } from "./result.ts";
import * as Srgb from "./srgb.ts";
import * as Wcag from "./wcag.ts";

function hex(input: string): Srgb.Srgb {
  return getOrThrow(Hex.parse(input));
}

function ratio(foreground: Srgb.Srgb, background: Srgb.Srgb): number {
  return getOrThrow(Wcag.contrastRatio(foreground, background));
}

describe("relativeLuminance", () => {
  it("matches the WCAG definition at black, white, a primary and a published gray", () => {
    expect(Wcag.relativeLuminance(hex("#000000"))).toBe(0);
    expect(Wcag.relativeLuminance(hex("#ffffff"))).toBeCloseTo(1, 12);
    // Pure red keeps only the red primary's published weight.
    expect(Wcag.relativeLuminance(hex("#ff0000"))).toBeCloseTo(0.2126, 12);
    // #767676, the 4.5:1 gray on white: channel 118 / 255 decodes to
    // ((0.462745 + 0.055) / 1.055) ^ 2.4 = 0.181164, and a gray's weights sum to 1.
    expect(Wcag.relativeLuminance(hex("#767676"))).toBeCloseTo(0.181164, 6);
  });

  it("ignores alpha", () => {
    expect(Wcag.relativeLuminance(getOrThrow(Srgb.make({ r: 1, g: 1, b: 1, alpha: 0 })))).toBeCloseTo(1, 12);
  });
});

describe("contrastRatio", () => {
  it("spans 1 for a color on itself to 21 for black on white", () => {
    expect(ratio(hex("#000000"), hex("#ffffff"))).toBeCloseTo(21, 10);
    expect(ratio(hex("#5c6773"), hex("#5c6773"))).toBe(1);
  });

  it("matches published WCAG reference pairs", () => {
    // #767676 is the lightest gray that passes 4.5:1 on white, at 4.54:1; #777777 fails.
    expect(ratio(hex("#767676"), hex("#ffffff"))).toBeCloseTo(4.54, 2);
    expect(ratio(hex("#777777"), hex("#ffffff"))).toBeLessThan(4.5);
  });

  it("composites a translucent foreground over the background before measuring", () => {
    // 50% white over black is sRGB 0.5, relative luminance 0.21404: (0.21404 + 0.05) / 0.05.
    const halfWhite = getOrThrow(Srgb.make({ r: 1, g: 1, b: 1, alpha: 0.5 }));
    expect(ratio(halfWhite, hex("#000000"))).toBeCloseTo(5.2808, 4);
  });

  it("is symmetric in two opaque colors", () => {
    const opaque = fc
      .tuple(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true })
      )
      .map(([r, g, b]) => getOrThrow(Srgb.make({ r, g, b, alpha: 1 })));
    fc.assert(
      fc.property(opaque, opaque, (left, right) => {
        const forward = ratio(left, right);
        expect(forward).toBeCloseTo(ratio(right, left), 12);
        expect(forward).toBeGreaterThanOrEqual(1);
        expect(forward).toBeLessThanOrEqual(21);
      })
    );
  });

  it("refuses a translucent background, whose seen color depends on its backdrop", () => {
    const result = Wcag.contrastRatio(
      hex("#000000"),
      getOrThrow(Srgb.make({ r: 1, g: 1, b: 1, alpha: 0.4 }))
    );
    expect(result._tag === "err" && result.error).toMatchObject({
      _tag: "TranslucentBackground",
      alpha: 0.4,
    });
  });
});
