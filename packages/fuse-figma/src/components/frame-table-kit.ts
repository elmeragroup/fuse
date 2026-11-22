/**
 * A framed Table, a Table that is one of a Frame's items, as the blocks a designer builds one from,
 * on the Table page beside the plain blocks: a body cell at each column of the body's first, a
 * middle or its last row, a row of head and cell instances, and a body of two row instances.
 *
 * A framed Table pads its first and last columns with the Frame's text inset, and its body cells
 * paint as one panel: each fills with `panel` inside its border, draws its share of the panel's
 * border, and the cells at the panel's corners round. A `table-cell` instance cannot carry that: the
 * plain cell draws no stroke and no fill of its own, and a framed cell's fill sits on a `padding box`
 * layer the plain cell lacks, so `instance-diff.ts` leaves the stroke and the layers unmapped and a
 * framed cell is a set of its own. A framed head differs from `table-head` only by the padding of
 * its outer side, which an instance's root overrides, so the header row holds a `table-head`
 * instance at every column.
 *
 * Each block draws as a table no wider than its content lays it out, as `table-kit.ts` says, so the
 * designer sets the column widths on the instances. Each sample holds its measured part beside
 * empty cells and rows, which give it the place in the table its variant names without widening
 * its column, and stamps `data-slot` on that part, since its neighbors carry the same slot.
 */
import type { InstanceManifest, LabelManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";
import { TABLE_CELLS, TABLE_HEAD_MANIFEST, TABLE_HEADS } from "./table-kit";

/** The columns a framed body cell draws. */
const CELL_COLUMNS = ["first", "middle", "last"] as const;

/** The body rows a framed body cell draws: the first, which draws the panel's top border, a middle one and the last. */
const BODY_ROWS = ["first", "body", "last"] as const;

/** A column a framed part takes in its row. */
export type FramedColumn = (typeof CELL_COLUMNS)[number];

/** A body row a framed cell takes in its body. */
export type FramedBodyRow = (typeof BODY_ROWS)[number];

/** The `data-slot` a framed cell's sample stamps on the cell it measures. */
export const FRAME_TABLE_CELL_SLOT = "frame-table-cell";

/** The `data-slot` a framed row's sample stamps on the row it measures. */
export const FRAME_TABLE_ROW_SLOT = "frame-table-row";

/**
 * A cell's value on one of the given axis values.
 *
 * @param values - The values the axis declares.
 * @param value - The cell's value.
 * @returns The value.
 * @throws When the cell names a value the axis does not declare, a defect in the caller's cell.
 */
function axisValue<Value extends string>(values: readonly Value[], value: string | undefined): Value {
  const found = values.find((candidate) => candidate === value);
  if (found === undefined) {
    throw new Error(`A framed Table part has no value ${value ?? ""}`);
  }
  return found;
}

/**
 * A framed body cell's column.
 *
 * @param cell - A `frame-table-cell` cell.
 * @returns Its column.
 */
export function framedCellColumn(cell: Cell): FramedColumn {
  return axisValue(CELL_COLUMNS, cell.column);
}

/**
 * A framed body cell's row.
 *
 * @param cell - A `frame-table-cell` cell.
 * @returns Its row.
 */
export function framedCellRow(cell: Cell): FramedBodyRow {
  return axisValue(BODY_ROWS, cell.row);
}

/** A text the given property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/**
 * The framed cell's manifest: the default demo's first cell, at each column of the body's first
 * row, a middle row and its last.
 */
export const FRAME_TABLE_CELL_MANIFEST: SetManifest = {
  key: "frame-table-cell",
  name: "Frame table cell",
  api: { page: "table", parts: ["Table.Cell"] },
  slot: FRAME_TABLE_CELL_SLOT,
  axes: [
    { name: "row", values: BODY_ROWS },
    { name: "column", values: CELL_COLUMNS },
  ],
  columnAxis: "column",
  label: text(TABLE_CELLS[0], "Text"),
  iconsFor: () => [],
  swapProperties: [],
};

/** The rows a framed row draws: the header row, then the body's first, a middle one and its last. */
const ROWS = ["header", ...BODY_ROWS] as const;

/** The column of a framed row's part at the given index of the three. */
function columnAt(column: number): FramedColumn {
  return column === 0 ? "first" : column === TABLE_HEADS.length - 1 ? "last" : "middle";
}

/** Whether a row cell draws the header row. */
function inHeader(cell: Cell): boolean {
  return cell.row === "header";
}

/**
 * The row's instances at the given column: a `table-head`, whose root padding the instance overrides
 * at the row's edges, and a framed body cell, each with its text.
 */
function rowParts(column: number): readonly InstanceManifest[] {
  const key = String(column + 1);
  const at = columnAt(column);
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
      of: FRAME_TABLE_CELL_MANIFEST,
      // The header row shows no body cell, so its cell names the first row, which it never draws.
      cell: (outer) => ({ row: inHeader(outer) ? "first" : framedCellRow(outer), column: at }),
      properties: () => ({ text: { Text: TABLE_CELLS[column] ?? "" } }),
      shownIn: (cell) => !inHeader(cell),
      slot: "table-cell",
    },
  ];
}

/**
 * The framed row's manifest: the default demo's header row, or its first body row at the body's
 * first row, a middle one or its last, hovered or not, and marked selected or not as the
 * selected-row demo marks one.
 */
export const FRAME_TABLE_ROW_MANIFEST: SetManifest = {
  key: "frame-table-row",
  name: "Frame table row",
  api: { page: "table", parts: ["Table.Row"] },
  slot: FRAME_TABLE_ROW_SLOT,
  axes: [
    { name: "row", values: ROWS },
    { name: "selected", values: ["false", "true"] },
    { name: "state", values: ["rest", "hover"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: TABLE_HEADS.flatMap((_, column) => rowParts(column)),
  swapProperties: [],
};

/**
 * The framed row's preview cells, one for each row it draws apart: the header row, which neither
 * `selected` nor `state` changes, then each body row at rest, hovered and selected, whose selected
 * fill hover leaves as it is.
 */
export const FRAME_TABLE_ROW_PREVIEW_CELLS: readonly Cell[] = [
  { row: "header", selected: "false", state: "rest" },
  ...BODY_ROWS.flatMap((row) => [
    { row, selected: "false", state: "rest" },
    { row, selected: "false", state: "hover" },
    { row, selected: "true", state: "rest" },
  ]),
];

/**
 * The framed body's manifest: the default demo's body, its first and last rows, each a `frame-table-row`
 * instance. The body rounds with the corner the Frame hands its items, casts the panel's shadow, and
 * draws its highlight over the rows, whose line lies on the last row's bottom border. Both rows hold
 * the same texts, so they share no column a longer text would widen, and they tile the body.
 *
 * Figma draws the body's shadow on every side. Chromium's Table scroll container clips it at the
 * sides always, and below the body unless something follows it in the container. Taking the shadow
 * away changes 260 pixels below the body with the demo's caption after it, and 2 without. The kit
 * names the clipping as a known limit in `kit-parity.ts`.
 */
export const FRAME_TABLE_BODY_MANIFEST: SetManifest = {
  key: "frame-table-body",
  name: "Frame table body",
  api: { page: "table", parts: ["Table.Body"] },
  slot: "table-body",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: (["first", "last"] as const).map((row): InstanceManifest => ({
    kind: "instance",
    key: `row-${row}`,
    of: FRAME_TABLE_ROW_MANIFEST,
    cell: () => ({ row, selected: "false", state: "rest" }),
    shownIn: always,
    slot: "table-row",
  })),
  swapProperties: [],
};
