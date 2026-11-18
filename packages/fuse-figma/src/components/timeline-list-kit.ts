/**
 * Timeline list, as one component set on a page of its own: the docs default demo's three events,
 * 1 cell.
 *
 * - The root is the `<ol data-slot="timeline-list">`. Its sample renders in a 512px host.
 * - Each event is an `<li data-slot="timeline-list-item">` around its dot, a `<span>` the item
 *   renders before its children, its title, a level 3 Heading, its time, a `<time>`, and its
 *   description, a `<div>`.
 * - Each text is the docs default demo's, and a TEXT property sets it, numbered by event: `Title 1`,
 *   `Time 1`, `Description 1` and so on.
 */
import type { LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import { always } from "./popup-facts";

/** The width the kit's previews and the compare host give the list. */
export const TIMELINE_LIST_PREVIEW_WIDTH = 512;

/** One event of the docs default demo. */
type TimelineEvent = {
  readonly title: string;
  readonly date: string;
  readonly time: string;
  readonly description: string;
};

/** The docs default demo's events, in order. */
export const TIMELINE_EVENTS: readonly TimelineEvent[] = [
  {
    title: "Order placed",
    date: "2026-03-03",
    time: "3 March 2026",
    description: "Confirmed at checkout for meter 735999123.",
  },
  {
    title: "Meter reading received",
    date: "2026-03-12",
    time: "12 March 2026",
    description: "Submitted by the customer in My pages.",
  },
  {
    title: "Invoice issued",
    date: "2026-04-01",
    time: "1 April 2026",
    description: "NOK 2 310,00 ready for payment.",
  },
];

/** A text the given property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/** A part by its `data-slot` that holds its own text. */
function textPart(key: string, slot: string, characters: string, textProperty: string): PartManifest {
  return { key, slot, shownIn: always, label: text(characters, textProperty), iconsFor: () => [] };
}

/** An event's item, around its dot, title, time and description. */
function item(event: TimelineEvent, index: number): PartManifest {
  const number = String(index + 1);
  return {
    key: `item-${number}`,
    slot: "timeline-list-item",
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
    parts: [
      { key: "dot", slot: "timeline-list-dot", shownIn: always, label: undefined, iconsFor: () => [] },
      textPart("title", "timeline-list-title", event.title, `Title ${number}`),
      textPart("time", "timeline-list-time", event.time, `Time ${number}`),
      textPart("description", "timeline-list-description", event.description, `Description ${number}`),
    ],
  };
}

/** The list's manifest, which the capture-backed build reads with `captures/timeline-list.json`. */
export const TIMELINE_LIST_MANIFEST: SetManifest = {
  key: "timeline-list",
  name: "Timeline list",
  api: {
    page: "timeline-list",
    parts: [
      "TimelineList.Root",
      "TimelineList.Item",
      "TimelineList.Title",
      "TimelineList.Time",
      "TimelineList.Description",
    ],
  },
  slot: "timeline-list",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  previewWidth: TIMELINE_LIST_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: TIMELINE_EVENTS.map(item),
  swapProperties: [],
};
