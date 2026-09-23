/**
 * fast-check arbitraries for {@link Oklch}, built through its smart constructor so every
 * sample satisfies the type's ranges.
 */

import * as fc from "fast-check";

import { make } from "./oklch.ts";
import type { Oklch } from "./oklch.ts";
import { getOrThrow } from "./result.ts";

const unit = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

/** Any OKLCH color `make` accepts, with chroma up to the widest display gamuts. */
export const oklch: fc.Arbitrary<Oklch> = fc
  .record({
    l: unit,
    c: fc.double({ min: 0, max: 0.5, noNaN: true, noDefaultInfinity: true }),
    h: fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true, noDefaultInfinity: true }),
    alpha: unit,
  })
  .map((components) => getOrThrow(make(components)));
