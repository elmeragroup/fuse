// The mode choice of ticket svg-2's D2. Unit under test: pathMotion. Oracle: F10's four cases as
// ticket 06 states them, written out by hand as key lists. Keys stand in for pairSlotKeys' output,
// which keeps a shared slot's key and pairs slots by position when no slot is shared. The route
// each vertex takes for a mode is pathStep's, and chart-path-draw.test.ts checks it.
import { describe, expect, it } from "vitest";

import { pathMotion } from "./path-motion";

/** A window whose keys are its slot identities, as on the first render. */
function slots(...ids: string[]) {
  return { keys: ids, ids };
}

describe("pathMotion", () => {
  it("tweens when the update keeps every slot", () => {
    expect(pathMotion(slots("a", "b", "c"), slots("a", "b", "c"))).toEqual({ mode: "tween", by: 0 });
  });

  it("tweens a whole-window shift that shares no slot, because the keys pair by position", () => {
    // 1 to 3 October moves to 4 to 6 October: no slot is shared, so 4 October takes 1 October's key.
    const next = { keys: ["1", "2", "3"], ids: ["4", "5", "6"] };
    expect(pathMotion(slots("1", "2", "3"), next)).toEqual({ mode: "tween", by: 0 });
  });

  it("slides an append that drops the first reading by one slot", () => {
    expect(pathMotion(slots("a", "b", "c"), slots("b", "c", "d"))).toEqual({ mode: "slide", by: 1 });
  });

  it("slides the other way when the window moves back by two slots", () => {
    expect(pathMotion(slots("c", "d", "e"), slots("a", "b", "c"))).toEqual({ mode: "slide", by: -2 });
  });

  it("pairs a longer month by position", () => {
    // September's 30 days to October's 31: the first 30 keys pair, and 31 October is new.
    const september = Array.from({ length: 30 }, (_, day) => `s${String(day + 1)}`);
    const october = {
      keys: [...september, "o31"],
      ids: Array.from({ length: 31 }, (_, day) => `o${String(day + 1)}`),
    };
    expect(pathMotion(slots(...september), october)).toEqual({ mode: "pair", by: 0 });
  });

  it("pairs a shorter month by position", () => {
    expect(pathMotion(slots("o1", "o2", "o3"), { keys: ["o1", "o2"], ids: ["s1", "s2"] })).toEqual({
      mode: "pair",
      by: 0,
    });
  });

  it("crossfades a window that grows to six hours, because it shares slots without shifting", () => {
    expect(pathMotion(slots("c", "d"), slots("a", "b", "c", "d"))).toEqual({ mode: "crossfade" });
  });

  it("crossfades a shift whose arriving slot is no new slot", () => {
    expect(pathMotion(slots("a", "b", "c"), slots("b", "c", "a"))).toEqual({ mode: "crossfade" });
  });

  it("crossfades an update on another grid, whose keys start fresh", () => {
    expect(pathMotion(slots("h1", "h2"), slots("d1", "d2"))).toEqual({ mode: "crossfade" });
  });
});
