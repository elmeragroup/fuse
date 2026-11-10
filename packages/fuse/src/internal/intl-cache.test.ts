// The shared Intl caches. Unit under test: numberFormat, as every cache keys its entries the same
// way. Oracle: the cache's contract, one formatter per locale and options, and the options are a
// set of fields, so two literals that name the same options in another key order are one entry,
// and an option set to undefined is one left out, as Intl reads it.
import { describe, expect, it } from "vitest";

import { numberFormat } from "./intl-cache";

describe("the Intl caches", () => {
  it("hands out one formatter for the same options in any key order", () => {
    const first = numberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });
    const again = numberFormat("nb-NO", { maximumFractionDigits: 0, currency: "NOK", style: "currency" });
    expect(again).toBe(first);
  });

  it("hands out one formatter for an option set to undefined and the same option left out", () => {
    const omitted = numberFormat("nb-NO", { style: "currency", currency: "NOK", minimumFractionDigits: 2 });
    const unset = numberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 2,
      maximumFractionDigits: undefined,
    });
    expect(unset).toBe(omitted);
  });

  it("keeps a formatter apart for other options and for another locale", () => {
    const kroner = numberFormat("nb-NO", { style: "currency", currency: "NOK" });
    expect(numberFormat("nb-NO", { style: "currency", currency: "SEK" })).not.toBe(kroner);
    expect(numberFormat("sv-SE", { style: "currency", currency: "NOK" })).not.toBe(kroner);
  });
});
