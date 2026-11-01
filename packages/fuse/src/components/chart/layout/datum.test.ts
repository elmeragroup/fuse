// Unit under test: the datum selectors of layout/datum.ts. Oracle: CONTRACT section 8.10's rules,
// with each picked slot list written by hand from the values below.
import { describe, expect, it } from "vitest";

import { keywordSlots, listedSlots } from "./datum";

const VALUES = [null, 3, 5, 5, 2, null];
const WHOLE = { first: 0, last: 5 };

describe("keywordSlots", () => {
  it.each([
    ["first", [1]],
    ["last", [4]],
    ["max", [2, 3]],
    ["min", [4]],
  ] as const)("picks %s from the drawn slots, every tie included", (keyword, slots) => {
    expect(keywordSlots(keyword, { values: VALUES, window: WHOLE, nowSlot: -1 })).toEqual(slots);
  });

  it("picks the now slot inside the window, and nothing outside it", () => {
    expect(keywordSlots("now", { values: VALUES, window: WHOLE, nowSlot: 3 })).toEqual([3]);
    expect(keywordSlots("now", { values: VALUES, window: WHOLE, nowSlot: -1 })).toEqual([]);
    expect(keywordSlots("now", { values: VALUES, window: { first: 0, last: 2 }, nowSlot: 3 })).toEqual([]);
  });

  it("reads only the window", () => {
    const window = { first: 3, last: 4 };
    expect(keywordSlots("first", { values: VALUES, window, nowSlot: -1 })).toEqual([3]);
    expect(keywordSlots("max", { values: VALUES, window, nowSlot: -1 })).toEqual([3]);
    expect(
      keywordSlots("min", { values: [4, -2, -2, 1], window: { first: 0, last: 3 }, nowSlot: -1 })
    ).toEqual([1, 2]);
  });

  it("reaches both ends of the window", () => {
    // The window's last slot holds the last drawn value, and now on either end of the window counts.
    expect(keywordSlots("last", { values: VALUES, window: { first: 3, last: 4 }, nowSlot: -1 })).toEqual([4]);
    expect(keywordSlots("now", { values: VALUES, window: WHOLE, nowSlot: 0 })).toEqual([0]);
    expect(keywordSlots("now", { values: VALUES, window: WHOLE, nowSlot: 5 })).toEqual([5]);
  });

  it("picks the last drawn slot, not the lowest one", () => {
    // In [4, -2, -2, 1] the last drawn slot is 3, where the lowest values sit at 1 and 2.
    expect(
      keywordSlots("last", { values: [4, -2, -2, 1], window: { first: 0, last: 3 }, nowSlot: -1 })
    ).toEqual([3]);
  });

  it("picks nothing from a window with no drawn value", () => {
    expect(keywordSlots("max", { values: [null, null], window: { first: 0, last: 1 }, nowSlot: -1 })).toEqual(
      []
    );
  });
});

describe("listedSlots", () => {
  it("keeps the listed slots inside the window, once each and in x order", () => {
    expect(listedSlots([4, -1, 2, 2, 9], WHOLE)).toEqual([2, 4]);
    expect(listedSlots([1, 5], { first: 2, last: 4 })).toEqual([]);
    expect(listedSlots([2, 4], { first: 2, last: 4 })).toEqual([2, 4]);
  });
});
