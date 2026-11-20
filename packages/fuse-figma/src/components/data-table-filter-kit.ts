/**
 * Data table filter's bar, as one component set on a page of its own: the docs default demo's
 * `DataTableFilter.Bar` at rest, 2 cells by `filters`. `none` is the bar before any filter is added,
 * and `status` holds the demo's Status field filtered to `is Paid`. The root is the bar's Toolbar
 * root, `<div role="toolbar" data-slot="data-table-filter-bar">`, which fills the demo's column, and
 * it holds the bar's row. The row holds the Trigger, an outline `icon-sm` Icon button instance with
 * its `Funnel`, as `DataTableFilter.Trigger` renders it without children.
 *
 * The chip strip, `DataTableFilter.Chips`, holds no chip in `none`. It paints nothing and its
 * `-m-0.5` takes back its `p-0.5`, so it takes no room in the row. Figma keeps an auto-layout frame
 * that hugs both axes with no layers at its last size (EF1 to EF3, 2026-11-19), which would stand the
 * bar 100px tall, so that cell leaves the strip out and the ledger keeps its declarations as
 * unreached. Clear renders nothing while no filter is set.
 *
 * In `status` the strip holds one chip, and Clear, a ghost small Button instance, follows it. The
 * strip's margin folds into its padding, so it draws with none. The chip is the subject, the field's
 * Circle and name behind the `Field` property, then three segment instances in a 1px `border` stroke
 * on their start side: the operator and the value, ghost small Buttons, and Remove, a ghost `icon-sm`
 * Icon button with X. The operator's label shows Regular and the value is at most 224px wide, which
 * the instances override. The set draws no ghost chip, no narrow bar and no popup.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** Whether a cell holds the Status filter, whose chip and Clear show only there. */
const filtered = (cell: Cell): boolean => cell.filters === "status";

/** A ghost small Button the filtered cell shows with `label`, as a chip segment or Clear renders one. */
function segment(key: string, slot: string, label: string): InstanceManifest {
  return {
    kind: "instance",
    key,
    of: BUTTON_MANIFEST,
    slot,
    cell: () => ({ variant: "ghost", size: "sm", state: "rest", icon: "none" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: filtered,
  };
}

/** The width of the docs default demo's column, a sample width above the bar's 36rem narrow layout. */
export const DATA_TABLE_FILTER_HOST_WIDTH = 768;

/**
 * The bar's manifest, which the capture-backed build reads with `captures/data-table-filter-bar.json`:
 * the docs default demo's `<DataTableFilter.Bar aria-label="Order filters" />` with no filter set and
 * with its Status filter set. `filters` is an added axis, so the bar at rest keeps its key.
 */
export const DATA_TABLE_FILTER_BAR_MANIFEST: SetManifest = {
  key: "data-table-filter-bar",
  name: "Data table filter bar",
  api: { page: "data-table-filter", parts: ["DataTableFilter.Bar"] },
  slot: "data-table-filter-bar",
  axes: [
    { name: "state", values: ["rest"] },
    { name: "filters", values: ["none", "status"] },
  ],
  addedAxes: new Set(["filters"]),
  columnAxis: "filters",
  previewWidth: DATA_TABLE_FILTER_HOST_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "row",
      slot: "data-table-filter-bar-row",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          kind: "instance",
          key: "trigger",
          of: ICON_BUTTON_MANIFEST,
          slot: "data-table-filter-trigger",
          cell: () => ({ variant: "outline", size: "icon-sm", state: "rest" }),
          properties: () => ({ swap: { Icon: "Funnel" } }),
          shownIn: always,
        },
        {
          key: "chips",
          slot: "data-table-filter-chips",
          shownIn: filtered,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              key: "chip",
              slot: "data-table-filter-chip",
              shownIn: filtered,
              label: undefined,
              iconsFor: () => [],
              parts: [
                {
                  key: "subject",
                  slot: "data-table-filter-subject",
                  shownIn: filtered,
                  label: {
                    key: "label",
                    name: "label",
                    characters: "Status",
                    textProperty: "Field",
                    shownIn: filtered,
                  },
                  iconsFor: () => [
                    {
                      key: "icon",
                      name: "Icon",
                      side: "start",
                      direct: false,
                      dataIcon: undefined,
                      icon: "Circle",
                      swapProperty: undefined,
                    },
                  ],
                },
                segment("operator", "data-table-filter-operator", "is"),
                segment("value", "data-table-filter-value", "Paid"),
                {
                  kind: "instance",
                  key: "remove",
                  of: ICON_BUTTON_MANIFEST,
                  slot: "data-table-filter-remove",
                  cell: () => ({ variant: "ghost", size: "icon-sm", state: "rest" }),
                  properties: () => ({ swap: { Icon: "X" } }),
                  shownIn: filtered,
                },
              ],
            },
          ],
        },
        segment("clear", "data-table-filter-clear", "Clear filters"),
      ],
    },
  ],
  swapProperties: [],
};
