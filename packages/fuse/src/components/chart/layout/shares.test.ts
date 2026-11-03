import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { roundShares } from "./shares";

describe("section 8.13 shares, written by hand", () => {
  it("rounds three equal thirds to 34, 33 and 33", () => {
    expect(roundShares([1, 1, 1], 0)).toEqual([34, 33, 33]);
  });

  it("rounds [1240, 680, 410, 95] to 51, 28, 17 and 4", () => {
    // 1240 / 2425 = 51.13 %, 680 / 2425 = 28.04 %, 410 / 2425 = 16.91 % and 95 / 2425 = 3.92 %.
    // The floors sum to 98, so the two largest remainders, 0.92 and 0.91, take one unit each.
    expect(roundShares([1240, 680, 410, 95], 0)).toEqual([51, 28, 17, 4]);
  });

  it("rounds at one digit", () => {
    // In tenths of a percent: 511.34, 280.41, 169.07 and 39.18 floor to a sum of 999, so the
    // largest remainder, 0.41, takes the missing tenth.
    expect(roundShares([1240, 680, 410, 95], 1)).toEqual([51.1, 28.1, 16.9, 3.9]);
  });

  it("prints no share when the parts sum to 0", () => {
    expect(roundShares([0, 0], 0)).toEqual([null, null]);
  });

  it("rounds signed parts on their magnitudes and keeps their signs", () => {
    expect(roundShares([3, -1], 0)).toEqual([75, -25]);
  });

  it("writes a zero share of a negative part as +0", () => {
    const [share] = roundShares([-0.001, 1000], 0);
    expect(Object.is(share, 0)).toBe(true);
  });

  it("gives a tie to the earlier part", () => {
    expect(roundShares([1, 1], 0)).toEqual([50, 50]);
    expect(roundShares([1, 1, 1, 1, 1, 1], 0)).toEqual([17, 17, 17, 17, 16, 16]);
  });
});

describe("share sets as properties", () => {
  it("sum to exactly 100 in magnitude at 0, 1 and 2 digits", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -10_000, max: 10_000 }), { minLength: 1, maxLength: 12 }),
        fc.constantFrom(0, 1, 2),
        (parts, digits) => {
          const shares = roundShares(parts, digits);
          if (parts.every((part) => part === 0)) return;
          const unit = 10 ** digits;
          const total = shares.reduce<number>(
            (sum, share) => sum + Math.round(Math.abs(share ?? 0) * unit),
            0
          );
          expect(total).toBe(100 * unit);
        }
      ),
      { seed: 20261018, numRuns: 1000 }
    );
  });
});
