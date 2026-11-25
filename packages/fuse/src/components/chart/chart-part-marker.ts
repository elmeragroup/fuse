// The chart's own code finds some of its rendered elements again in the DOM: a mark's paths to
// draw into, a Root's server-rendered Panels, a popup a pointer leaves into. Those lookups key on
// `data-chart-part`, an attribute only Fuse writes, rather than on `data-slot`, because issue #1021
// keeps behavior off the styling slot. Each part has one entry in `PART_SLOTS`. Its writer spreads
// `chartPart(name)`, which writes the entry's `data-slot` and a marker named after the entry's key,
// and each lookup builds its selector from the same key. A writer therefore cannot pair one part's
// slot with another part's marker, and a lookup cannot name a part that has no entry.

/** The attribute every chart part marker sets. */
const PART_ATTRIBUTE = "data-chart-part";

/**
 * The `data-slot` of each chart part a lookup finds, keyed by the marker the part writes. Each slot
 * stays a literal `data-slot` property, which the density lint rule and the studio's slot index
 * read.
 */
const PART_SLOTS = {
  "active-value-rule": { "data-slot": "chart-active-value-rule" },
  bar: { "data-slot": "chart-bar" },
  "bar-detail": { "data-slot": "chart-bar-detail" },
  "bar-emphasis": { "data-slot": "chart-bar-emphasis" },
  "bar-path": { "data-slot": "chart-bar-path" },
  dot: { "data-slot": "chart-dot" },
  frame: { "data-slot": "chart-frame" },
  panel: { "data-slot": "chart-panel" },
  "reference-band": { "data-slot": "chart-reference-band" },
  "reference-rule": { "data-slot": "chart-reference-rule" },
  tooltip: { "data-slot": "chart-tooltip" },
  "value-label": { "data-slot": "chart-value-label" },
  "x-tick": { "data-slot": "chart-x-tick" },
} as const;

/** The chart parts a lookup finds by marker. */
export type ChartPartName = keyof typeof PART_SLOTS;

/** The props a chart part spreads: its `data-slot` and its marker. */
export type ChartPartProps<Name extends ChartPartName> = (typeof PART_SLOTS)[Name] & {
  readonly [PART_ATTRIBUTE]: Name;
};

/**
 * The props of one chart part, its `data-slot` and its marker. Spread them in place of the part's
 * `data-slot` attribute.
 *
 * @param name - The part.
 * @returns The part's props.
 */
export function chartPart<Name extends ChartPartName>(name: Name): ChartPartProps<Name> {
  return { ...PART_SLOTS[name], [PART_ATTRIBUTE]: name };
}

/**
 * The attribute selector that finds a chart part by its marker.
 *
 * @param name - The part.
 * @returns The selector, such as `[data-chart-part="dot"]`.
 */
export function partSelector(name: ChartPartName): string {
  return `[${PART_ATTRIBUTE}="${name}"]`;
}
