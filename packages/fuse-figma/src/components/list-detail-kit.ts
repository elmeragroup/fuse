/**
 * List detail, as one component set on a page of its own: the detail pane of the docs default demo
 * in its split layout, `ListDetail.Detail`'s `<aside data-slot="list-detail-detail">`, 352px wide
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
 */
import type { InstanceManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";

/** The width of the docs default demo's `w-3xl` row, from which its `split="3xl"` root splits. */
export const LIST_DETAIL_HOST_WIDTH = 768;

/** The height of the docs default demo's `h-80` row, which the root and its pane stretch to. */
export const LIST_DETAIL_HOST_HEIGHT = 320;

/** The docs default demo's customers: each name and product. */
export const LIST_DETAIL_CUSTOMERS = [
  { name: "Henrik Aasen", product: "Spot price" },
  { name: "Ingrid Lund", product: "Fixed price, 12 months" },
  { name: "Siri Haugen", product: "Spot price with solar" },
] as const;

/** The pane's text while nothing is selected, the docs default demo's. */
export const LIST_DETAIL_EMPTY = "Select a customer.";

/** Whether the cell shows a selected customer. */
const selected = (cell: Cell): boolean => cell.content === "value";

/** Whether the cell shows the pane with nothing selected. */
const empty = (cell: Cell): boolean => !selected(cell);

/** A text the given property sets, in the cells `shownIn` names. */
function text(characters: string, textProperty: string, shownIn: (cell: Cell) => boolean): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn };
}

const [FIRST] = LIST_DETAIL_CUSTOMERS;

/** The selected customer's detail: the header row around the title, over the product. */
const ITEM: PartManifest = {
  key: "item",
  slot: undefined,
  place: "list-detail-detail/0",
  shownIn: selected,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: undefined,
      place: "list-detail-detail/0/0",
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
      ],
    },
    {
      key: "product",
      slot: undefined,
      place: "list-detail-detail/0/1",
      shownIn: selected,
      label: text(FIRST.product, "Product", selected),
      iconsFor: () => [],
    },
  ],
};

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
    ITEM,
  ],
  swapProperties: [],
};

/** Every cell of the root set shows the part. */
const always = (): boolean => true;

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
