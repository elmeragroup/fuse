// Unit under test: formatUnitless and formatUnitLabel, the Table's private cell and header forms.
// Oracle: CLDR 48's nb-NO and en-US number patterns and currency names, written by hand, and the
// spoken unit words of value-literals.ts, such as "kilowattimer". Every space is U+00A0, the
// canonical space of Fuse-formatted text.
import { describe, expect, it } from "vitest";

import { formatUnitLabel, formatUnitless } from "./value-format";

describe("formatUnitless", () => {
  it.each([
    ["energy in nb-NO", "nb-NO", 1234.5, { preset: "energy", unit: "kWh" }, "1 234,5", "1 234,5"],
    [
      "a negative energy value",
      "nb-NO",
      -0.42,
      { preset: "energy", unit: "kWh" },
      "−0,42",
      "minus\u00a00,42",
    ],
    [
      "a price in øre",
      "nb-NO",
      42.31,
      { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
      "42,3",
      "42,3",
    ],
    [
      "a price in kroner keeps two digits",
      "nb-NO",
      1.5,
      { preset: "unit-price", currency: "NOK", vat: "excluded" },
      "1,50",
      "1,50",
    ],
    ["Intl currency options in en-US", "en-US", 3, { style: "currency", currency: "USD" }, "3.00", "3.00"],
    [
      "Intl currency options with fewer digits than the currency's",
      "en-US",
      1234.4,
      { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
      "1,234",
      "1,234",
    ],
    ["plain Intl options", "en-US", 1234.5, { maximumFractionDigits: 0 }, "1,235", "1,235"],
    ["energy to its default 2 digits", "en-US", 1.23456, { preset: "energy", unit: "kWh" }, "1.23", "1.23"],
    ["power to its default 2 digits", "en-US", 2.34567, { preset: "power", unit: "kW" }, "2.35", "2.35"],
    [
      "Intl unit options without the unit",
      "en-US",
      12.5,
      { style: "unit", unit: "kilowatt-hour" },
      "12.5",
      "12.5",
    ],
    [
      "a currency with no minor unit at its own 0 digits",
      "en-US",
      1234.4,
      { style: "currency", currency: "JPY" },
      "1,234",
      "1,234",
    ],
    [
      "a currency with 3 minor digits at its own digits",
      "en-US",
      1.2,
      { style: "currency", currency: "KWD" },
      "1.200",
      "1.200",
    ],
    // signDisplay "negative" prints a value that rounds to 0 without a sign, where "auto" writes −0.
    ["plain Intl options rounding to 0", "en-US", -0.2, { maximumFractionDigits: 0 }, "0", "0"],
    [
      "Intl unit options rounding to 0",
      "en-US",
      -0.2,
      { style: "unit", unit: "kilowatt-hour", maximumFractionDigits: 0 },
      "0",
      "0",
    ],
    [
      "Intl currency options rounding to 0",
      "en-US",
      -0.2,
      { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
      "0",
      "0",
    ],
  ] as const)("prints %s without its unit", (_, locale, value, format, text, spoken) => {
    expect(formatUnitless(locale, value, format)).toEqual({ text, spoken });
  });
});

describe("formatUnitLabel", () => {
  it.each([
    ["energy", "nb-NO", { preset: "energy", unit: "kWh" }, { text: "kWh", spoken: "kilowattimer" }],
    [
      "a price in øre",
      "nb-NO",
      { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
      {
        text: "øre/kWh\u00a0inkl.\u00a0mva",
        spoken: "øre\u00a0per\u00a0kilowattime\u00a0inkludert\u00a0merverdiavgift",
      },
    ],
    [
      "a price in kroner",
      "nb-NO",
      { preset: "unit-price", currency: "NOK", vat: "excluded" },
      {
        text: "kr/kWh\u00a0eks.\u00a0mva",
        spoken: "norske\u00a0kroner\u00a0per\u00a0kilowattime\u00a0eksklusive\u00a0merverdiavgift",
      },
    ],
    // value-literals.ts speaks a power reading in nb-NO as "kilowatt".
    ["power", "nb-NO", { preset: "power", unit: "kW" }, { text: "kW", spoken: "kilowatt" }],
    // CLDR 48's nb-NO short and long percent unit and euro symbol and name.
    ["a percent unit", "nb-NO", { style: "unit", unit: "percent" }, { text: "%", spoken: "prosent" }],
    ["a currency", "nb-NO", { style: "currency", currency: "EUR" }, { text: "€", spoken: "euro" }],
  ] as const)("names the unit of %s", (_, locale, format, label) => {
    expect(formatUnitLabel(locale, format)).toEqual(label);
  });

  it("names no unit for plain numbers", () => {
    expect(formatUnitLabel("nb-NO", { maximumFractionDigits: 1 })).toBeNull();
  });
});
