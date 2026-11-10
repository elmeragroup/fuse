// Unit under test: the near series' hysteresis. Oracle, worked by
// hand from the rule: the held series stays until another lies nearer by more than 0.06 of the
// outer radius, a tie keeps it, and with nothing held the nearest wins, a tie going to the earlier. A
// firm hold, just after the near series changed, keeps it while it has a reading.
import { describe, expect, it } from "vitest";

import { nearestHeld } from "./near-series";

describe("nearestHeld", () => {
  it.each([
    ["0.05 nearer keeps the held series", [0.3, 0.25], 0, 0],
    ["0.07 nearer takes over", [0.3, 0.23], 0, 1],
    ["exactly 0.06 nearer keeps it", [0.31, 0.25], 0, 0],
    ["a held series with no reading gives way", [null, 0.4], 0, 1],
    ["nothing held takes the nearest", [0.3, 0.25], null, 1],
    ["a tie with nothing held goes to the earlier", [0.2, 0.2], null, 0],
    ["no reading anywhere picks none", [null, null], null, null],
  ] as const)("%s", (_, gaps, held, expected) => {
    expect(nearestHeld(gaps, held)).toBe(expected);
  });

  it("keeps a firmly held series however much nearer another is, while it has a reading", () => {
    expect(nearestHeld([0.5, 0.1], 0, true)).toBe(0);
    expect(nearestHeld([null, 0.1], 0, true)).toBe(1);
  });
});
