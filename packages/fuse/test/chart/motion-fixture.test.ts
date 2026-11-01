// Unit under test: the TypeScript motion fixture the browser judges render. Oracle: the values
// typed by hand into motion_fixture.py, which motion-frames.json carries, so the judges'
// expectations and the rendered rows describe the same days.
import { describe, expect, it } from "vitest";

import { MOTION_A, MOTION_B, MOTION_C, oslo } from "./motion-fixture";
import type { MotionRow } from "./motion-fixture";
import frames from "./motion-frames.json" with { type: "json" };

function asRows(month: 10 | 11, table: { readonly [day: string]: readonly number[] }): MotionRow[] {
  return Object.entries(table).map(([day, [p = 0, q = 0]]) => ({ day: oslo(month, Number(day)), p, q }));
}

describe("the motion fixture", () => {
  it.each([
    ["A", MOTION_A, 10, frames.A],
    ["B", MOTION_B, 10, frames.B],
    ["C", MOTION_C, 11, frames.C],
  ] as const)("holds the oracle's data %s", (_, rows, month, table) => {
    expect(rows).toEqual(asRows(month, table));
  });

  it("puts Oslo midnight on 22:00 UTC in summer time and 23:00 UTC after 26 October", () => {
    expect(oslo(10, 1).toISOString()).toBe("2025-09-30T22:00:00.000Z");
    expect(oslo(11, 1).toISOString()).toBe("2025-10-31T23:00:00.000Z");
  });
});
