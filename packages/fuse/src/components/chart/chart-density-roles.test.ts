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
  // The polar frame, its aspect-locked cell and the cell's server SVG, which SPEC's section 10
  // amendment adds: the frame lays out its parts as the cartesian frame does, and the cell and
  // its SVG are plot output at the polar size, which follows no density.
  "chart-polar-frame": "layout",
  "chart-polar-cell": "fixed",
  "chart-polar-plot": "fixed",
  // CONTRACT section 10's Pie, Labels, Track, Center and PieChart.Glow rows, and the leaving slice's
  // ghost, which SPEC's D5 adds: plot output and its 12 px text, which follow no density.
  "pie-chart-pie": "fixed",
  "pie-chart-sector": "fixed",
  "pie-chart-ghost": "fixed",
  "pie-chart-labels": "fixed",
  "pie-chart-label": "fixed",
  "pie-chart-leader": "fixed",
  "pie-chart-track": "fixed",
  "pie-chart-center": "fixed",
  "pie-chart-center-value": "fixed",
  "pie-chart-center-share": "fixed",
  "pie-chart-center-max": "fixed",
  "pie-chart-center-label": "fixed",
  "pie-chart-glow": "fixed",
  // CONTRACT section 10's RadialChart.Bar row.
  "radial-chart-bar": "fixed",
  "radial-chart-ring": "fixed",
  "chart-panel": "layout",
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
  "chart-crosshair-mark": "fixed",
  // Chart.SlotLabel, which the bklit polish run added after section 10: plot output in the axis's
  // fixed 12 px type, so it follows no density, as the ValueLabel pill does.
  "chart-slot-label": "fixed",
  "chart-reference-line": "fixed",
  "chart-reference-rule": "fixed",
  "chart-reference-area": "fixed",
  "chart-reference-band": "fixed",
  "chart-reference-label": "fixed",
  "chart-reference-text": "fixed",
  "chart-active-value": "fixed",
  "chart-active-value-line": "fixed",
  "chart-active-value-rule": "fixed",
  "chart-tooltip": "surface",
  "chart-tooltip-positioner": "fixed",
  // The tooltip's pointer bridge, which the tooltip glide run added after section 10: a hit area
  // with no type or padding of its own.
  "chart-tooltip-bridge": "fixed",
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
  "chart-bar-marks": "fixed",
  "chart-bar-detail": "fixed",
  "chart-bar-emphasis": "fixed",
  "chart-bar-group": "fixed",
  "chart-glow": "fixed",
  "chart-line-series": "fixed",
  "chart-line": "fixed",
  "chart-area-series": "fixed",
  "chart-area": "fixed",
  "chart-dots": "fixed",
  "chart-dot": "fixed",
  "chart-active-dot": "fixed",
  "chart-marker": "fixed",
  // ScatterChart's points layer, its path and its single option: plot output and a fixed 24 px
  // target, so none follows density, as the cartesian dots and option do.
  "chart-points": "fixed",
  "chart-points-path": "fixed",
  "chart-scatter-option": "fixed",
  "chart-reveal": "fixed",
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
  "sparkline-path": "fixed",
  "sparkline-dot": "fixed",
  "sparkline-reference": "fixed",
} as const;

describe("chart density roles", () => {
  it("declares every written chart slot with its section 10 role", () => {
    const declared = Object.fromEntries(
      Object.entries(PART_DENSITY).filter(([slot]) =>
        /^(sparkline|chart|pie-chart|radial-chart|radar-chart)(-|$)/u.test(slot)
      )
    );
    expect(declared).toEqual(CONTRACT_ROLES);
  });
});
