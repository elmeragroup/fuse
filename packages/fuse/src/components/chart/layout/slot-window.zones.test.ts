import { describe, expect, it } from "vitest";

import slots from "../format/fixtures/slots.json" with { type: "json" };
import { nearestSeries } from "./nearest-series";
import { effectiveWindow, keepSlot, stepSlot } from "./slot-window";
import { placeCategoryRows, placeTimeRows, slotX } from "./x-domain";

// The month-switch fixture of CONTRACT section 8.12, written by hand: October 2025 daily rows in
// Oslo, first through the 30th, then a reload that adds the 31st.
const october = slots.day["Europe/Oslo"]["2025-10"].utc_start.map((start) => new Date(start));
const september = slots.day["Europe/Oslo"]["2025-09"].utc_start.map((start) => new Date(start));
const options = { interval: "day", timeZone: "Europe/Oslo" } as const;
const before = placeTimeRows(october.slice(0, 30), options).domain;
const after = placeTimeRows(october, options).domain;
const day = (n: number): Date => october[n - 1] ?? new Date(Number.NaN);

describe("the effective window", () => {
  it("keeps 10 to 20 October as 11 slots", () => {
    expect(effectiveWindow(before, [day(10), day(20)])).toEqual({ first: 9, last: 19 });
  });

  it("matches a value a millisecond into its slot", () => {
    const late = new Date(day(20).getTime() + 1);
    expect(effectiveWindow(before, [day(10), late])).toEqual({ first: 9, last: 19 });
  });

  it("survives the reload that adds a day", () => {
    expect(effectiveWindow(after, [day(10), day(20)])).toEqual({ first: 9, last: 19 });
  });

  it("falls back to the whole of October for a September window", () => {
    expect(effectiveWindow(after, [september[0], september[29]])).toEqual({ first: 0, last: 30 });
  });

  it("is the whole domain without a range, and null for an empty one", () => {
    expect(effectiveWindow(after, undefined)).toEqual({ first: 0, last: 30 });
    expect(effectiveWindow(placeTimeRows([], options).domain, undefined)).toBeNull();
  });

  it("needs both categories to exist on a category axis", () => {
    const { domain } = placeCategoryRows(["a", "b", "c", "d"]);
    expect(effectiveWindow(domain, ["c", "b"])).toEqual({ first: 1, last: 2 });
    expect(effectiveWindow(domain, ["b", "z"])).toEqual({ first: 0, last: 3 });
    expect(effectiveWindow(domain, ["z", "b"])).toEqual({ first: 0, last: 3 });
  });

  it("keeps the slots a time range overlaps even when the range starts before the domain", () => {
    expect(effectiveWindow(after, [september[24], day(5)])).toEqual({ first: 0, last: 4 });
  });

  it("is the whole domain for a range with an invalid instant", () => {
    expect(effectiveWindow(after, [new Date(Number.NaN), day(5)])).toEqual({ first: 0, last: 30 });
    expect(effectiveWindow(after, [day(5), new Date(Number.NaN)])).toEqual({ first: 0, last: 30 });
  });
});

describe("the window walk", () => {
  const window = { first: 9, last: 19 };

  it("pages by max(1, round(count / 10)) slots: 2 of 24 and 37 of 365", () => {
    expect(stepSlot({ first: 0, last: 23 }, 0, "page-next")).toBe(2);
    expect(stepSlot({ first: 0, last: 364 }, 0, "page-next")).toBe(37);
    expect(stepSlot({ first: 0, last: 4 }, 0, "page-next")).toBe(1);
  });

  it("pages by the window's own count, wherever the window starts", () => {
    expect(stepSlot({ first: 10, last: 33 }, 10, "page-next")).toBe(12);
    expect(stepSlot({ first: 0, last: 23 }, 10, "page-previous")).toBe(8);
  });

  it("reaches the window's first and last slot with Home and End", () => {
    expect(stepSlot(window, 12, "first")).toBe(9);
    expect(stepSlot(window, 12, "last")).toBe(19);
  });

  it("stops at the window's ends", () => {
    expect(stepSlot(window, 19, "next")).toBe(19);
    expect(stepSlot(window, 9, "previous")).toBe(9);
    expect(stepSlot(window, 18, "page-next")).toBe(19);
    expect(stepSlot(window, 10, "page-previous")).toBe(9);
  });
});

describe("the active slot across new data", () => {
  it("keeps its x when the reload adds a day", () => {
    const window = effectiveWindow(after, [day(10), day(20)]);
    expect(window && keepSlot(after, window, slotX(before, 14))).toBe(14);
  });

  it("keeps an x on either end of the window", () => {
    const window = { first: 9, last: 19 };
    expect(keepSlot(after, window, day(10))).toBe(9);
    expect(keepSlot(after, window, day(20))).toBe(19);
    expect(keepSlot(after, window, day(21))).toBe(9);
  });

  it("gives way to the window's first slot when its x leaves the window", () => {
    const window = effectiveWindow(after, [september[0], september[29]]);
    expect(window && keepSlot(after, window, september[5])).toBe(0);
  });
});

describe("the nearest series, written by hand", () => {
  it("picks the key whose drawn value is nearest the pointer", () => {
    expect(nearestSeries([1, 5, 9], 6)).toBe(1);
  });

  it("skips keys with no reading and gives a tie to the earlier key", () => {
    expect(nearestSeries([null, 4, 6], 5)).toBe(1);
  });

  it("picks nothing in a layout of one key", () => {
    expect(nearestSeries([3], 3)).toBe(-1);
  });

  it("picks between two keys", () => {
    expect(nearestSeries([1, 5], 4)).toBe(1);
  });

  it("never picks a key with no reading, even beside the pointer", () => {
    expect(nearestSeries([null, 5], 0)).toBe(1);
    expect(nearestSeries([null, null], 0)).toBe(-1);
  });
});
