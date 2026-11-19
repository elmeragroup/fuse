/**
 * The renderers of the Table sets: the real Fuse `Table` around the head, cell, row or caption each
 * set draws. A head, a cell and a row sit in a host that sets no width, so the table is as wide as
 * its content, and the caption in a host as wide as the set's preview width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Table } from "../../../fuse/dist/table.js";
import type { Cell } from "../components/component-spec.ts";
import {
  TABLE_CAPTION,
  TABLE_CAPTION_PREVIEW_WIDTH,
  TABLE_CELLS,
  TABLE_HEADS,
} from "../components/table-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A table holding the given children, in a host of the given width, or one that sets none. */
function hosted(width: number | undefined, ...children: ReactElement[]): ReactElement {
  return createElement(
    "div",
    width === undefined ? null : { style: { width: `${String(width)}px` } },
    createElement(Table.Root, null, ...children)
  );
}

/** The `table-head` cell: the default demo's first head, alone in its header row. */
export const tableHead: CellRendering = {
  element: () =>
    hosted(
      undefined,
      createElement(
        Table.Header,
        null,
        createElement(Table.Row, null, createElement(Table.Head, null, TABLE_HEADS[0]))
      )
    ),
};

/** The `table-cell` cell: the default demo's first cell, alone in its body row. */
export const tableCell: CellRendering = {
  element: () =>
    hosted(
      undefined,
      createElement(
        Table.Body,
        null,
        createElement(Table.Row, null, createElement(Table.Cell, null, TABLE_CELLS[0]))
      )
    ),
};

/**
 * The `table-row` cell: the default demo's header row, its first body row with a plain row after it,
 * or a body row alone, which is the body's last, marked selected as the selected-row demo marks one.
 */
export const tableRow: CellRendering = {
  element: (cell: Cell) => {
    const marked = cell.selected === "true" ? { "data-state": "selected" } : {};
    if (cell.row === "header") {
      return hosted(
        undefined,
        createElement(
          Table.Header,
          null,
          createElement(
            Table.Row,
            { key: "row", ...marked },
            ...TABLE_HEADS.map((head) => createElement(Table.Head, { key: head }, head))
          )
        )
      );
    }
    const row = createElement(
      Table.Row,
      { key: "row", ...marked },
      ...TABLE_CELLS.map((text) => createElement(Table.Cell, { key: text }, text))
    );
    const after = cell.row === "body" ? [createElement("tr", { key: "after" })] : [];
    return hosted(undefined, createElement(Table.Body, null, row, ...after));
  },
};

/** The `table-caption` cell: the default demo's caption, under its table. */
export const tableCaption: CellRendering = {
  element: () => hosted(TABLE_CAPTION_PREVIEW_WIDTH, createElement(Table.Caption, null, TABLE_CAPTION)),
};
