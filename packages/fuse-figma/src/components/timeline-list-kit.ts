/**
 * Timeline list, as two component sets on a page of their own: the docs default demo's three events,
 * and the links demo's two events, each description ending in a link. 1 cell each.
 *
 * - The root is the `<ol data-slot="timeline-list">`. Its sample renders in a 512px host.
 * - Each event is an `<li data-slot="timeline-list-item">`, a flex row of its rail and its content. The
 *   rail holds the incoming connector, the indicator around the default mark and the outgoing
 *   connector. The two connectors share the `timeline-list-connector` slot, so they take two part
 *   keys, `incoming` and `outgoing`, which claim the slot's elements in DOM order. The content holds
 *   the title, a level 3 Heading, the time, a `<time>`, and the description, a `<div>`.
 * - Each text is the docs default demo's, and a TEXT property sets it, numbered by event: `Title 1`,
 *   `Time 1`, `Description 1` and so on.
 * - A links description holds its sentence, a space and an `<a>`, which the text draws as an
 *   underlined range. It has no TEXT property, since a TEXT write gives every character the first
 *   one's style, so Code's text has none either.
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

/** An event of the docs links demo, whose description ends in a link. */
type TimelineLinkEvent = TimelineEvent & {
  /** The link after the description's sentence and a space. */
  readonly link: { readonly text: string; readonly href: string };
};

/** The docs links demo's events, in order. */
export const TIMELINE_LINK_EVENTS: readonly TimelineLinkEvent[] = [
  {
    title: "Invoice issued",
    date: "2026-04-01",
    time: "1 April 2026",
    description: "NOK 2 310,00 ready for payment.",
    link: { text: "View invoice 4821", href: "#invoice-4821" },
  },
  {
    title: "Reminder sent",
    date: "2026-04-15",
    time: "15 April 2026",
    description: "Payment still open.",
    link: { text: "Pay now", href: "#pay-4821" },
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

/** A part by its `data-slot` that holds no text and no parts. */
function leaf(key: string, slot: string): PartManifest {
  return { key, slot, shownIn: always, label: undefined, iconsFor: () => [] };
}

/** A part by its `data-slot` around the given parts, with no text of its own. */
function group(key: string, slot: string, parts: readonly PartManifest[]): PartManifest {
  return { ...leaf(key, slot), parts };
}

/**
 * An event's item: its rail, with the connectors around the indicator and its mark, and its content,
 * with the title, time and description.
 *
 * @param description - The description part for the event's number.
 */
function item(
  event: TimelineEvent,
  index: number,
  description: (number: string) => PartManifest
): PartManifest {
  const number = String(index + 1);
  return {
    key: `item-${number}`,
    slot: "timeline-list-item",
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
    parts: [
      group("rail", "timeline-list-rail", [
        leaf("incoming", "timeline-list-connector"),
        group("indicator", "timeline-list-indicator", [leaf("mark", "timeline-list-mark")]),
        leaf("outgoing", "timeline-list-connector"),
      ]),
      group("content", "timeline-list-content", [
        textPart("title", "timeline-list-title", event.title, `Title ${number}`),
        textPart("time", "timeline-list-time", event.time, `Time ${number}`),
        description(number),
      ]),
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
  parts: TIMELINE_EVENTS.map((event, index) =>
    item(event, index, (number) =>
      textPart("description", "timeline-list-description", event.description, `Description ${number}`)
    )
  ),
  swapProperties: [],
};

/** A links demo description's characters: its sentence, a space and its link's text. */
export function linkDescription(event: TimelineLinkEvent): string {
  return `${event.description} ${event.link.text}`;
}

/**
 * The links demo's list, which the capture-backed build reads with
 * `captures/timeline-list-links.json`. Its descriptions hold no TEXT property.
 */
export const TIMELINE_LIST_LINKS_MANIFEST: SetManifest = {
  ...TIMELINE_LIST_MANIFEST,
  key: "timeline-list-links",
  name: "Timeline list links",
  parts: TIMELINE_LINK_EVENTS.map((event, index) =>
    item(event, index, () => ({
      key: "description",
      slot: "timeline-list-description",
      shownIn: always,
      label: {
        key: "text",
        name: "text",
        characters: linkDescription(event),
        textProperty: undefined,
        shownIn: always,
      },
      iconsFor: () => [],
    }))
  ),
};
