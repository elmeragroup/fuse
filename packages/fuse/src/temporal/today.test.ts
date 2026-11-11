import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit under test: `today`. Oracle: the calendar date at a fixed instant in each zone, worked out
 * by hand from the zones' offsets. The instant comes from a faked `Date`, the seam tests use.
 */
import "../temporal-polyfill";
import { today } from "./today";

describe("today", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 23:30 UTC: already the 16th in Oslo (+02:00) and Tokyo (+09:00), still the 15th in New York.
    vi.setSystemTime(new Date("2030-06-15T23:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["Europe/Oslo", "2030-06-16"],
    ["Asia/Tokyo", "2030-06-16"],
    ["America/New_York", "2030-06-15"],
    ["UTC", "2030-06-15"],
  ])("reads the faked clock's date in %s", (timeZone, expected) => {
    expect(today(timeZone).toString()).toBe(expected);
  });
});
