// A live reading's time. Unit under test: liveTimeText. Oracle: nb-NO's CLDR time with three
// fractional digits, written by hand: 12:00:00.123 UTC on 16 October 2026 is 14:00:00,123 in Oslo.
import { describe, expect, it } from "vitest";

import { liveTimeText } from "./live-line-chart-text";

const NOON = Date.UTC(2026, 9, 16, 12);

describe("liveTimeText", () => {
  it("prints a reading's own instant, milliseconds and all, in Intl options that name them", () => {
    const text = {
      locale: "nb-NO",
      timeZone: "Europe/Oslo",
      timeFormat: { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 },
    } as const;
    expect(liveTimeText(text, NOON + 123, "full")).toEqual({ text: "14:00:00,123", spoken: "14:00:00,123" });
    expect(liveTimeText(text, NOON + 456, "tick").text).toBe("14:00:00,456");
  });
});
