/**
 * Selection item, as one component set on a page of its own: the docs default demo's row, a
 * Checkbox beside its title and description, 1 cell.
 */
import type { InstanceManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import { CHECKBOX_MANIFEST } from "./checkbox-kit";
import { always } from "./popup-facts";

/** The width the kit's previews and the compare host give the row. */
export const SELECTION_ITEM_PREVIEW_WIDTH = 384;

/** The title's text, the docs default demo's. */
export const SELECTION_ITEM_TITLE = "Price alert";

/** The description's text, the docs default demo's. */
export const SELECTION_ITEM_DESCRIPTION = "A text message when the spot price peaks.";

/** A text the given property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/** A part by its `data-slot` that holds its own text. */
function textPart(key: string, slot: string, characters: string, textProperty: string): PartManifest {
  return { key, slot, shownIn: always, label: text(characters, textProperty), iconsFor: () => [] };
}

/** The row's Checkbox, unchecked at rest, an instance of the Checkbox set. */
const CHECKBOX: InstanceManifest = {
  kind: "instance",
  key: "checkbox",
  of: CHECKBOX_MANIFEST,
  slot: "checkbox",
  cell: () => ({ checked: "false", indeterminate: "false", state: "rest" }),
  shownIn: always,
};

/** The row's manifest, which the capture-backed build reads with `captures/selection-item.json`. */
export const SELECTION_ITEM_MANIFEST: SetManifest = {
  key: "selection-item",
  name: "Selection item",
  api: { page: "selection-item", parts: ["SelectionItem.Shell"] },
  slot: "checkbox-item",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  previewWidth: SELECTION_ITEM_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  // The `<label>` generates no box, so the row lays its control and its text out as its grid's items.
  parts: [
    {
      key: "label",
      slot: undefined,
      place: "checkbox-item/0",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "control",
          slot: "selection-item-control",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [CHECKBOX],
        },
        {
          key: "cluster",
          slot: undefined,
          place: "checkbox-item/0/1",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              key: "content",
              slot: "item-content",
              shownIn: always,
              label: undefined,
              iconsFor: () => [],
              parts: [
                textPart("title", "selection-item-title", SELECTION_ITEM_TITLE, "Title"),
                textPart(
                  "description",
                  "selection-item-description",
                  SELECTION_ITEM_DESCRIPTION,
                  "Description"
                ),
              ],
            },
          ],
        },
      ],
    },
  ],
  swapProperties: [],
};
