import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import * as Cvd from "./cvd.ts";
import type { Deficiency } from "./cvd.ts";
import * as Hex from "./hex.ts";
import * as Oklab from "./oklab.ts";
import { getOrThrow } from "./result.ts";
import { grey } from "./srgb.arbitrary.ts";
import * as Srgb from "./srgb.ts";

const DEFICIENCIES = ["protan", "deutan", "tritan"] as const satisfies readonly Deficiency[];

function hex(input: string): Srgb.Srgb {
  return getOrThrow(Hex.parse(input));
}

function linear(color: Srgb.Srgb): readonly [number, number, number] {
  const { r, g, b } = Srgb.toLinear(color);
  return [r, g, b];
}

type Pairs = "adjacent" | "all";

/** The smallest distance over the palette's adjacent pairs, or over all of its pairs. */
function worst(palette: readonly string[], pairs: Pairs, distance: (a: Srgb.Srgb, b: Srgb.Srgb) => number) {
  const colors = palette.map(hex);
  const pairList = colors.flatMap((left, index) =>
    (pairs === "adjacent" ? colors.slice(index + 1, index + 2) : colors.slice(index + 1)).map(
      (right) => [left, right] as const
    )
  );
  return Math.min(...pairList.map(([left, right]) => distance(left, right)));
}

describe("simulate", () => {
  // Machado, Oliveira and Fernandes (2009), table 1 at severity 1.0. A linear primary picks out
  // one column of the matrix, and the simulation clips each channel into the gamut.
  const columns = [
    ["protan", "#ff0000", [0.152286, 0.114503, -0.003882]],
    ["protan", "#00ff00", [1.052583, 0.786281, -0.048116]],
    ["protan", "#0000ff", [-0.204868, 0.099216, 1.051998]],
    ["deutan", "#ff0000", [0.367322, 0.280085, -0.01182]],
    ["deutan", "#00ff00", [0.860646, 0.672501, 0.04294]],
    ["deutan", "#0000ff", [-0.227968, 0.047413, 0.968881]],
    ["tritan", "#ff0000", [1.255528, -0.078411, 0.004733]],
    ["tritan", "#00ff00", [-0.076749, 0.930809, 0.691367]],
    ["tritan", "#0000ff", [-0.178779, 0.147602, 0.3039]],
  ] as const satisfies readonly (readonly [Deficiency, string, readonly number[]])[];

  it("maps each linear primary onto its column of the published Machado matrix, clipped to the gamut", () => {
    for (const [deficiency, primary, column] of columns) {
      const simulated = linear(Cvd.simulate(hex(primary), deficiency));
      column.forEach((value, channel) => {
        expect(simulated[channel], `${deficiency} ${primary} channel ${String(channel)}`).toBeCloseTo(
          Math.min(1, Math.max(0, value)),
          9
        );
      });
    }
  });

  it("leaves every grey unchanged, because each matrix row sums to 1", () => {
    fc.assert(
      fc.property(grey, fc.constantFrom(...DEFICIENCIES), (color, deficiency) => {
        const simulated = Cvd.simulate(color, deficiency);
        for (const channel of [simulated.r, simulated.g, simulated.b]) {
          expect(Math.abs(channel - color.r)).toBeLessThan(1e-5);
        }
      })
    );
  });

  it("keeps the alpha", () => {
    const translucent = getOrThrow(Srgb.make({ r: 0.9, g: 0.2, b: 0.1, alpha: 0.4 }));
    expect(Cvd.simulate(translucent, "deutan").alpha).toBe(0.4);
  });
});

describe("deltaE", () => {
  it("puts red and green closer than normal vision does", () => {
    // Red and green fall together for both dichromats.
    const [red, green] = [hex("#ff0000"), hex("#00ff00")];
    expect(Cvd.deltaE(red, green)).toBeLessThan(Oklab.deltaE(red, green));
  });
});

// Unit under test: `Oklab.deltaE` and `Cvd.deltaE`. Oracle: the eight figures the dataviz skill's
// reference palette publishes in `references/palette.md`, each to one decimal.
describe("the reference palette's published figures", () => {
  const light = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
  const dark = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

  it.each([
    ["adjacent CVD, light", light, "adjacent", Cvd.deltaE, "9.1"],
    ["adjacent CVD, dark", dark, "adjacent", Cvd.deltaE, "8.4"],
    ["adjacent normal vision, light", light, "adjacent", Oklab.deltaE, "19.6"],
    ["adjacent normal vision, dark", dark, "adjacent", Oklab.deltaE, "19.3"],
    ["first three, all pairs, CVD, light", light.slice(0, 3), "all", Cvd.deltaE, "9.2"],
    ["first three, all pairs, CVD, dark", dark.slice(0, 3), "all", Cvd.deltaE, "9.4"],
    ["first three, all pairs, normal vision, light", light.slice(0, 3), "all", Oklab.deltaE, "24.0"],
    ["first three, all pairs, normal vision, dark", dark.slice(0, 3), "all", Oklab.deltaE, "20.9"],
  ] as const)("reproduces the worst %s", (_, palette, pairs, distance, published) => {
    expect(worst(palette, pairs, distance).toFixed(1)).toBe(published);
  });
});
