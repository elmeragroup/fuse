/**
 * A table's boxes as auto layouts: the table and its row groups stack their rows down them, a row
 * sets its cells across it, and a cell holds its one child or its own text. CSS sizes a cell by its
 * column and its row (CSS 2.1 §17.5), which no auto layout reads, so a table box draws only where
 * the capture measured its parts tiling it exactly in every mode (`tableTiles`): then each box is as
 * large as what it holds, which an auto layout that hugs draws. `box-flow.ts` asks for a table box's
 * layout and `box-mapping.ts` for the coverage of its `display`.
 */
import { normalizeCss } from "./css-values";
import type { CounterAlignSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import type { Layout } from "./placement";

/** The displays of a table and its row groups, which stack their rows. */
const STACKS: ReadonlySet<string> = new Set([
  "table",
  "inline-table",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
]);

/** What a table box's `display` draws, for the coverage table. */
const DETAILS = {
  stack:
    "a vertical auto layout that hugs its rows, which the capture measured stacking with no space between in every mode",
  row: "a horizontal auto layout that hugs its cells, which the capture measured side by side with no space between in every mode",
  cell: "a frame that hugs what it holds, which the capture measured filling the cell in every mode, so neither its column nor its row stretches it",
} as const;

/** How a table box lays out its parts. */
type TableBox = keyof typeof DETAILS;

/** The kind of table box a `display` makes, or undefined for any other display. */
function tableBox(display: string): TableBox | undefined {
  if (STACKS.has(display)) {
    return "stack";
  }
  return display === "table-row" ? "row" : display === "table-cell" ? "cell" : undefined;
}

/** Where `vertical-align` sets a cell's content down it (CSS 2.1 §17.5.4), as Figma aligns a row's layers. */
const CELL_ALIGNS: ReadonlyMap<string, CounterAlignSpec> = new Map([
  ["top", "MIN"],
  ["middle", "CENTER"],
  ["bottom", "MAX"],
]);

/**
 * The layout of a table box the capture measured tiling its parts, as the module comment says, or
 * undefined for any other box. The table drops its `border-collapse` and `border-spacing`, since
 * the measurement shows no space between its parts either way. A cell sets what it holds across from
 * its start and down as its `vertical-align` says, which only its own text shows, since one child
 * fills it; a `baseline` cell stays unread there.
 *
 * @param reader - The box's style.
 * @param tiles - Whether the capture measured the box's parts tiling it in every mode.
 * @returns The layout, or undefined.
 */
export function readTableFlow(reader: LayerStyle, tiles: boolean): Layout | undefined {
  const kind = tableBox(normalizeCss(reader.raw("display") ?? ""));
  if (kind === undefined || !tiles) {
    return undefined;
  }
  for (const property of ["border-collapse", "border-spacing"]) {
    reader.read(
      property,
      (value) => value,
      () => ({
        outcome: "dropped",
        detail: "the capture measured the table's parts with no space between them",
      }),
      []
    );
  }
  const across = kind === "cell" ? readCellAlign(reader) : "MIN";
  return {
    flex: false,
    blocks: false,
    direction: kind === "stack" ? "VERTICAL" : "HORIZONTAL",
    primaryAlign: "MIN",
    counterAlign: across ?? "MIN",
    justify: "unset",
    table: true,
  };
}

/** A cell's `vertical-align` as the alignment down it, read where it maps. */
function readCellAlign(reader: LayerStyle): CounterAlignSpec | undefined {
  return reader.read(
    "vertical-align",
    (value) => CELL_ALIGNS.get(normalizeCss(value)),
    (align) => ({
      outcome: "literal",
      detail: `the cell sets what it holds ${align === "CENTER" ? "in its middle" : align === "MIN" ? "at its top" : "at its bottom"}`,
    }),
    reader.feed("counterAlign")
  );
}

/**
 * The coverage of a table box's `display` where {@link readTableFlow} laid it out, or undefined.
 *
 * @param display - The box's `display`.
 * @param layout - The box's layout.
 * @returns What the display draws.
 */
export function tableDisplayDetail(display: string, layout: Layout): string | undefined {
  const kind = tableBox(display);
  return kind === undefined || layout.table !== true ? undefined : DETAILS[kind];
}
