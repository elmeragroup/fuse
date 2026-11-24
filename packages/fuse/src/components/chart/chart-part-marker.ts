// The chart's own code finds some of its rendered elements again in the DOM: a mark's paths to
// draw into, a Root's server-rendered Panels, a popup a pointer leaves into. Those lookups key on
// `data-chart-part`, an attribute only Fuse writes, rather than on `data-slot`, because issue #1021
// keeps behavior off the styling slot. Each part has one entry in `PART_SLOTS`. Its writer spreads
// `chartPart(name)`, which writes the entry's `data-slot` and a marker named after the entry's key,
// and each lookup builds its selector from the same key. A writer therefore cannot pair one part's
// slot with another part's marker, and a lookup cannot name a part that has no entry. A part that
// takes a consumer's props or `render` element, such as Legend, passes those props to
// `chartPart(name, props)`, so a consumer's `data-slot` replaces the slot and the marker stays.

/** The attribute every chart part marker sets. */
const PART_ATTRIBUTE = "data-chart-part";

/**
 * The `data-slot` of each chart part a lookup finds, keyed by the marker the part writes. Each slot
 * stays a literal `data-slot` property, which the density lint rule and the studio's slot index
 * read.
 */
const PART_SLOTS = {
  "active-dot": { "data-slot": "chart-active-dot" },
  "active-value-rule": { "data-slot": "chart-active-value-rule" },
  "area-series": { "data-slot": "chart-area-series" },
  bar: { "data-slot": "chart-bar" },
  "bar-active": { "data-slot": "chart-bar-active" },
  "bar-detail": { "data-slot": "chart-bar-detail" },
  "bar-emphasis": { "data-slot": "chart-bar-emphasis" },
  "bar-path": { "data-slot": "chart-bar-path" },
  "bar-series": { "data-slot": "chart-bar-series" },
  "clock-angle-label": { "data-slot": "clock-chart-angle-label" },
  "clock-now": { "data-slot": "clock-chart-now" },
  "clock-radius-label": { "data-slot": "clock-chart-radius-label" },
  "clock-reference-area": { "data-slot": "clock-chart-reference-area" },
  "clock-reference-line": { "data-slot": "clock-chart-reference-line" },
  "clock-value-label": { "data-slot": "clock-chart-value-label" },
  dot: { "data-slot": "chart-dot" },
  dots: { "data-slot": "chart-dots" },
  frame: { "data-slot": "chart-frame" },
  headline: { "data-slot": "chart-headline" },
  legend: { "data-slot": "chart-legend" },
  "legend-toggle-group": { "data-slot": "chart-legend-toggle-group" },
  "line-series": { "data-slot": "chart-line-series" },
  marker: { "data-slot": "chart-marker" },
  panel: { "data-slot": "chart-panel" },
  "pie-label": { "data-slot": "pie-chart-label" },
  "pie-leader": { "data-slot": "pie-chart-leader" },
  "radar-angle-label": { "data-slot": "radar-chart-angle-label" },
  "radar-radius-label": { "data-slot": "radar-chart-radius-label" },
  "reference-band": { "data-slot": "chart-reference-band" },
  "reference-label": { "data-slot": "chart-reference-label" },
  "reference-rule": { "data-slot": "chart-reference-rule" },
  "table-toggle": { "data-slot": "chart-table-toggle" },
  tooltip: { "data-slot": "chart-tooltip" },
  "tooltip-label": { "data-slot": "chart-tooltip-label" },
  "value-label": { "data-slot": "chart-value-label" },
  "x-tick": { "data-slot": "chart-x-tick" },
} as const;

/** The chart parts a lookup finds by marker. */
export type ChartPartName = keyof typeof PART_SLOTS;

/** The marker a chart part writes, without its `data-slot`. */
type ChartPartMarker<Name extends ChartPartName> = { readonly [PART_ATTRIBUTE]: Name };

/** The props a chart part spreads without given props: its `data-slot` and its marker. */
export type ChartPartProps<Name extends ChartPartName> = (typeof PART_SLOTS)[Name] & ChartPartMarker<Name>;

/**
 * The props of one chart part: its `data-slot`, then `props`, then its marker. Spread them in place
 * of the part's `data-slot` attribute. A part that takes a consumer's props passes them as `props`,
 * so a consumer's `data-slot` replaces the part's slot and cannot erase the marker. Base UI's
 * `useRender` merges a `render` element's own props after these, so that element's `data-slot`
 * replaces the slot too. With `props`, the type promises only the marker: a `data-slot` key in
 * `props` that holds `undefined` erases the part's slot, and an absent one keeps it.
 *
 * @param name - The part.
 * @param props - The props between the slot and the marker, such as the consumer's.
 * @returns The part's props.
 */
export function chartPart<Name extends ChartPartName>(name: Name): ChartPartProps<Name>;
export function chartPart<Name extends ChartPartName, Props extends object>(
  name: Name,
  props: Props
): ChartPartMarker<Name>;
export function chartPart<Name extends ChartPartName, Props extends object>(
  name: Name,
  props?: Props
): ChartPartProps<Name> | ChartPartMarker<Name> {
  return { ...PART_SLOTS[name], ...props, [PART_ATTRIBUTE]: name };
}

/**
 * The selector list that finds each of the named chart parts by its marker.
 *
 * @param names - The parts.
 * @returns The selector list, such as `[data-chart-part="dot"]` for the dot alone.
 */
export function partSelector(...names: readonly [ChartPartName, ...ChartPartName[]]): string {
  return names.map((name) => `[${PART_ATTRIBUTE}="${name}"]`).join(", ");
}

/** The attribute a TooltipLabel's element carries while it prints its item's label in Root's format. */
const DEFAULT_LABEL_ATTRIBUTE = "data-chart-default-label";

/**
 * The marker a TooltipLabel writes on its element while its generated text is the active item's
 * label in Root's format. It holds that label, so a polar popup sizes its lane for the widest label
 * any item prints only while the element still reads as the label.
 *
 * @param label - The active item's label in Root's format.
 * @returns The marker's props.
 */
export function defaultLabelMarker(label: string) {
  return { [DEFAULT_LABEL_ATTRIBUTE]: label };
}

/**
 * The active item's label in Root's format, as a TooltipLabel's element marks it.
 *
 * @param label - The TooltipLabel's element.
 * @returns The marked label, or null when the element carries no marker.
 */
export function defaultLabelText(label: Element): string | null {
  return label.getAttribute(DEFAULT_LABEL_ATTRIBUTE);
}
