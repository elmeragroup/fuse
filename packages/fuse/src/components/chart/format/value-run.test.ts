// Unit under test: formatValueRun, the split a polar centre lays out: the number large and the text
// around it small. Oracle, written by hand from Norwegian and English formats: nb-NO groups
// thousands with a no-break space and writes a unit after one, en-US writes a currency code before
// the number, scientific notation writes its exponent with an E, a forced sign leads the number unless a currency stands between them,
// and nb-NO's compact form writes "mill." after a no-break space. Each split's parts join to the
// value's own visual text.
import { describe, expect, it } from "vitest";

import type { SupportedLocale } from "../../../intl/locale-context";
import type { ValueFormat } from "../chart-types";
import { formatValue, formatValueRun } from "./value-format";

const NBSP = " ";

describe("formatValueRun", () => {
  it.each<[SupportedLocale, number, ValueFormat, string, string, string]>([
    [
      "nb-NO",
      1837,
      { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
      "",
      `1${NBSP}837`,
      `${NBSP}kWh`,
    ],
    ["nb-NO", -0.05, { preset: "energy", unit: "kWh" }, "", "−0,05", `${NBSP}kWh`],
    [
      "nb-NO",
      142.3,
      { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
      "",
      "142,3",
      `${NBSP}øre/kWh${NBSP}inkl.${NBSP}mva`,
    ],
    [
      "en-US",
      1.386,
      { preset: "unit-price", currency: "NOK", vat: "excluded" },
      `NOK${NBSP}`,
      "1.39",
      `/kWh${NBSP}excl.${NBSP}VAT`,
    ],
    ["en-US", 3900, { notation: "scientific" }, "", "3.9E3", ""],
    ["en-US", 0.05, { style: "percent", signDisplay: "always" }, "", "+5", "%"],
    ["en-US", 3.9, { style: "currency", currency: "NOK", signDisplay: "always" }, `+NOK${NBSP}`, "3.90", ""],
    ["nb-NO", 1_234_567, { notation: "compact" }, "", `1,2${NBSP}mill.`, ""],
    ["nb-NO", 0.5, { style: "percent" }, "", "50", `${NBSP}%`],
  ])("splits %s %d at its number", (locale, value, format, before, number, after) => {
    const run = formatValueRun(locale, value, format, "full");
    expect(run).toEqual({ before, number, after });
    expect(`${run.before}${run.number}${run.after}`).toBe(formatValue(locale, value, format, "full").text);
  });
});
