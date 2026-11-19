/**
 * Description list's responsive layout, on a page of its own: an Item, and a list of Item instances
 * under its heading. CSS lines the Items' cells up in the list's shared columns, which each Item draws
 * as a row that splits its width alike, as `subgrid-row.ts` says, so a designer adds or removes rows
 * as instances. The inline layout, and the stacked one below `sm`, are not drawn.
 */
import type { InstanceManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import { BOOLEAN_VALUES } from "./axis-vocabulary";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The width the samples' host gives the list, the docs default demo's `max-w-xl`. */
export const DESCRIPTION_LIST_PREVIEW_WIDTH = 576;

/** The heading's text, the docs default demo's. */
export const DESCRIPTION_LIST_HEADING = "Customer";

/** Each Item's term and details, the docs default demo's. */
export const DESCRIPTION_LIST_ROWS = [
  ["Name", "Kari Nordmann"],
  ["Customer number", "10492831"],
  ["Meter point", "707057500012345678"],
  ["Address", "Storgata 1, 3611 Kongsberg"],
  ["Grid company", "Skagerak Nett"],
] as const;

/** A text the given property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/** A cell of the Item, the term or the details, holding the first Item's text. */
function cellPart(key: "term" | "details", characters: string, textProperty: string): PartManifest {
  return {
    key,
    slot: `description-list-${key}`,
    shownIn: always,
    label: text(characters, textProperty),
    iconsFor: () => [],
  };
}

const [FIRST_TERM, FIRST_DETAILS] = DESCRIPTION_LIST_ROWS[0];

/**
 * The Item's manifest: the docs default demo's first Item, first in its list or after another Item,
 * in a list that draws dividers or not.
 */
export const DESCRIPTION_LIST_ITEM_MANIFEST: SetManifest = {
  key: "description-list-item",
  name: "Description list item",
  api: { page: "description-list", parts: ["DescriptionList.Item", "DescriptionList.Content"] },
  slot: "description-list-item",
  axes: [
    { name: "position", values: ["first", "later"] },
    { name: "dividers", values: BOOLEAN_VALUES },
  ],
  columnAxis: "dividers",
  previewWidth: DESCRIPTION_LIST_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [cellPart("term", FIRST_TERM, "Term"), cellPart("details", FIRST_DETAILS, "Details")],
  swapProperties: [],
};

/** The list's Item instance at the given place, with its term and details. */
function itemInstance(index: number): InstanceManifest {
  const [term, details] = DESCRIPTION_LIST_ROWS[index] ?? ["", ""];
  return {
    kind: "instance",
    key: `item-${String(index + 1)}`,
    of: DESCRIPTION_LIST_ITEM_MANIFEST,
    cell: (outer: Cell) => ({
      position: index === 0 ? "first" : "later",
      dividers: outer.dividers ?? "true",
    }),
    properties: () => ({ text: { Term: term, Details: details } }),
    shownIn: always,
  };
}

/**
 * The list's manifest: the docs default demo, its heading over its five Items, with dividers or
 * without.
 */
export const DESCRIPTION_LIST_MANIFEST: SetManifest = {
  key: "description-list",
  name: "Description list",
  api: { page: "description-list", parts: ["DescriptionList.Root", "DescriptionList.Content"] },
  slot: "description-list",
  axes: [{ name: "dividers", values: BOOLEAN_VALUES }],
  columnAxis: "dividers",
  previewWidth: DESCRIPTION_LIST_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "heading",
      slot: "description-list-heading",
      shownIn: always,
      label: text(DESCRIPTION_LIST_HEADING, "Heading"),
      iconsFor: () => [],
    },
    {
      key: "content",
      slot: "description-list-content",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: DESCRIPTION_LIST_ROWS.map((_, index) => itemInstance(index)),
    },
  ],
  swapProperties: [],
};
