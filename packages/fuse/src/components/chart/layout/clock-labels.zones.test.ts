// Unit under test: clockLabelSlots over a day with a half-hour daylight saving change. Oracle,
// worked by hand from the tz rules: Australia/Lord_Howe springs from UTC+10:30 to UTC+11 at 02:00
// on 5 October 2025, so the day runs 23.5 hours, from 13:30 UTC on the 4th to 13:00 UTC on the
// 5th. Its hourly slots start at 00:00 and 01:00, then 02:30, 03:30 and so on to 23:30, 24 slots
// on the 24 wall-clock hours 00 to 23, and each hour labels its slot.
import { describe, expect, it } from "vitest";

import { slotStartsFrom } from "../format/time-format";
import { clockLabelSlots } from "./clock-labels";

describe("hour labels across a half-hour change", () => {
  it("labels every hour of Lord Howe's 23.5-hour spring day", () => {
    const first = Date.parse("2025-10-04T13:30:00Z");
    const end = Date.parse("2025-10-05T13:00:00Z");
    const starts = slotStartsFrom(first, (start) => start >= end, "hour", "Australia/Lord_Howe");
    expect(starts).toHaveLength(24);
    const labels = clockLabelSlots(starts, "Australia/Lord_Howe", "day");
    expect(labels.map(({ unit }) => unit)).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
    expect(labels.map(({ slot }) => slot)).toEqual(Array.from({ length: 24 }, (_, slot) => slot));
  });
});
