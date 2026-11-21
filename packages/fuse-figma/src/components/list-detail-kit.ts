/**
 * List detail, as four component sets on a page of their own. `List detail pane` is the detail pane
 * of the docs default demo in its split layout, `ListDetail.Detail`'s `<aside data-slot="list-detail-detail">`, 352px wide
 * beside the list. 2 variants by `content`:
 *
 * - `empty`: nothing selected, the demo's muted `Select a customer.` in a padded `<p>` that its
 *   `m-auto` centres in the pane, behind the `Empty` property.
 * - `value`: the first customer selected, `ListDetail.Title` in its header row over the customer's
 *   product, behind the `Title` and `Product` properties. The header holds no close in this layout,
 *   since `ListDetail.Close` renders only in the Sheet.
 *
 * The pane is as tall as the demo's `h-80` row, 320px, which the root and the pane stretch to, and
 * the set names that height as its preview height.
 *
 * The `List detail` set draws the whole demo: the root, its list of ghost Button rows, and the pane
 * as an instance of `List detail pane`, so a designer switches the pane's content from the root and
 * can place the pane alone where a layout holds it.
 *
 * Below the root's `split` width the detail shows in a Sheet over the list. `List detail sheet` is
 * that Sheet's panel, `Sheet.Content`'s popup with the pane's `list-detail-detail` slot, fixed on the
 * right in Sheet's 640×448 viewport around the same `value` detail, whose header row holds
 * `ListDetail.Close` after the title, the ghost `icon-sm` Icon button that its `ml-auto` ends the
 * row with. The demo passes `showCloseButton={false}`, so the panel holds no corner close: 1 cell.
 * `List detail (open)` is that panel over the scrim, which `fixed-placement.ts` places against the
 * scrim's right edge, as `Sheet (open)` places Sheet's panel: 1 cell.
 */
import type { InstanceManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";
import {
  LIST_DETAIL_CUSTOMERS,
  LIST_DETAIL_EMPTY,
  LIST_DETAIL_HOST_HEIGHT,
  LIST_DETAIL_HOST_WIDTH,
} from "./list-detail-text";
import { SHEET_VIEWPORT } from "./sheet-text";

/** Whether the cell shows a selected customer. */
const selected = (cell: Cell): boolean => cell.content === "value";

/** Whether the cell shows the pane with nothing selected. */
const empty = (cell: Cell): boolean => !selected(cell);

/** A text the given property sets, in the cells `shownIn` names. */
function text(characters: string, textProperty: string, shownIn: (cell: Cell) => boolean): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn };
}

const [FIRST] = LIST_DETAIL_CUSTOMERS;

/**
 * `ListDetail.Close` in the Sheet: `Sheet.Close` rendering the demo's ghost `icon-sm` Button with X,
 * which its `ml-auto` puts at the end of the header row.
 */
const CLOSE: InstanceManifest = {
  kind: "instance",
  key: "close",
  of: ICON_BUTTON_MANIFEST,
  slot: "sheet-close",
  cell: () => ({ variant: "ghost", size: "icon-sm", state: "rest" }),
  properties: () => ({ swap: { Icon: "X" } }),
  shownIn: selected,
  exposed: true,
};

/**
 * The selected customer's detail: the header row around the title, and the close where the layout
 * renders one, over the product. `base` is the nearest element with a `data-slot` above it, from
 * which its places count: the pane, or the Sheet's inner column.
 */
function itemManifest(base: string, close: readonly InstanceManifest[]): PartManifest {
  return {
    key: "item",
    slot: undefined,
    place: `${base}/0`,
    shownIn: selected,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        key: "header",
        slot: undefined,
        place: `${base}/0/0`,
        shownIn: selected,
        label: undefined,
        iconsFor: () => [],
        parts: [
          {
            key: "title",
            slot: "list-detail-title",
            shownIn: selected,
            label: text(FIRST.name, "Title", selected),
            iconsFor: () => [],
          },
          ...close,
        ],
      },
      {
        key: "product",
        slot: undefined,
        place: `${base}/0/1`,
        shownIn: selected,
        label: text(FIRST.product, "Product", selected),
        iconsFor: () => [],
      },
    ],
  };
}

/** The pane's manifest, which the capture-backed build reads with `captures/list-detail-pane.json`. */
export const LIST_DETAIL_PANE_MANIFEST: SetManifest = {
  key: "list-detail-pane",
  name: "List detail pane",
  api: { page: "list-detail", parts: ["ListDetail.Detail", "ListDetail.Title"] },
  slot: "list-detail-detail",
  axes: [{ name: "content", values: ["empty", "value"] }],
  columnAxis: "content",
  previewHeight: { pixels: LIST_DETAIL_HOST_HEIGHT },
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "empty",
      slot: undefined,
      place: "list-detail-detail/0",
      shownIn: empty,
      label: text(LIST_DETAIL_EMPTY, "Empty", empty),
      iconsFor: () => [],
    },
    itemManifest("list-detail-detail", []),
  ],
  swapProperties: [],
};

/** Every cell of the root set shows the part. */
const always = (): boolean => true;

/**
 * The Sheet's manifest, which the capture-backed build reads with `captures/list-detail-sheet.json`:
 * `ListDetail.Detail` in the overlay layout, `Sheet.Content`'s popup with the pane's
 * `list-detail-detail` slot, fixed on the right in the viewport Sheet's sets declare, around the
 * first customer's detail with `ListDetail.Close` in its header.
 */
export const LIST_DETAIL_SHEET_MANIFEST: SetManifest = {
  key: "list-detail-sheet",
  name: "List detail sheet",
  api: { page: "list-detail", parts: ["ListDetail.Detail", "ListDetail.Title", "ListDetail.Close"] },
  slot: "list-detail-detail",
  axes: [{ name: "content", values: ["value"] }],
  columnAxis: "content",
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
      parts: [itemManifest("sheet-content-inner", [CLOSE])],
    },
  ],
  swapProperties: [],
};

/**
 * The overlay layout's manifest, which the capture-backed build reads with
 * `captures/list-detail-open.json`: the Sheet's scrim and the panel over it, against the right edge
 * of the viewport.
 */
export const LIST_DETAIL_OPEN_MANIFEST: SetManifest = {
  key: "list-detail-open",
  name: "List detail (open)",
  api: { page: "list-detail", parts: ["ListDetail.Root", "ListDetail.Detail"] },
  slot: "list-detail-open",
  axes: [{ name: "content", values: ["value"] }],
  columnAxis: "content",
  viewport: SHEET_VIEWPORT,
  union: ["sheet-overlay", "list-detail-detail"],
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "detail",
      of: LIST_DETAIL_SHEET_MANIFEST,
      cell: () => ({ content: "value" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};

/**
 * One row of the list: the demo's `<li>` around a ghost Button at the default size, at rest and with
 * no icon, labeled with the customer's name. Button styles no `aria-current`, so the selected row
 * draws as the others do.
 */
function rowManifest(index: number, name: string): PartManifest {
  const button: InstanceManifest = {
    kind: "instance",
    key: "button",
    of: BUTTON_MANIFEST,
    cell: () => ({ variant: "ghost", size: "default", state: "rest", icon: "none" }),
    properties: () => ({ text: { Label: name } }),
    shownIn: always,
    exposed: true,
  };
  return {
    key: `row-${String(index + 1)}`,
    slot: undefined,
    place: `list-detail-list/${String(index)}`,
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
    parts: [button],
  };
}

/** The pane, an instance of `List detail pane` at the root's `content`. */
const PANE: InstanceManifest = {
  kind: "instance",
  key: "detail",
  of: LIST_DETAIL_PANE_MANIFEST,
  cell: (outer) => ({ content: selected(outer) ? "value" : "empty" }),
  shownIn: always,
  exposed: true,
};

/**
 * The root's manifest, which the capture-backed build reads with `captures/list-detail.json`: the
 * docs default demo's `ListDetail.Root` in its split layout, the list beside the pane.
 */
export const LIST_DETAIL_MANIFEST: SetManifest = {
  key: "list-detail",
  name: "List detail",
  api: { page: "list-detail", parts: ["ListDetail.Root", "ListDetail.List", "ListDetail.Detail"] },
  slot: "list-detail",
  axes: [{ name: "content", values: ["empty", "value"] }],
  columnAxis: "content",
  previewWidth: LIST_DETAIL_HOST_WIDTH,
  previewHeight: { pixels: LIST_DETAIL_HOST_HEIGHT },
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "list",
      slot: "list-detail-list",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: LIST_DETAIL_CUSTOMERS.map((customer, index) => rowManifest(index, customer.name)),
    },
    PANE,
  ],
  swapProperties: [],
};
