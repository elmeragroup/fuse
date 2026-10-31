// Unit under test: the chart motion tokens. Oracle: .scratch/charts-v1/reviews/motion-decision.md
// rule 2, 480 ms on cubic-bezier(0, 0.7, 0.5, 1), and the catalogue's 16 ms entrance step. This is
// the tokens' one hand pin, and source-contracts.test.ts keeps chart.css equal to them.
import { describe, expect, it } from "vitest";

import { CHART_STAGGER_MS, CHART_UPDATE_EASE, CHART_UPDATE_MS } from "./motion";

describe("the motion tokens", () => {
  it("move a data update for 480 ms on the decided curve, and stagger the entrance by 16 ms", () => {
    expect(CHART_UPDATE_MS).toBe(480);
    expect(CHART_UPDATE_EASE).toBe("cubic-bezier(0, 0.7, 0.5, 1)");
    expect(CHART_STAGGER_MS).toBe(16);
  });
});
