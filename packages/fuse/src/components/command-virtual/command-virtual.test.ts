import { describe, expect, it } from "vitest";

import { remToPx } from "../../theme/css-values";
import { DENSITY_METRICS } from "../../theme/tokens/density-metrics";
import { DENSE_ROW_METRICS } from "./row-metrics";

describe("DENSE_ROW_METRICS", () => {
  it("matches the dense row height and small surface gap of the density metric table", () => {
    expect(DENSE_ROW_METRICS).toEqual({
      row: remToPx(DENSITY_METRICS["row-h"].dense),
      pad: remToPx(DENSITY_METRICS["surface-gap-sm"].dense),
    });
  });
});
