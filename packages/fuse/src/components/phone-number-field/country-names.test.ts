import { afterEach, describe, expect, it, vi } from "vitest";

import { countryNameResolver, resetCountryNameCache, sortByCountryName } from "./country-names";

afterEach(() => {
  resetCountryNameCache();
  vi.restoreAllMocks();
});

describe("countryNameResolver", () => {
  it("reuses a per-locale cache across resolver instances", () => {
    const ofSpy = vi.spyOn(Intl.DisplayNames.prototype, "of");
    expect(countryNameResolver("en-US")("SE")).toBe("Sweden");
    expect(ofSpy).toHaveBeenCalledTimes(1);
    expect(countryNameResolver("en-US")("SE")).toBe("Sweden");
    expect(ofSpy).toHaveBeenCalledTimes(1);
  });
});

describe("sortByCountryName", () => {
  // ISO order, which is the name order in none of the locales below.
  const rows = [{ code: "AT" }, { code: "AX" }, { code: "CH" }, { code: "DE" }, { code: "ZA" }] as const;

  it.each([
    // Swedish puts Å before Ö, both after Z: Schweiz, Sydafrika, Tyskland, Åland, Österrike.
    ["sv-SE", ["CH", "ZA", "DE", "AX", "AT"]],
    // Norwegian puts Ø before Å, both after Z: Sveits, Sør-Afrika, Tyskland, Østerrike, Åland.
    ["nb-NO", ["CH", "ZA", "DE", "AT", "AX"]],
    // English sorts Å as A: Åland Islands, Austria, Germany, South Africa, Switzerland.
    ["en-US", ["AX", "AT", "DE", "ZA", "CH"]],
  ])("orders rows by their %s names and leaves the input in place", (locale, expected) => {
    const input = [...rows];
    expect(sortByCountryName(input, locale).map((row) => row.code)).toEqual(expected);
    expect(input).toEqual(rows);
  });

  it("falls back to English names and collation for a malformed locale", () => {
    expect(sortByCountryName(rows, "not a locale!").map((row) => row.code)).toEqual([
      "AX",
      "AT",
      "DE",
      "ZA",
      "CH",
    ]);
  });
});
