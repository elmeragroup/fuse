/**
 * Sheet, as one component set on a page of its own: the panel the docs "No close button" demo opens.
 *
 * `Sheet content` is `Sheet.Content`'s popup, `<div data-slot="sheet-content">`, with
 * `showCloseButton={false}`, on the right side at the md size: 1 cell. It is fixed in a 640×448
 * viewport (`SHEET_VIEWPORT`). It holds the `sheet-content-inner` column, and in it the header, the
 * title over the muted description, and the footer, the outline Button `Sheet.Close` renders, which
 * the footer's `mt-auto` holds at the panel's bottom. Each text is the demo's, behind a TEXT property.
 * The corner close `showCloseButton` appends to the column sits behind the `Close button` BOOLEAN,
 * false by default. Its containing block is the popup, which the column spans, so it draws in the
 * column's frame, as `absolute-placement.ts` says.
 *
 * The set draws no body, and no panel open over the scrim, whose Backdrop the kit places only around
 * a centred or top popup.
 */
import type { InstanceManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";
import {
  SHEET_CLOSE_LABEL,
  SHEET_CORNER_CLOSE_PROPERTY,
  SHEET_DESCRIPTION,
  SHEET_TITLE,
  SHEET_VIEWPORT,
} from "./sheet-text";

/** A text the given property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/** A part by its `data-slot` that holds its own text. */
function textPart(key: string, slot: string, characters: string, textProperty: string): PartManifest {
  return { key, slot, shownIn: always, label: text(characters, textProperty), iconsFor: () => [] };
}

/** The footer's Close, `Sheet.Close` rendering an outline Button, which carries the `sheet-close` slot. */
const FOOTER_CLOSE: InstanceManifest = {
  kind: "instance",
  key: "close",
  of: BUTTON_MANIFEST,
  slot: "sheet-close",
  cell: () => ({ variant: "outline", size: "default", state: "rest", icon: "none" }),
  properties: () => ({ text: { Label: SHEET_CLOSE_LABEL } }),
  shownIn: always,
  exposed: true,
};

/**
 * The corner close, `Sheet.Close` rendering the ghost `icon-sm` Icon button with X, which
 * `showCloseButton` appends to the inner column, behind the `Close button` property.
 */
const CORNER_CLOSE: InstanceManifest = {
  kind: "instance",
  key: "corner-close",
  of: ICON_BUTTON_MANIFEST,
  slot: "sheet-close",
  cell: () => ({ variant: "ghost", size: "icon-sm", state: "rest" }),
  properties: () => ({ swap: { Icon: "X" } }),
  shownIn: always,
  optional: { name: SHEET_CORNER_CLOSE_PROPERTY, defaultValue: false },
  exposed: true,
};

/** The panel's manifest, which the capture-backed build reads with `captures/sheet-content.json`. */
export const SHEET_CONTENT_MANIFEST: SetManifest = {
  key: "sheet-content",
  name: "Sheet content",
  api: { page: "sheet", parts: ["Sheet.Content", "Sheet.Root"] },
  slot: "sheet-content",
  axes: [{ name: "side", values: ["right"] }],
  columnAxis: "side",
  viewport: SHEET_VIEWPORT,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "inner",
      slot: "sheet-content-inner",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "header",
          slot: "sheet-header",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            textPart("title", "sheet-title", SHEET_TITLE, "Title"),
            textPart("description", "sheet-description", SHEET_DESCRIPTION, "Description"),
          ],
        },
        {
          key: "footer",
          slot: "sheet-footer",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [FOOTER_CLOSE],
        },
        CORNER_CLOSE,
      ],
    },
  ],
  swapProperties: [],
};
