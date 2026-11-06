// Unit under test: numberAndUnit, the centre value's split before its unit (MOTION-REVIEW Fix
// R3.2). Oracle, written by hand from Norwegian and English formats: nb-NO groups thousands with a
// no-break space and writes the unit after a no-break space; en-US writes a currency code such as
// `NOK` before the number and a no-break space, and `$` against the number.
import { describe, expect, it } from "vitest";

import { numberAndUnit } from "./formatted-text";

describe("numberAndUnit", () => {
  it.each([
    ["1 837 kWh", "1 837", "kWh"],
    ["713 kWh", "713", "kWh"],
    ["−0,05 kr/kWh", "−0,05", "kr/kWh"],
    ["50 %", "50", "%"],
    ["9,9 kWh", "9,9", "kWh"],
    ["1,837 kWh", "1,837", "kWh"],
  ])("splits %s before its unit", (text, number, unit) => {
    expect(numberAndUnit(text)).toEqual({ number, unit, side: "after" });
  });

  it.each([
    ["NOK\u00a01,386", "NOK", "1,386"],
    ["-NOK\u00a00.05", "-NOK", "0.05"],
  ])("splits %s after its leading unit", (text, unit, number) => {
    expect(numberAndUnit(text)).toEqual({ number, unit, side: "before" });
  });

  it.each([["12"], ["$1,234"], ["1 234"], ["Mangler"]])("keeps %s whole", (text) => {
    expect(numberAndUnit(text)).toEqual({ number: text, unit: null });
  });
});
