/**
 * The renderer of the `data-table-filter-bar` set: the docs default demo's real Fuse
 * `DataTableFilter.Bar` with no filter set, in the demo's column, in a host as wide as
 * {@link DATA_TABLE_FILTER_HOST_WIDTH}. The bar fills the column, which stretches it across.
 *
 * The bar reads its words from `LocaleProvider`, so the cell renders in an en-US one. Its Root reads
 * a table source, which the cell hands as a plain object holding no filter, since the bar at rest
 * reads nothing else from it. The Root needs fields, and the bar at rest shows none of them, so the
 * cell passes the demo's Status field alone. The demo's classes are the host's, compiled as a host's
 * build would.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */
import { createElement } from "react";

import { DataTableFilter, defineFilterFields } from "../../../fuse/dist/data-table-filter.js";
import type { FilterTableSource } from "../../../fuse/dist/data-table-filter.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { DATA_TABLE_FILTER_HOST_WIDTH } from "../components/data-table-filter-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The classes of the docs default demo's column around the bar. */
const COLUMN_CLASSES = "flex w-full min-w-0 flex-col gap-4";

/** The docs default demo's Status field, the one field the cell's Root holds. */
const FIELDS = defineFilterFields<{ readonly status: string }>()({
  status: {
    kind: "option",
    label: "Status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
    ],
  },
});

/** A table source with no column filter, whose filters never change. */
const UNFILTERED: FilterTableSource = {
  setColumnFilters: () => undefined,
  getColumn: (id) => ({ id }),
  options: {},
  atoms: { columnFilters: { get: () => [], subscribe: () => ({ unsubscribe: () => undefined }) } },
};

/** The `data-table-filter-bar` cell: the default demo's bar before any filter is added. */
export const dataTableFilterBar: CellRendering = {
  hostClasses: COLUMN_CLASSES.split(" "),
  element: () =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        "div",
        { style: { width: `${String(DATA_TABLE_FILTER_HOST_WIDTH)}px` } },
        createElement(
          DataTableFilter.Root,
          { table: UNFILTERED, fields: FIELDS, timeZone: "Europe/Oslo" },
          createElement(
            "div",
            { className: COLUMN_CLASSES },
            createElement(DataTableFilter.Bar, { "aria-label": "Order filters" })
          )
        )
      ),
    }),
};
