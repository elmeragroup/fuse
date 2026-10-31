import { describe, expect, it } from "vitest";

import { weekdayStyle } from "./weekday-style";

describe("weekdayStyle", () => {
  it.each([
    ["en-US", "short"],
    ["nb-NO", "short"],
    // The short names overflow a grid column, so the narrow glyphs take over.
    ["ar-EG", "narrow"],
  ] as const)("picks the %s weekday style that fits a grid column", (locale, style) => {
    expect(weekdayStyle(locale)).toBe(style);
  });
});
