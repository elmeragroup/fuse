/**
 * The renderers of the Description list sets: the real Fuse `DescriptionList` in a host as wide as
 * the sets' preview width. An Item after another sits behind a hidden `<div>`, so it is not the
 * list's first `<div>` and draws its rule, while the capture still finds it as the list's first Item.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { DescriptionList } from "../../../fuse/dist/description-list.js";
import type { Cell } from "../components/component-spec.ts";
import {
  DESCRIPTION_LIST_HEADING,
  DESCRIPTION_LIST_PREVIEW_WIDTH,
  DESCRIPTION_LIST_ROWS,
} from "../components/description-list-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** An Item holding a term and its details. */
function item([term, details]: readonly [string, string]): ReactElement {
  return createElement(
    DescriptionList.Item,
    { key: term },
    createElement(DescriptionList.Term, null, term),
    createElement(DescriptionList.Details, null, details)
  );
}

/** A list holding the given children, with dividers or not, in a host of the preview width. */
function hosted(cell: Cell, ...children: ReactElement[]): ReactElement {
  return createElement(
    "div",
    { style: { width: `${String(DESCRIPTION_LIST_PREVIEW_WIDTH)}px` } },
    createElement(DescriptionList.Content, { dividers: cell.dividers !== "false" }, ...children)
  );
}

/** The `description-list-item` cell: the default demo's first Item, first in its list or after another. */
export const descriptionListItem: CellRendering = {
  element: (cell: Cell) => {
    const before = cell.position === "later" ? [createElement("div", { key: "before", hidden: true })] : [];
    return hosted(cell, ...before, item(DESCRIPTION_LIST_ROWS[0]));
  },
};

/** The `description-list` cell: the default demo, its heading over its Items. */
export const descriptionList: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      "div",
      { style: { width: `${String(DESCRIPTION_LIST_PREVIEW_WIDTH)}px` } },
      createElement(
        DescriptionList.Root,
        null,
        createElement(DescriptionList.Heading, null, DESCRIPTION_LIST_HEADING),
        createElement(
          DescriptionList.Content,
          { dividers: cell.dividers !== "false" },
          ...DESCRIPTION_LIST_ROWS.map((row) => item(row))
        )
      )
    ),
};
