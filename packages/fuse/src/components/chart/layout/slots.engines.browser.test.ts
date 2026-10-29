// Unit under test: the time axis's slot lists in each engine's own zone data. Oracle: the zoneinfo
// slot lists of format/fixtures/slots.json, through the same judges the Node test runs.
import { describe, expect, it } from "vitest";

import { slotJudgements } from "./fixtures/slot-judges";

describe("time-axis slots in this engine", () => {
  it("lists every zoneinfo day, month and year", () => {
    const mismatches = slotJudgements()
      .filter((judgement) => JSON.stringify(judgement.actual) !== JSON.stringify(judgement.expected))
      .map((judgement) => judgement.name);
    expect(mismatches).toEqual([]);
  });
});
