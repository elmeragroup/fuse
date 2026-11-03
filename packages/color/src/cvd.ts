/**
 * Color vision deficiency simulation by Machado, Oliveira and Fernandes (2009) at severity 1.0,
 * and the ΔE between two colors as dichromats see them. The chart palette's CVD thresholds are
 * calibrated against this model, so another model, such as Viénot 1999, would move borderline
 * pairs and is not a substitute.
 */

import { apply } from "./matrix3.ts";
import type { Matrix3 } from "./matrix3.ts";
import * as Oklab from "./oklab.ts";
import { getOrThrow } from "./result.ts";
import * as Srgb from "./srgb.ts";

/** The dichromacy a simulation models: missing long, medium or short cones. */
export type Deficiency = "protan" | "deutan" | "tritan";

// Machado, Oliveira and Fernandes (2009), table 1, severity 1.0. Each matrix maps linear sRGB
// to the linear sRGB a dichromat perceives. Every row sums to 1, so greys stay put.
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const satisfies Record<Deficiency, Matrix3>;

/**
 * The color a reader with a full dichromacy sees, by Machado 2009 at severity 1.0 in linear
 * light, with each channel clipped into the gamut.
 *
 * @param color - The color as drawn.
 * @param deficiency - The dichromacy to model.
 * @returns The simulated color, with the same alpha.
 */
export function simulate(color: Srgb.Srgb, deficiency: Deficiency): Srgb.Srgb {
  const { r, g, b } = Srgb.toLinear(color);
  const [red, green, blue] = apply(MACHADO[deficiency], [r, g, b]);
  // The matrices keep every channel finite, so the linear color always constructs, and
  // `fromLinear` clips it into the gamut.
  return Srgb.fromLinear(getOrThrow(Srgb.makeLinear({ r: red, g: green, b: blue, alpha: color.alpha })));
}

/**
 * ΔE between two colors as a dichromat sees them: the smaller of the OKLab ΔE under protan and
 * under deutan simulation, the two common deficiencies. Tritan is rare, so it does not enter.
 *
 * @param left - One color. Its alpha does not enter.
 * @param right - The other color.
 * @returns The smaller of the protan and deutan distances.
 */
export function deltaE(left: Srgb.Srgb, right: Srgb.Srgb): number {
  return Math.min(
    Oklab.deltaE(simulate(left, "protan"), simulate(right, "protan")),
    Oklab.deltaE(simulate(left, "deutan"), simulate(right, "deutan"))
  );
}
