import type { InstanceManifest, LabelManifest, SetManifest } from "../capture/manifest";
/**
 * Table, as the blocks a designer builds a table from, on a page of their own: a head, a cell, a row
 * of their instances and a caption. CSS shares a table wider than its content among its columns by
 * their content (CSS 2.1 §17.5.2.2), which no auto layout reproduces, so each block draws as a table
 * no wider than its content lays it out, and the designer sets the column widths on the instances.
 */
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The width the caption's sample host gives its table, which the caption spans. */
export const TABLE_CAPTION_PREVIEW_WIDTH = 512;

/** The caption's text, the docs default demo's. */
export const TABLE_CAPTION = "Recent orders";

/** The header row's texts, the docs default demo's. */
export const TABLE_HEADS = ["Order", "Status", "Amount"] as const;

/** The first body row's texts, the docs default demo's. */
export const TABLE_CELLS = ["#1042", "Active", "NOK 1 240"] as const;

/** A text the given property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/** The head's manifest: the docs default demo's first head, alone in its table's header row. */
export const TABLE_HEAD_MANIFEST: SetManifest = {
  key: "table-head",
  name: "Table head",
  api: { page: "table", parts: ["Table.Head"] },
  slot: "table-head",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: text(TABLE_HEADS[0], "Text"),
  iconsFor: () => [],
  swapProperties: [],
};

/** The cell's manifest: the docs default demo's first cell, alone in its table's body row. */
export const TABLE_CELL_MANIFEST: SetManifest = {
  key: "table-cell",
  name: "Table cell",
  api: { page: "table", parts: ["Table.Cell"] },
  slot: "table-cell",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: text(TABLE_CELLS[0], "Text"),
  iconsFor: () => [],
  swapProperties: [],
};

/** Whether a row cell draws the header row. */
function inHeader(cell: Cell): boolean {
  return cell.row === "header";
}

/** The row's instance of the head or the cell set at the given column, with its text. */
function rowCell(column: number): readonly InstanceManifest[] {
  const key = String(column + 1);
  return [
    {
      kind: "instance",
      key: `head-${key}`,
      of: TABLE_HEAD_MANIFEST,
      cell: () => ({ state: "rest" }),
      properties: () => ({ text: { Text: TABLE_HEADS[column] ?? "" } }),
      shownIn: inHeader,
    },
    {
      kind: "instance",
      key: `cell-${key}`,
      of: TABLE_CELL_MANIFEST,
      cell: () => ({ state: "rest" }),
      properties: () => ({ text: { Text: TABLE_CELLS[column] ?? "" } }),
      shownIn: (cell) => !inHeader(cell),
    },
  ];
}

/**
 * The row's manifest: the docs default demo's header row or first body row, or its last body row,
 * which draws no rule, hovered or not, and marked selected or not as the selected-row demo marks one.
 */
export const TABLE_ROW_MANIFEST: SetManifest = {
  key: "table-row",
  name: "Table row",
  api: { page: "table", parts: ["Table.Row"] },
  slot: "table-row",
  axes: [
    { name: "row", values: ["header", "body", "last"] },
    { name: "selected", values: ["false", "true"] },
    { name: "state", values: ["rest", "hover"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: TABLE_HEADS.flatMap((_, column) => rowCell(column)),
  swapProperties: [],
};

/** The caption's manifest: the docs default demo's caption, under a table as wide as its host. */
export const TABLE_CAPTION_MANIFEST: SetManifest = {
  key: "table-caption",
  name: "Table caption",
  api: { page: "table", parts: ["Table.Caption"] },
  slot: "table-caption",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  previewWidth: TABLE_CAPTION_PREVIEW_WIDTH,
  label: text(TABLE_CAPTION, "Text"),
  iconsFor: () => [],
  swapProperties: [],
};
