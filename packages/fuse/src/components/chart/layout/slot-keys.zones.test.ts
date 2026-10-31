// Unit under test: pairSlotKeys. Oracle: the pairing rules of motion-decision.md rule 2, with every
// expected key list written by hand from the slot starts below.
import { describe, expect, it } from "vitest";

import { pairSlotKeys } from "./slot-keys";
import type { XDomain } from "./x-domain";

/** Oslo midnight of a day in October or November 2025, in summer time up to 26 October. */
function day(month: 10 | 11, date: number): number {
  const summer = month === 10 && date <= 26;
  return Date.UTC(2025, month - 1, date, summer ? -2 : -1);
}

function days(month: 10 | 11, first: number, last: number, interval: "day" | "hour" = "day"): XDomain {
  const dates = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const starts = dates.map((date) => day(month, date));
  // Each start is the Oslo midnight of its date.
  const walls = dates.map((date) => ({ year: 2025, month, day: date, hour: 0, minute: 0, second: 0 }));
  return {
    kind: "time",
    interval,
    timeZone: "Europe/Oslo",
    starts,
    ends: starts.map((start) => start + 1),
    walls,
  };
}

function categories(...names: string[]): XDomain {
  return { kind: "category", names };
}

describe("pairSlotKeys", () => {
  it("keys the first render by slot", () => {
    expect(pairSlotKeys(null, days(10, 1, 3)).keys).toEqual([
      String(day(10, 1)),
      String(day(10, 2)),
      String(day(10, 3)),
    ]);
  });

  it("keeps each surviving slot's key when the update shares slots", () => {
    const a = pairSlotKeys(null, days(10, 1, 10));
    const b = pairSlotKeys(a, days(10, 2, 11));
    expect(b.keys[0]).toBe(String(day(10, 2)));
    expect(b.keys[8]).toBe(String(day(10, 10)));
    expect(b.keys[9]).toBe(String(day(10, 11)));
  });

  it("pairs by position from the domain start when the update shares no slot", () => {
    const b = pairSlotKeys(pairSlotKeys(null, days(10, 1, 10)), days(10, 2, 11));
    const c = pairSlotKeys(b, days(11, 1, 9));
    // November's nine slots take the keys of 2 to 10 October, and 11 October's key leaves.
    expect(c.keys).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10].map((date) => String(day(10, date))));
    // A later update that shares November slots keeps those paired keys.
    const d = pairSlotKeys(c, days(11, 2, 10));
    expect(d.keys.slice(0, 8)).toEqual([3, 4, 5, 6, 7, 8, 9, 10].map((date) => String(day(10, date))));
    expect(d.keys[8]).toBe(String(day(11, 10)));
  });

  it("adds a key for each position past the old domain's end", () => {
    const short = pairSlotKeys(null, categories("a", "b"));
    expect(pairSlotKeys(short, categories("c", "d", "e")).keys).toEqual(["a", "b", "e"]);
  });

  it("gives a fresh id a suffix when a kept key already holds it", () => {
    const paired = pairSlotKeys(pairSlotKeys(null, categories("a", "b")), categories("c", "d"));
    expect(paired.keys).toEqual(["a", "b"]);
    // "c" keeps the key "a", so the fresh category "a" cannot take it.
    expect(pairSlotKeys(paired, categories("a", "c")).keys).toEqual(["a~1", "a"]);
  });

  it("counts up the suffix until a fresh id is free", () => {
    const previous = { domain: categories("x", "y"), keys: ["a", "a~1"] };
    expect(pairSlotKeys(previous, categories("x", "y", "a")).keys).toEqual(["a", "a~1", "a~2"]);
  });

  it("pairs no position across a time zone change", () => {
    const oslo = pairSlotKeys(null, days(10, 1, 2));
    const november = days(11, 1, 2);
    if (november.kind !== "time") throw new Error("not a time axis");
    const helsinki: XDomain = { ...november, timeZone: "Europe/Helsinki" };
    expect(pairSlotKeys(oslo, helsinki).keys).toEqual([String(day(11, 1)), String(day(11, 2))]);
  });

  it("pairs no position from a category axis to a time axis", () => {
    const named = pairSlotKeys(null, categories("x", "y"));
    expect(pairSlotKeys(named, days(10, 1, 2)).keys).toEqual([String(day(10, 1)), String(day(10, 2))]);
  });

  it("pairs no position across an interval change", () => {
    const hours = pairSlotKeys(null, days(10, 1, 3, "hour"));
    const next = pairSlotKeys(hours, days(11, 1, 2));
    expect(next.keys).toEqual([String(day(11, 1)), String(day(11, 2))]);
  });

  it("pairs no position between a time axis and a category axis", () => {
    const time = pairSlotKeys(null, days(10, 1, 2));
    expect(pairSlotKeys(time, categories("x", "y")).keys).toEqual(["x", "y"]);
  });

  it("keeps every fresh key unique, including one a renamed category already spells", () => {
    // Step 2 pairs b by position with a's key "a". Step 3 keeps b on "a", so the fresh id a takes
    // "a~1", and the fresh category literally named "a~1" must step past it to "a~1~1".
    const one = pairSlotKeys(null, categories("a"));
    const two = pairSlotKeys(one, categories("b"));
    expect(two.keys).toEqual(["a"]);
    expect(pairSlotKeys(two, categories("b", "a", "a~1")).keys).toEqual(["a", "a~1", "a~1~1"]);
  });
});
