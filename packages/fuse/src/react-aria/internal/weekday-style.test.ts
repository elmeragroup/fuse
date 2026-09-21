import { describe, expect, it } from "vitest";

import { weekdayStyle } from "./weekday-style";

describe("weekdayStyle", () => {
  it("keeps the short weekday names when they fit a grid column", () => {
    expect(weekdayStyle("en-US")).toBe("short");
    expect(weekdayStyle("nb-NO")).toBe("short");
  });

  it("falls back to narrow glyphs when the short names overflow a column", () => {
    expect(weekdayStyle("ar-EG")).toBe("narrow");
  });
});
