/**
 * The renderer of the `list-detail-pane` and `list-detail` sets: the docs default demo's real Fuse
 * `ListDetail.Root` in its split layout, in a host as wide and tall as the demo's `w-3xl h-80` row,
 * its list of ghost Buttons beside the detail pane. The pane's set measures the pane, and the root's
 * the whole demo. A cell with nothing selected shows the demo's empty
 * text, and a `content=value` cell the first customer, as the demo shows it once that row is clicked:
 * the row marked `aria-current`, and the title over the product in the pane.
 *
 * The root's container query shows the pane from 48rem, which the 768px host meets. The demo's own
 * classes are the host's, compiled as a host's build would.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { ListDetail } from "../../../fuse/dist/list-detail.js";
import type { Cell } from "../components/component-spec.ts";
import {
  LIST_DETAIL_CUSTOMERS,
  LIST_DETAIL_EMPTY,
  LIST_DETAIL_HOST_HEIGHT,
  LIST_DETAIL_HOST_WIDTH,
} from "../components/list-detail-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The classes the docs default demo passes, by the element that takes them. */
const DEMO_CLASSES = {
  host: "flex",
  root: "flex-1",
  list: "m-0 flex list-none flex-col gap-1 p-2",
  row: "w-full justify-start",
  empty: "text-sm m-auto p-6 text-muted-foreground",
  item: "flex flex-col gap-2 p-4",
  header: "flex items-center gap-2",
  product: "text-sm m-0",
} as const;

/** The pane's content: the empty text, or the first customer's title and product. */
function detail(cell: Cell): ReactElement {
  if (cell.content !== "value") {
    return createElement("p", { className: DEMO_CLASSES.empty }, LIST_DETAIL_EMPTY);
  }
  const [customer] = LIST_DETAIL_CUSTOMERS;
  return createElement(
    "div",
    { className: DEMO_CLASSES.item },
    createElement(
      "div",
      { className: DEMO_CLASSES.header },
      createElement(ListDetail.Title, null, customer.name)
    ),
    createElement("p", { className: DEMO_CLASSES.product }, customer.product)
  );
}

/** A `list-detail-pane` or `list-detail` cell: the default demo's root in its row. */
export const listDetail: CellRendering = {
  hostWidth: LIST_DETAIL_HOST_WIDTH,
  hostClasses: [...new Set(Object.values(DEMO_CLASSES).flatMap((classes) => classes.split(" ")))],
  element: (cell: Cell) =>
    createElement(
      "div",
      {
        className: DEMO_CLASSES.host,
        style: {
          width: `${String(LIST_DETAIL_HOST_WIDTH)}px`,
          height: `${String(LIST_DETAIL_HOST_HEIGHT)}px`,
        },
      },
      createElement(
        ListDetail.Root,
        { open: false, onOpenChange: () => undefined, split: "3xl", className: DEMO_CLASSES.root },
        createElement(
          ListDetail.List,
          { render: createElement("ul"), "aria-label": "Customers", className: DEMO_CLASSES.list },
          ...LIST_DETAIL_CUSTOMERS.map((customer, index) =>
            createElement(
              "li",
              { key: customer.name },
              createElement(
                Button,
                {
                  variant: "ghost",
                  className: DEMO_CLASSES.row,
                  "aria-current": cell.content === "value" && index === 0 ? "true" : undefined,
                },
                customer.name
              )
            )
          )
        ),
        createElement(
          ListDetail.Detail,
          { "aria-label": "Customer details", showCloseButton: false },
          detail(cell)
        )
      )
    ),
};
