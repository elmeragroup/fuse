// Unit under test: PART_DENSITY's chart entries. Oracle: the slot-to-role rows of CONTRACT
// section 10 (.scratch/charts-v1/contract/CONTRACT.md), copied here as literals for every slot
// this layer writes. A slot declared with the wrong role fails here even when it behaves as
// declared, which the docs density coverage test cannot see.
import { describe, expect, it } from "vitest";

import { PART_DENSITY } from "../../theme/tokens/density-roles";

const CONTRACT_ROLES = {
  chart: "layout",
  "pie-chart": "layout",
  "radial-chart": "layout",
  "radar-chart": "layout",
  "chart-frame": "layout",
  "chart-plot": "fixed",
  "chart-surface": "fixed",
  "chart-point": "fixed",
  "chart-description": "fixed",
  "chart-instructions": "fixed",
  "chart-status": "fixed",
  "chart-bar-series": "fixed",
  "chart-bar": "fixed",
  "chart-bar-active": "fixed",
  "chart-headline": "fixed",
  "chart-takeaway": "fixed",
  "chart-grid": "fixed",
  "chart-grid-line": "fixed",
  "chart-x-axis": "fixed",
  "chart-y-axis": "fixed",
  "chart-x-tick": "fixed",
  "chart-y-tick": "fixed",
  "chart-axis-sizer": "fixed",
  "chart-axis-label": "fixed",
  "chart-value-label": "fixed",
  "chart-crosshair": "fixed",
  "chart-reference-line": "fixed",
  "chart-reference-area": "fixed",
  "chart-reference-label": "fixed",
  "chart-reference-text": "fixed",
  "chart-active-value": "fixed",
  "chart-active-value-line": "fixed",
  "chart-tooltip": "surface",
  "chart-tooltip-positioner": "fixed",
  "chart-tooltip-label": "fixed",
  "chart-tooltip-items": "fixed",
  "chart-tooltip-item": "fixed",
  "chart-tooltip-value": "fixed",
  "chart-tooltip-share": "fixed",
  "chart-tooltip-total": "fixed",
  "chart-swatch": "fixed",
  "chart-series-label": "fixed",
  "chart-series-icon": "fixed",
  "chart-legend": "layout",
  "chart-legend-item": "fixed",
  "chart-legend-value": "fixed",
  "chart-legend-share": "fixed",
  "chart-legend-toggle-group": "layout",
  "chart-legend-toggle": "control",
  "chart-bar-path": "fixed",
  "chart-bar-missing": "fixed",
  "chart-bar-emphasis": "fixed",
  "chart-bar-group": "fixed",
  "chart-glow": "fixed",
  "chart-background": "fixed",
  "chart-skeleton": "fixed",
  "chart-skeleton-mark": "fixed",
  "chart-table": "layout",
  "chart-table-content": "layout",
  "chart-table-pagination": "layout",
  "chart-table-column": "fixed",
  "chart-table-toggle": "control",
  "chart-empty": "layout",
  sparkline: "fixed",
} as const;

describe("chart density roles", () => {
  it("declares every written chart slot with its section 10 role", () => {
    const declared = Object.fromEntries(
      Object.entries(PART_DENSITY).filter(
        ([slot]) => slot === "sparkline" || /^(chart|pie-chart|radial-chart|radar-chart)(-|$)/u.test(slot)
      )
    );
    expect(declared).toEqual(CONTRACT_ROLES);
  });
});
