/**
 * The renderer of the `list-detail-pane` and `list-detail` sets: the docs default demo's real Fuse
 * `ListDetail.Root` in its split layout, in a host as wide and tall as the demo's `w-3xl h-80` row,
 * its list of ghost Buttons beside the detail pane. The pane's set measures the pane, and the root's
 * the whole demo. A cell with nothing selected shows the demo's empty
 * text, and a `content=value` cell the first customer, as the demo shows it once that row is clicked:
 * the row marked `aria-current`, and the title over the product in the pane. The detail's
 * `ListDetail.Close` renders nothing in the split layout.
 *
 * The root's container query shows the pane from 48rem, which the 768px host meets. The demo's own
 * classes are the host's, compiled as a host's build would.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */
import { createElement } from "react";

import { ListDetail } from "../../../fuse/dist/list-detail.js";
import type { Cell } from "../components/component-spec.ts";
import {
  LIST_DETAIL_DEMO_CLASSES as DEMO_CLASSES,
  LIST_DETAIL_EMPTY,
  LIST_DETAIL_HOST_HEIGHT,
  LIST_DETAIL_HOST_WIDTH,
} from "../components/list-detail-text.ts";
import type { CellRendering } from "./cell-renderers.ts";
import { customerDetail, customerList, DEMO_HOST_CLASSES } from "./list-detail-demo.ts";

/** A `list-detail-pane` or `list-detail` cell: the default demo's root in its row. */
export const listDetail: CellRendering = {
  hostWidth: LIST_DETAIL_HOST_WIDTH,
  hostClasses: DEMO_HOST_CLASSES,
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
        customerList(cell.content === "value"),
        createElement(
          ListDetail.Detail,
          { "aria-label": "Customer details", showCloseButton: false },
          cell.content === "value"
            ? customerDetail()
            : createElement("p", { className: DEMO_CLASSES.empty }, LIST_DETAIL_EMPTY)
        )
      )
    ),
};
