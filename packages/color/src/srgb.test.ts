import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { getOrThrow } from "./result.ts";
import * as Srgb from "./srgb.ts";

function parsed(input: string): Srgb.Srgb {
  const result = Srgb.parse(input);
  if (result._tag === "err") {
    throw new Error(`expected ${input} to parse: ${result.error.message}`);
  }
  return result.value;
}

function channels(color: Srgb.Srgb): readonly [number, number, number, number] {
  return [color.r, color.g, color.b, color.alpha];
}

describe("parse", () => {
  it("reads the legacy comma form browsers serialize computed colors in", () => {
    expect(channels(parsed("rgb(255, 255, 255)"))).toEqual([1, 1, 1, 1]);
    expect(channels(parsed("rgba(0, 0, 0, 0)"))).toEqual([0, 0, 0, 0]);
    expect(channels(parsed("rgba(51, 102, 153, 0.5)"))).toEqual([0.2, 0.4, 0.6, 0.5]);
    expect(channels(parsed("RGB( 51 ,102,153 )"))).toEqual([0.2, 0.4, 0.6, 1]);
  });

  it("clamps out-of-range channels and alpha as CSS does", () => {
    expect(channels(parsed("rgba(300, -5, 127.5, 1.5)"))).toEqual([1, 0, 0.5, 1]);
    expect(channels(parsed("rgb(1e400, -1e400, 0)"))).toEqual([1, 0, 0, 1]);
  });

  it("accepts rgb and rgba with either three or four arguments, as CSS aliases them", () => {
    // CSS Color 4 makes rgba() a legacy alias of rgb() with the same grammar.
    expect(channels(parsed("rgb(255, 0, 0, 0.5)"))).toEqual([1, 0, 0, 0.5]);
    expect(channels(parsed("rgba(0, 255, 0)"))).toEqual([0, 1, 0, 1]);
  });

  it("refuses the space form, percentages, none, missing channels and other notations", () => {
    for (const input of [
      "rgb(255 255 255)",
      "rgb(255 51 0 / 50%)",
      "rgb(100%, 50%, 0%)",
      "rgba(0, 0, 0, 50%)",
      "rgb(none, 0, 0)",
      "rgb(1, 2)",
      "rgb(1, 2 3)",
      "rgb(1, 2, 3 / 0.5)",
      "rgb(1, 2, 3) ",
      "#ffffff",
    ]) {
      expect(Srgb.parse(input)._tag === "err", input).toBe(true);
    }
  });
});

describe("make and makeLinear", () => {
  it("keep an encoded color inside 0..1 and let a linear channel take any finite number", () => {
    expect(Srgb.make({ r: 1.01, g: 0, b: 0, alpha: 1 })).toMatchObject({
      error: { quantity: "Srgb r", message: "Srgb r must be a finite number in 0..1, received 1.01" },
    });
    expect(getOrThrow(Srgb.makeLinear({ r: -5, g: 1e300, b: 0.5, alpha: 1 }))).toMatchObject({
      r: -5,
      g: 1e300,
      b: 0.5,
    });
    expect(Srgb.makeLinear({ r: 0, g: Number.POSITIVE_INFINITY, b: 0, alpha: 1 })).toMatchObject({
      error: { quantity: "LinearSrgb g", message: "LinearSrgb g must be a finite number, received Infinity" },
    });
    expect(Srgb.makeLinear({ r: 0, g: 0, b: 0, alpha: 1.5 })).toMatchObject({
      error: { quantity: "LinearSrgb alpha" },
    });
  });
});

describe("fromLinear and toLinear", () => {
  it("apply the sRGB transfer curve at its published points", () => {
    // IEC 61966-2-1: encoded 0.5 is linear ((0.5 + 0.055) / 1.055) ^ 2.4 = 0.21404114.
    expect(Srgb.toLinear(getOrThrow(Srgb.make({ r: 0.5, g: 0, b: 1, alpha: 1 }))).r).toBeCloseTo(
      0.21404114,
      8
    );
    // Below the knee the curve is linear with slope 12.92.
    expect(Srgb.fromLinear(getOrThrow(Srgb.makeLinear({ r: 0.001, g: 0, b: 1, alpha: 1 }))).r).toBeCloseTo(
      0.01292,
      12
    );
    expect(channels(Srgb.fromLinear(getOrThrow(Srgb.makeLinear({ r: 0, g: 1, b: 1, alpha: 0.3 }))))).toEqual([
      0, 1, 1, 0.3,
    ]);
  });

  it("clip an out-of-gamut linear channel to the nearest end and encode the rest", () => {
    const encoded = Srgb.fromLinear(getOrThrow(Srgb.makeLinear({ r: -0.2, g: 1.4, b: 0.5, alpha: 1 })));
    expect([encoded.r, encoded.g]).toEqual([0, 1]);
    // 1.055 * 0.5 ^ (1 / 2.4) - 0.055 = 0.7353570.
    expect(encoded.b).toBeCloseTo(0.735357, 6);
  });

  it("round-trip every in-gamut color", () => {
    const unit = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(unit, unit, unit, unit, (r, g, b, alpha) => {
        const color = getOrThrow(Srgb.make({ r, g, b, alpha }));
        const back = Srgb.fromLinear(Srgb.toLinear(color));
        expect(back.r).toBeCloseTo(r, 12);
        expect(back.g).toBeCloseTo(g, 12);
        expect(back.b).toBeCloseTo(b, 12);
        expect(back.alpha).toBe(alpha);
      })
    );
  });
});

describe("compositeOver", () => {
  const white = getOrThrow(Srgb.make({ r: 1, g: 1, b: 1, alpha: 1 }));
  const black = getOrThrow(Srgb.make({ r: 0, g: 0, b: 0, alpha: 1 }));

  it("blends a translucent color over an opaque one in encoded sRGB", () => {
    const halfWhite = getOrThrow(Srgb.make({ r: 1, g: 1, b: 1, alpha: 0.5 }));
    expect(channels(Srgb.compositeOver(halfWhite, black))).toEqual([0.5, 0.5, 0.5, 1]);
  });

  it("returns an opaque foreground unchanged", () => {
    expect(channels(Srgb.compositeOver(white, black))).toEqual([1, 1, 1, 1]);
  });

  it("keeps a translucent color over a transparent one, and two transparent colors transparent", () => {
    const transparent = getOrThrow(Srgb.make({ r: 0.3, g: 0.3, b: 0.3, alpha: 0 }));
    const tint = getOrThrow(Srgb.make({ r: 0.2, g: 0.4, b: 0.6, alpha: 0.4 }));
    const over = Srgb.compositeOver(tint, transparent);
    expect(over.alpha).toBe(0.4);
    for (const [channel, expected] of [
      [over.r, 0.2],
      [over.g, 0.4],
      [over.b, 0.6],
    ] as const) {
      expect(channel).toBeCloseTo(expected, 12);
    }
    expect(channels(Srgb.compositeOver(transparent, transparent))).toEqual([0, 0, 0, 0]);
  });

  it("unions two translucent coverages", () => {
    // Porter-Duff source-over: alpha 0.5 + 0.5 * (1 - 0.5) = 0.75, and red weighs
    // 0.5 / 0.75 = 2/3 of the result against blue's 0.25 / 0.75 = 1/3.
    const halfRed = getOrThrow(Srgb.make({ r: 1, g: 0, b: 0, alpha: 0.5 }));
    const halfBlue = getOrThrow(Srgb.make({ r: 0, g: 0, b: 1, alpha: 0.5 }));
    const over = Srgb.compositeOver(halfRed, halfBlue);
    expect(over.alpha).toBe(0.75);
    expect(over.r).toBeCloseTo(2 / 3, 12);
    expect(over.b).toBeCloseTo(1 / 3, 12);
  });
});
