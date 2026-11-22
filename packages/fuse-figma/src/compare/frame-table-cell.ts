/**
 * The renderers of the framed Table sets: the real Fuse `Table` as the item of a `Frame`, holding
 * the cell, row or body each set draws. The Frame sits in a host as wide as its content, so
 * the table is as wide as its content, as `table-cell.ts` lays out the plain blocks.
 *
 * A cell or row sample puts empty cells and rows around the part it measures, which give the
 * part its column and its row in the table and are narrower than it, so they widen none of its
 * columns. The measured part carries the set's `data-slot` in place of its own, since its neighbors
 * carry the same slot.
 *
 * Each rendering `shows` only its measured part, since a set draws none of the Frame's fill and border,
 * the neighbors' cells or, outside the body set, the body's shadow and highlight. A Figma instance of
 * the set holds none of that paint, and the crop's margin reached the Frame's border and the neighbors'
 * rules.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Frame } from "../../../fuse/dist/frame.js";
import { Table } from "../../../fuse/dist/table.js";
import type { Cell } from "../components/component-spec.ts";
import {
  FRAME_TABLE_CELL_SLOT,
  FRAME_TABLE_ROW_SLOT,
  framedCellColumn,
  framedCellRow,
} from "../components/frame-table-kit.ts";
import type { FramedBodyRow, FramedColumn } from "../components/frame-table-kit.ts";
import { TABLE_CELLS, TABLE_HEADS } from "../components/table-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A Frame whose one item is a Table holding the given children, in a host as wide as its content. */
function framed(...children: ReactElement[]): ReactElement {
  return createElement(
    "div",
    { style: { width: "max-content" } },
    createElement(Frame.Root, null, createElement(Table.Root, null, ...children))
  );
}

/** A part's props: its key, and the set's `data-slot` where the sample measures it. */
function slotted(key: string, slot: string | undefined): Readonly<Record<string, string>> {
  return slot === undefined ? { key } : { key, "data-slot": slot };
}

/** The columns of a row, in order. */
const COLUMNS: readonly FramedColumn[] = ["first", "middle", "last"];

/** A body row of empty cells, one per column. */
function emptyRow(key: string): ReactElement {
  return createElement(
    Table.Row,
    { key },
    ...COLUMNS.map((column) => createElement(Table.Cell, { key: column }))
  );
}

/** The body's rows around the given row: an empty one before a row that is not the first, and after one that is not the last. */
function bodyAround(row: FramedBodyRow, measured: ReactElement): ReactElement {
  const before = row === "first" ? [] : [emptyRow("before")];
  const after = row === "last" ? [] : [emptyRow("after")];
  return createElement(Table.Body, null, ...before, measured, ...after);
}

/** The `frame-table-cell` cell: the default demo's first cell, at its column of its body row. */
export const frameTableCell: CellRendering = {
  shows: "measured",
  element: (cell: Cell) => {
    const at = framedCellColumn(cell);
    const cells = COLUMNS.map((column) =>
      createElement(
        Table.Cell,
        slotted(column, column === at ? FRAME_TABLE_CELL_SLOT : undefined),
        column === at ? TABLE_CELLS[0] : null
      )
    );
    return framed(bodyAround(framedCellRow(cell), createElement(Table.Row, { key: "row" }, ...cells)));
  },
};

/**
 * The `frame-table-row` cell: the default demo's header row, or its first body row at the body's
 * first row, a middle one or its last, marked selected as the selected-row demo marks one.
 */
export const frameTableRow: CellRendering = {
  shows: "measured",
  element: (cell: Cell) => {
    const tagged = { key: "row", "data-slot": FRAME_TABLE_ROW_SLOT };
    const own = cell.selected === "true" ? { ...tagged, "data-state": "selected" } : tagged;
    if (cell.row === "header") {
      return framed(
        createElement(
          Table.Header,
          null,
          createElement(
            Table.Row,
            own,
            ...TABLE_HEADS.map((head) => createElement(Table.Head, { key: head }, head))
          )
        )
      );
    }
    const row = createElement(
      Table.Row,
      own,
      ...TABLE_CELLS.map((text) => createElement(Table.Cell, { key: text }, text))
    );
    return framed(bodyAround(framedCellRow(cell), row));
  },
};

/**
 * The `frame-table-body` cell: the default demo's body of two rows, both holding the demo's first row's
 * texts, so neither widens a column of the other.
 */
export const frameTableBody: CellRendering = {
  shows: "measured",
  element: () =>
    framed(
      createElement(
        Table.Body,
        null,
        ...["first", "last"].map((key) =>
          createElement(
            Table.Row,
            { key },
            ...TABLE_CELLS.map((text) => createElement(Table.Cell, { key: text }, text))
          )
        )
      )
    ),
};
