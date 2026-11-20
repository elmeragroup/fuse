/**
 * Data table filter's bar, as one component set on a page of its own: the docs default demo's
 * `DataTableFilter.Bar` at rest, before any filter is added, 1 cell. The root is the bar's Toolbar
 * root, `<div role="toolbar" data-slot="data-table-filter-bar">`, which fills the demo's column, and
 * it holds the bar's row. The row holds the Trigger, an outline `icon-sm` Icon button instance with
 * its `Funnel`, as `DataTableFilter.Trigger` renders it without children.
 *
 * The chip strip, `DataTableFilter.Chips`, holds no chip at rest. It paints nothing and its `-m-0.5`
 * takes back its `p-0.5`, so it takes no room in the row. Figma keeps an auto-layout frame that hugs
 * both axes with no layers at its last size (EF1 to EF3, 2026-11-19), which would stand the bar 100px
 * tall, so the set leaves the strip out and the ledger keeps its declarations as unreached. Drawing
 * chips is #821. Clear renders nothing while no filter is set. The set draws no chip, no Clear, no
 * narrow bar and no popup.
 */
import type { SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";

/** The width of the docs default demo's column, a sample width above the bar's 36rem narrow layout. */
export const DATA_TABLE_FILTER_HOST_WIDTH = 768;

/**
 * The bar's manifest, which the capture-backed build reads with `captures/data-table-filter-bar.json`:
 * the docs default demo's `<DataTableFilter.Bar aria-label="Order filters" />` with no filter set.
 */
export const DATA_TABLE_FILTER_BAR_MANIFEST: SetManifest = {
  key: "data-table-filter-bar",
  name: "Data table filter bar",
  api: { page: "data-table-filter", parts: ["DataTableFilter.Bar"] },
  slot: "data-table-filter-bar",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
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
      ],
    },
  ],
  swapProperties: [],
};
