/**
 * A grid whose items each span its two columns `min(50%, <length>) auto`, each a subgrid holding two
 * cells, as Description list's responsive layout lays out its Items. CSS shares the two columns among
 * the Items, so every Item's cells line up. Figma has no subgrid, so the list draws as a column of
 * rows, and each row splits its own width the way the shared columns split the list's.
 *
 * The list's width is the width of every Item, since each spans every column. The first column is
 * `min(50%, <length>)` of that width, and the `auto` column stretches over the rest (CSS Grid 1
 * §7.2.4, §11.8). Two FILL layers in a horizontal auto layout split it evenly whatever they hold
 * (probe DL3), and a `maxWidth` on the first caps it while the second takes the rest: at the cap of
 * 320px, a row 800px wide drew 320 and 480, and one 576px wide drew 288 and 288 (DL2, 2026-11-19), the
 * widths Chromium gives Description list at those widths. Every row computes the same split from the
 * same width, so the rows line up as the shared columns do, at any width.
 *
 * The rule maps only that shape. The percentage must be 50%, which is what two FILL layers split. The
 * length must read as pixels. The list and the Item set no column gap, through `column-gap` or the
 * `gap` shorthand, which would take its share before the split. The list sets no `justify-content`,
 * which could leave the `auto` column unstretched, and no other alignment. The list, the Item and the
 * cells lay their lines horizontally, since a vertical writing mode turns the columns into rows. The
 * Item spans the list's columns (`1 / -1`) and has no inline margin or padding, since each would
 * narrow an edge column (CSS Grid 2 §9). Its only border is the `border-top-width` that draws
 * Description list's divider. No probe measured any other border, set through a longhand or a
 * shorthand such as `border` or `border-width`, so one keeps the Item unmapped. The Item sets no
 * width, minimum or maximum: a subgrid ignores them across its subgridded columns and stays as wide
 * as its span, where the row would take them. It must not hug its width, which would make the
 * percentage cyclic. Its two cells sit in columns 1 and 2 in source order, set no width, inline
 * margin, border or self-alignment of their own, and paint nothing. CSS stretches each cell to its
 * row's height (CSS Box Alignment 3 §6.1), where the row draws each cell at its own height from the
 * top. A block cell that paints nothing and sets no `align-content` places its text from its top
 * either way, so the two draw alike. A `flex items-center` cell, or one with `align-content: center`,
 * sets its text down the stretched height, so a cell that is not a block, or sets an
 * `align-content`, keeps the Item unmapped.
 *
 * A word in the second cell wider than its share is a known limit. CSS widens the `auto` column for
 * every Item and pushes the list past its width, where the Figma row breaks the word.
 */
import type { Room } from "./box-sizing";
import { evaluateLength, normalizeCss, splitTopLevel } from "./css-values";
import type { LimitsSpec, NumberSpec, SizingSpec } from "./kit-spec";
import type { Feed, LayerStyle } from "./layer-style";
import type { Layout } from "./placement";

/** What {@link readSubgridFlow} read a box as: the list's column, or an Item's row and its first cell's cap. */
export type SubgridLayout =
  | { readonly kind: "list" }
  | { readonly kind: "item"; readonly firstMaximum: NumberSpec };

/** The span `col-span-full` compiles to, every column of the grid. */
const FULL_SPAN = "1/-1";

/** What a grid with no gap of its own between its columns sets, or leaves at its initial value. */
const NO_GAP: ReadonlySet<string> = new Set(["", "normal", "0", "0px"]);

/** An unset alignment, which leaves CSS's stretch. */
const UNSET_ALIGN: ReadonlySet<string> = new Set(["", "normal", "stretch"]);

/** An unset self-alignment, which leaves the grid's stretch. */
const UNSET_SELF: ReadonlySet<string> = new Set(["", "auto", "normal", "stretch"]);

/** The properties a grid leaves unset where its items keep its columns and its rows hug them. */
const GRID_UNSET = [
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-columns",
  "grid-auto-rows",
] as const;

/** The properties an item leaves unset, so it places itself nowhere but its own row in order. */
const PLACEMENT = ["grid-area", "grid-row", "grid-row-start", "grid-row-end", "order", "position"] as const;

/** The widths an Item leaves unset, which a subgrid ignores across its columns and the row would not. */
const ITEM_WIDTHS = ["width", "min-width", "max-width"] as const;

/** The properties a cell leaves unset, so it fills its column and places itself nowhere else. */
const CELL_UNSET = [
  ...PLACEMENT,
  "grid-column",
  "grid-column-end",
  "width",
  "min-width",
  "max-width",
  "justify-self",
  "align-self",
  "place-self",
] as const;

/** The properties a cell leaves unset where it paints nothing, so stretched it draws as it does unstretched. */
const PAINT = ["background-color", "background-image", "box-shadow", "outline-width"] as const;

/** The alignments that would move a block cell's content down its stretched height. */
const CONTENT_ALIGN = ["align-content", "place-content"] as const;

/** The sides a border declaration names: every side, a physical one, or a logical one or pair. */
const BORDER_SIDES = [
  "",
  "-top",
  "-right",
  "-bottom",
  "-left",
  "-block",
  "-block-start",
  "-block-end",
  "-inline",
  "-inline-start",
  "-inline-end",
] as const;

/** The declarations that can set a border width: each side's `border` shorthand and its `-width`. */
const BORDER_WIDTHS: readonly string[] = BORDER_SIDES.flatMap((side) => [
  `border${side}`,
  `border${side}-width`,
]);

/** The border the real Item draws, the only one the probes measured on an Item: a top width. */
const ITEM_BORDER = "border-top-width";

/** The border styles that draw no border whatever the width, so its width computes to zero. */
const NO_BORDER_STYLE: ReadonlySet<string> = new Set(["none", "hidden"]);

/** The writing modes that leave a box's lines horizontal: the initial one, set or reset. */
const HORIZONTAL: ReadonlySet<string> = new Set(["horizontal-tb", "initial"]);

/** The keywords that take a box's writing mode from its parent. */
const FROM_PARENT: ReadonlySet<string> = new Set(["inherit", "unset"]);

/** Why an Item's own `display` and `grid-template-columns` draw a row. */
const ROW_DETAIL =
  "a horizontal auto layout, the subgrid's two cells side by side in the list's columns, which every Item splits alike";

/** Why a list's `display` draws a column. */
const LIST_DETAIL = "a vertical auto layout, each item spanning every column in a row of its own";

/** Why a cell's `grid-column-start` drops. */
const IN_ORDER = "it places the cell in its column in source order, the order the row draws its cells in";

/**
 * The cap of a grid's first column, where its columns are `min(50%, <length>) auto` and the length
 * reads as pixels.
 *
 * @param columns - The grid's `grid-template-columns`, its variables substituted.
 * @returns The first column's cap in pixels, or undefined for any other columns.
 */
function halfCappedColumns(columns: string): number | undefined {
  const [first, second, ...rest] = splitTopLevel(normalizeCss(columns), " ");
  if (first === undefined || second !== "auto" || rest.length > 0) {
    return undefined;
  }
  if (!first.startsWith("min(") || !first.endsWith(")")) {
    return undefined;
  }
  const [share, length, ...others] = splitTopLevel(first.slice(4, -1), ",");
  const cap = length === undefined ? undefined : evaluateLength(length);
  return share === "50%" && others.length === 0 && cap !== undefined && cap > 0 ? cap : undefined;
}

/** Whether every property of `properties` is unset on the style, or set to one of `values`. */
function leaves(style: LayerStyle, properties: readonly string[], values: ReadonlySet<string>): boolean {
  return properties.every((property) => values.has(normalizeCss(style.resolved(property) ?? "")));
}

/**
 * Whether a grid's columns have no gap between them, which a subgrid takes from its parent. The
 * cascade keeps `gap` apart from its longhands, so this reads both, and each must leave no column
 * gap: `column-gap`, and `gap`'s second value or its only one (CSS Box Alignment 3 §8.3).
 */
function gapless(style: LayerStyle): boolean {
  const [row = "", column = row] = splitTopLevel(normalizeCss(style.resolved("gap") ?? ""), " ");
  return NO_GAP.has(column) && leaves(style, ["column-gap"], NO_GAP);
}

/**
 * Whether a border declaration draws no width. A `-width` draws none where each of its values is a
 * zero length. A shorthand draws none where it writes a zero width, as Preflight's `border: 0 solid`
 * does, or a style that draws nothing (CSS Backgrounds 3 §3); it leaves the width at `medium`
 * otherwise. Any other value counts as a width.
 */
function drawsNoWidth(property: string, value: string): boolean {
  const values = splitTopLevel(normalizeCss(value), " ");
  return property.endsWith("-width")
    ? values.every((width) => evaluateLength(width) === 0)
    : values.some((part) => evaluateLength(part) === 0 || NO_BORDER_STYLE.has(part));
}

/**
 * Whether a box draws no border width, leaving out the one declaration `except` names. The cascade
 * keeps each shorthand apart from its longhands, so this reads every declaration that can set a width.
 */
function borderless(style: LayerStyle, except?: string): boolean {
  return BORDER_WIDTHS.every(
    (property) =>
      property === except || !style.has(property) || drawsNoWidth(property, style.resolved(property) ?? "")
  );
}

/**
 * Whether a box lays its lines horizontally: its own `writing-mode`, or where it sets none or
 * takes its parent's, the nearest box above it that sets one (CSS Writing Modes 3 §3.1). The build
 * passes no `writing-mode` down, so this walks up from the box.
 *
 * @param box - The box's style, or undefined above the outermost box, which lays its lines
 *   horizontally as the initial `horizontal-tb` does.
 * @returns True for a horizontal writing mode.
 */
export function horizontal(box: LayerStyle | undefined): boolean {
  if (box === undefined) {
    return true;
  }
  const mode = normalizeCss(box.resolved("writing-mode") ?? "inherit");
  return FROM_PARENT.has(mode) ? horizontal(box.parent()) : HORIZONTAL.has(mode);
}

/** Whether every length of `properties` is zero on the style, or unset. */
function zero(style: LayerStyle, properties: readonly string[]): boolean {
  return properties.every((property) => evaluateLength(style.resolved(property) ?? "0px") === 0);
}

/** A span's lines, with the spaces around its `/` dropped. */
function span(style: LayerStyle): string {
  return (style.resolved("grid-column") ?? "").replaceAll(/\s+/g, "");
}

/**
 * Whether a cell sits in the given column of its subgrid by source order, as a `grid-column-start`
 * of that column or none places it, fills it, lays its content out as a block from its top, and
 * paints nothing.
 */
function cellInColumn(cell: LayerStyle, column: number): boolean {
  const start = normalizeCss(cell.resolved("grid-column-start") ?? "auto");
  return (
    ["auto", String(column)].includes(start) &&
    normalizeCss(cell.resolved("display") ?? "block") === "block" &&
    leaves(cell, CONTENT_ALIGN, new Set(["", "normal"])) &&
    CELL_UNSET.every((property) => !cell.has(property)) &&
    zero(cell, ["margin-left", "margin-right"]) &&
    borderless(cell) &&
    horizontal(cell) &&
    PAINT.every((property) => !cell.has(property))
  );
}

/**
 * Whether a grid lays each of its parts in a row of its own across its columns `min(50%, <length>)
 * auto`, as Description list's list does: every part spans `1 / -1`, places itself nowhere else, and
 * leaves the grid's alignment to stretch it, and the grid sets no rows, areas, flow or alignment of
 * its own.
 */
function spansRows(grid: LayerStyle, parts: readonly LayerStyle[], others: number): boolean {
  return (
    normalizeCss(grid.resolved("display") ?? "") === "grid" &&
    halfCappedColumns(grid.resolved("grid-template-columns") ?? "") !== undefined &&
    others === 0 &&
    parts.length > 0 &&
    horizontal(grid) &&
    parts.every(horizontal) &&
    GRID_UNSET.every((property) => !grid.has(property)) &&
    normalizeCss(grid.resolved("grid-auto-flow") ?? "row") === "row" &&
    leaves(
      grid,
      ["justify-items", "align-items", "place-items", "justify-content", "align-content", "place-content"],
      UNSET_ALIGN
    ) &&
    parts.every(
      (part) =>
        span(part) === FULL_SPAN &&
        PLACEMENT.every((property) => !part.has(property)) &&
        leaves(part, ["justify-self", "align-self", "place-self"], UNSET_SELF)
    )
  );
}

/**
 * Read an Item that is a subgrid of a list {@link spansRows} draws, as the module says, and read the
 * declarations that draw it: its `display`, its `grid-template-columns: subgrid` and its span, the
 * list's columns as the first cell's `maxWidth`, and each cell's `grid-column-start`.
 *
 * @returns The first cell's cap, or undefined where the Item does not draw as a row.
 */
function readItem(
  item: LayerStyle,
  cells: readonly LayerStyle[],
  box: { readonly others: number; readonly outOfFlow: number; readonly sizing: SizingSpec }
): NumberSpec | undefined {
  const list = item.parent();
  const cap = halfCappedColumns(list?.resolved("grid-template-columns") ?? "");
  const [first, second, ...more] = cells;
  if (
    list === undefined ||
    cap === undefined ||
    first === undefined ||
    second === undefined ||
    more.length > 0 ||
    box.others > 0 ||
    box.outOfFlow > 0 ||
    box.sizing.horizontal.kind === "hug" ||
    normalizeCss(item.resolved("display") ?? "") !== "grid" ||
    normalizeCss(item.resolved("grid-template-columns") ?? "") !== "subgrid" ||
    !spansRows(list, [item], 0) ||
    !gapless(list) ||
    !gapless(item) ||
    GRID_UNSET.some((property) => item.has(property)) ||
    ITEM_WIDTHS.some((property) => item.has(property)) ||
    normalizeCss(item.resolved("grid-auto-flow") ?? "row") !== "row" ||
    !leaves(item, ["justify-items", "align-items", "place-items"], UNSET_ALIGN) ||
    !zero(item, ["margin-left", "margin-right", "padding-left", "padding-right"]) ||
    !borderless(item, ITEM_BORDER) ||
    !cellInColumn(first, 1) ||
    !cellInColumn(second, 2)
  ) {
    return undefined;
  }
  const lays = [...item.feed("direction"), ...item.feed("primaryAlign"), ...item.feed("counterAlign")];
  for (const property of ["display", "grid-template-columns", "grid-column"]) {
    item.read(
      property,
      (value) => value,
      () => ({ outcome: "literal", detail: ROW_DETAIL }),
      lays
    );
  }
  list.read(
    "grid-template-columns",
    (value) => value,
    () => ({
      outcome: "literal",
      detail: `the first cell fills the row up to a maxWidth of ${String(cap)}, the length its column's \`min()\` caps it at, and the second fills the rest`,
    }),
    [...first.feed("limits"), ...first.feed("sizing"), ...second.feed("sizing")]
  );
  for (const cell of [first, second]) {
    cell.read(
      "grid-column-start",
      (value) => value,
      () => ({ outcome: "dropped", detail: IN_ORDER }),
      []
    );
  }
  return { kind: "literal", value: cap };
}

/**
 * Read a box as the module says: an Item that is a subgrid of such a list draws as a horizontal auto
 * layout of its two cells, and the list draws as a vertical one whose Items fill it. The list takes
 * the one-column grid's layout, which stretches its parts across it and spaces them by `row-gap`,
 * since each Item fills a row of its own as a one-column grid's item does. The reader notes the
 * declarations that draw each.
 *
 * @param reader - The box's style.
 * @param parts - The styles of the parts in the box's flow.
 * @param box - How many icons and labels sit in its flow beside its parts, how many of its parts sit
 *   out of its flow, its sizing and limits, and the sizing of the layers inside it, which the list's
 *   `display` decides as it stretches them.
 * @returns The box's layout, or undefined where it is neither shape.
 */
export function readSubgridFlow(
  reader: LayerStyle,
  parts: readonly LayerStyle[],
  box: {
    readonly others: number;
    readonly outOfFlow: number;
    readonly sizing: SizingSpec;
    readonly limits: LimitsSpec;
    readonly inside: Feed;
  }
): Layout | undefined {
  const firstMaximum = readItem(reader, parts, box);
  if (firstMaximum !== undefined) {
    return {
      flex: false,
      blocks: false,
      direction: "HORIZONTAL",
      primaryAlign: "MIN",
      counterAlign: "MIN",
      justify: "unset",
      subgrid: { kind: "item", firstMaximum },
    };
  }
  const rowsHug = box.sizing.vertical.kind === "hug" && box.limits.minHeight === undefined;
  if (!rowsHug || !spansRows(reader, parts, box.others)) {
    return undefined;
  }
  reader.read(
    "display",
    (value) => value,
    () => ({ outcome: "literal", detail: LIST_DETAIL }),
    [
      ...reader.feed("direction"),
      ...reader.feed("primaryAlign"),
      ...reader.feed("counterAlign"),
      ...box.inside,
    ]
  );
  return {
    flex: true,
    blocks: false,
    direction: "VERTICAL",
    primaryAlign: "MIN",
    counterAlign: "MIN",
    justify: "unset",
    oneColumnGrid: true,
    subgrid: { kind: "list" },
  };
}

/**
 * The room an Item's row gives a cell: each fills the row's width, the first up to its cap, and hugs
 * its height from the row's top.
 *
 * @param row - The Item's row, as {@link readSubgridFlow} read it.
 * @param index - The cell's place in the row.
 * @returns The cell's room.
 */
export function subgridCellRoom(row: Extract<SubgridLayout, { readonly kind: "item" }>, index: number): Room {
  const room: Room = {
    horizontal: { percent: { kind: "none" }, auto: { kind: "fill" }, siblings: [], length: undefined },
    vertical: { percent: { kind: "none" }, auto: { kind: "hug" }, siblings: [], length: undefined },
    widthCap: { kind: "unread" },
    unbounded: false,
  };
  if (index !== 0) {
    return room;
  }
  return { ...room, maximumWidth: row.firstMaximum };
}
