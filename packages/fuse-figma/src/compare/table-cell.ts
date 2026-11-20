/**
 * The renderers of the Table sets: the real Fuse `Table` around the head, cell, row or caption each
 * set draws. A head, a cell and a row sit in a host that sets no width, so the table is as wide as
 * its content, and the caption in a host as wide as the set's preview width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { CSSProperties, ReactElement } from "react";

import { Table } from "../../../fuse/dist/table.js";
import type { Cell } from "../components/component-spec.ts";
import {
  TABLE_CAPTION,
  TABLE_CAPTION_PREVIEW_WIDTH,
  TABLE_CELLS,
  TABLE_HEADS,
} from "../components/table-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A table holding the given children, in a host with the given style, or one that sets none. */
function hosted(style: CSSProperties | undefined, ...children: ReactElement[]): ReactElement {
  return createElement(
    "div",
    style === undefined ? null : { style },
    createElement(Table.Root, null, ...children)
  );
}

/**
 * The `table-head` cell: the default demo's first head, alone in its header row. The header gives the
 * row a bottom rule, which Chromium paints on the first pixel row below the head. The `table-row` set
 * draws that rule and the `table-head` set draws none, so the host clips the table at the head's
 * height. The clip would also hide a bottom border of the head's own, which Fuse's head does not
 * draw. A style on the row would replace the cascade's winner there, which the capture records.
 */
export const tableHead: CellRendering = {
  element: () =>
    hosted(
      { maxHeight: "var(--row-h-header)", overflow: "clip" },
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
 * The `table-row` cell: the default demo's header row, its first body row with a row after it, or a
 * body row alone, which is the body's last, marked selected as the selected-row demo marks one. The
 * row after a body row keeps it from being the body's last, whose rule Fuse removes.
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
    // The empty cell gives the following row enough height for the scroll container to show the
    // preceding row's bottom border.
    const after = cell.row === "body" ? [createElement("tr", { key: "after" }, createElement("td"))] : [];
    return hosted(undefined, createElement(Table.Body, null, row, ...after));
  },
};

/** The `table-caption` cell: the default demo's caption, under its table. */
export const tableCaption: CellRendering = {
  element: () =>
    hosted(
      { width: `${String(TABLE_CAPTION_PREVIEW_WIDTH)}px` },
      createElement(Table.Caption, null, TABLE_CAPTION)
    ),
};
