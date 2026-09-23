import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import * as Hex from "./hex.ts";
import { getOrThrow } from "./result.ts";
import * as Srgb from "./srgb.ts";

function parsed(input: string): Srgb.Srgb {
  const result = Hex.parse(input);
  if (result._tag === "err") {
    throw new Error(`expected ${input} to parse: ${result.error.message}`);
  }
  return result.value;
}

function channels(color: Srgb.Srgb): readonly [number, number, number, number] {
  return [color.r, color.g, color.b, color.alpha];
}

describe("parse", () => {
  it("reads six-digit hex as opaque sRGB in either case", () => {
    expect(channels(parsed("#5c6773"))).toEqual([92 / 255, 103 / 255, 115 / 255, 1]);
    expect(channels(parsed("#FF0000"))).toEqual([1, 0, 0, 1]);
  });

  it("refuses shorthand, alpha digits, other lengths, non-hex digits, a missing hash and whitespace", () => {
    for (const input of [
      "#fff",
      "#f808",
      "#ff000080",
      "#ff",
      "#fffffff",
      "#gggggg",
      "5c6773",
      "#5c6773 ",
      "#",
      "oklch(1 0 0)",
    ]) {
      expect(Hex.parse(input)._tag === "err", input).toBe(true);
    }
    const result = Hex.parse("#fff");
    expect(result._tag === "err" && result.error).toMatchObject({
      notation: "hex",
      message: 'Expected a #rrggbb hex color, received "#fff"',
    });
  });
});

describe("formatOpaque", () => {
  it("writes uppercase #RRGGBB and leaves the alpha out", () => {
    expect(
      Hex.formatOpaque(getOrThrow(Srgb.make({ r: 92 / 255, g: 103 / 255, b: 115 / 255, alpha: 0.4 })))
    ).toBe("#5C6773");
    expect(Hex.formatOpaque(getOrThrow(Srgb.make({ r: 0, g: 0, b: 0, alpha: 1 })))).toBe("#000000");
  });

  it("rounds each channel to the nearest of 256 steps", () => {
    // 0.5 * 255 = 127.5, which rounds to 128 (0x80); 0.498 * 255 = 126.99, which rounds to 127.
    expect(Hex.formatOpaque(getOrThrow(Srgb.make({ r: 0.5, g: 0.498, b: 1, alpha: 1 })))).toBe("#807FFF");
  });

  it("writes back every six-digit color it reads", () => {
    const hexDigit = fc.constantFrom(..."0123456789ABCDEF".split(""));
    const sixDigits = fc
      .array(hexDigit, { minLength: 6, maxLength: 6 })
      .map((digits) => `#${digits.join("")}`);
    fc.assert(
      fc.property(sixDigits, (hex) => {
        expect(Hex.formatOpaque(parsed(hex))).toBe(hex);
        expect(Hex.formatOpaque(parsed(hex.toLowerCase()))).toBe(hex);
      })
    );
  });
});
