/**
 * The docs List detail default demo's list and selected detail, which `list-detail-cell.ts` renders
 * in the split layout and `list-detail-open-cell.ts` in the Sheet. The detail's header holds
 * `ListDetail.Close`, which renders nothing in the split layout.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build, and it imports nothing
 * else at run time but React and `components/list-detail-text.ts`, so the compare page's client
 * bundle can take it.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { X } from "../../../fuse/dist/icons.js";
import { ListDetail } from "../../../fuse/dist/list-detail.js";
import {
  LIST_DETAIL_CLOSE_LABEL,
  LIST_DETAIL_CUSTOMERS,
  LIST_DETAIL_DEMO_CLASSES as DEMO_CLASSES,
} from "../components/list-detail-text.ts";

/**
 * The demo's list of customers, each a ghost Button.
 *
 * @param selected - Whether the first customer is open, which marks its row `aria-current`.
 * @returns The `ListDetail.List`.
 */
export function customerList(selected: boolean): ReactElement {
  return createElement(
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
            "aria-current": selected && index === 0 ? "true" : undefined,
          },
          customer.name
        )
      )
    )
  );
}

/**
 * The demo's detail of its first customer: the header with the title and the close, over the product.
 *
 * @returns The detail's content.
 */
export function customerDetail(): ReactElement {
  const [customer] = LIST_DETAIL_CUSTOMERS;
  return createElement(
    "div",
    { className: DEMO_CLASSES.item },
    createElement(
      "div",
      { className: DEMO_CLASSES.header },
      createElement(ListDetail.Title, null, customer.name),
      createElement(ListDetail.Close, {
        render: createElement(Button, {
          variant: "ghost",
          size: "icon-sm",
          "aria-label": LIST_DETAIL_CLOSE_LABEL,
          className: DEMO_CLASSES.close,
        }),
        children: createElement(X, { "aria-hidden": true }),
      })
    ),
    createElement("p", { className: DEMO_CLASSES.product }, customer.product)
  );
}

/** The classes the demo passes, which a standalone-CSS host compiles in its own build. */
export const DEMO_HOST_CLASSES: readonly string[] = [
  ...new Set(Object.values(DEMO_CLASSES).flatMap((classes) => classes.split(" "))),
];
