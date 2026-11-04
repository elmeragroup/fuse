/**
 * Every SVG mark the chart parts draw in the plot, by `data-slot`. The floor oracle,
 * chart-floor.browser.test.tsx, walks each one, keyed by this list's type, and a source contract
 * checks the list against the slots the chart source writes on SVG geometry, so a mark added later
 * without a walk fails one or the other.
 */
export const FLOOR_MARKS = [
  "chart-bar",
  "chart-bar-detail",
  "chart-bar-path",
  "chart-bar-emphasis",
  "chart-bar-missing",
  "chart-bar-active",
  "chart-grid-line",
  "chart-crosshair-mark",
  "chart-reference-rule",
  "chart-reference-band",
  "chart-active-value-rule",
  "chart-line",
  "chart-area",
  "chart-dot",
] as const;

/** One SVG mark slot of the plot. */
export type FloorMark = (typeof FLOOR_MARKS)[number];

/**
 * Every SVG mark ScatterChart's parts draw in the plot, by `data-slot`. The scatter floor oracle,
 * scatter-chart-floor.browser.test.tsx, walks each one, and a source contract checks the list
 * against the slots the scatter source writes on SVG geometry.
 */
export const SCATTER_FLOOR_MARKS = [
  "chart-points-path",
  "chart-line",
  "chart-grid-line",
  "chart-reference-rule",
  "chart-dot",
] as const;

/** One SVG mark slot of a scatter plot. */
export type ScatterFloorMark = (typeof SCATTER_FLOOR_MARKS)[number];
