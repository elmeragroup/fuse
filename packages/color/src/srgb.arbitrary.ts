/**
 * fast-check arbitraries for {@link Srgb}, built through its smart constructor so every sample
 * sits inside the gamut.
 */

import * as fc from "fast-check";

import { getOrThrow } from "./result.ts";
import { make } from "./srgb.ts";
import type { Srgb } from "./srgb.ts";

const unit = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

/** Any gamma-encoded sRGB color `make` accepts, of any alpha. */
export const srgb: fc.Arbitrary<Srgb> = fc
  .record({ r: unit, g: unit, b: unit, alpha: unit })
  .map((components) => getOrThrow(make(components)));

/** An opaque grey, with its three channels equal. */
export const grey: fc.Arbitrary<Srgb> = unit.map((value) =>
  getOrThrow(make({ r: value, g: value, b: value, alpha: 1 }))
);
