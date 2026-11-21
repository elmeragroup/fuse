/**
 * A grid whose items each span its two columns `min(50%, <length>) auto`, each a subgrid holding two
 * cells, as Description list's responsive layout lays out its Items. CSS shares the two columns among
 * the Items, so every Item's cells line up. Figma has no subgrid, so the list draws as a column of
 * rows, and each row splits its own width the way the shared columns split the list's.
 *
 * The list's width is the width of every Item, since each spans every column. The first column is
 * `min(50%, <length>)` of that width, and the `auto` column stretches over the rest (CSS Grid 1
 * §7.2.4, §11.8). Two FILL layers that pad no side, in a horizontal auto layout, split it evenly
 * whatever they hold (probe DL3; {@link drawSubgridCell} moves a cell's side padding inside, DL5),
 * and a `maxWidth` on the first caps it while the second takes the rest: at the cap of
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
 * percentage cyclic. Its two cells are frames the Item draws, not instance parts, whose side padding
 * {@link drawSubgridCell} could not move inside them and whose root takes no cap. They sit in columns
 * 1 and 2 in source order, set no width, inline
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
import { NO_LIMITS, outOfLayout, ZERO } from "./kit-spec";
import type { BoxSpec, ChildLayerSpec, FrameLayerSpec, LimitsSpec, NumberSpec, SizingSpec } from "./kit-spec";
import type { Feed, FeedTarget, LayerStyle, SpecField } from "./layer-style";
import type { Layout } from "./placement";

/** What {@link readSubgridFlow} read a box as: the list's column, or an Item's row and its first cell's cap. */
export type SubgridLayout =
  | { readonly kind: "list" }
  | { readonly kind: "item"; readonly firstMaximum: NumberSpec };

/** A cell of an Item's row, and the width it fills up to: the first cell's cap, none for the second. */
export type SubgridCell = { readonly maximumWidth: NumberSpec | undefined };

/** The key and name of the frame inside a cell that takes the cell's side padding, unless a layer of the cell has it. */
const INSET = "inset";

/** The fields of a cell the inner frame takes: its side padding and the layout of what it holds. */
const INSET_FIELDS: ReadonlySet<SpecField> = new Set([
  "paddingLeft",
  "paddingRight",
  "direction",
  "itemSpacing",
  "primaryAlign",
  "counterAlign",
  "layers",
]);

/** The fields of a cell its side padding fills. */
const SIDE_PADDING: ReadonlySet<SpecField> = new Set(["paddingLeft", "paddingRight"]);

/** Why a cell's side padding stays unmapped where no one frame inside the cell keeps its paint order. */
const INTERLEAVED =
  "the cell's layers in its layout sit on both sides of a layer out of it, so no one frame inside the cell takes the side padding and keeps their paint order, and padding on the cell moves the row's split (probe DL5)";

/** Why a cell's side padding stays unmapped where the cell holds no layer in its layout. */
const NOTHING_IN_FLOW =
  "the cell holds no layer in its layout, and Figma keeps an auto-layout frame with no layer in it at its last height (PE4) where CSS draws the cell as tall as its padding, so no frame inside the cell takes the side padding, and padding on the cell moves the row's split (probe DL5)";

/**
 * A key no layer of a cell has, for the frame inside it: `inset`, or `inset-2` and on where a layer
 * of the cell is keyed `inset`, since a key is unique among its siblings.
 */
function freeKey(children: readonly { readonly key: string }[]): string {
  const taken = new Set(children.map((child) => child.key));
  let key = INSET;
  for (let suffix = 2; taken.has(key); suffix += 1) {
    key = `${INSET}-${String(suffix)}`;
  }
  return key;
}

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
  box: {
    readonly others: number;
    readonly instances: number;
    readonly outOfFlow: number;
    readonly sizing: SizingSpec;
  }
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
    box.instances > 0 ||
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
 * @param box - How many icons and labels sit in its flow beside its parts, how many of its parts are
 *   instance parts, how many sit out of its flow, its sizing and limits, and the sizing of the layers inside it, which the list's
 *   `display` decides as it stretches them.
 * @returns The box's layout, or undefined where it is neither shape.
 */
export function readSubgridFlow(
  reader: LayerStyle,
  parts: readonly LayerStyle[],
  box: {
    readonly others: number;
    readonly instances: number;
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

/** A side of a cell: the spec field its padding fills and the CSS property that sets it. */
const SIDES = [
  { field: "paddingLeft", property: "padding-left" },
  { field: "paddingRight", property: "padding-right" },
] as const;

/** Whether a length pads its side: a variable, or a literal other than 0. */
function pads(length: NumberSpec): boolean {
  return length.kind === "variable" || length.value !== 0;
}

/** The layer that draws a cell's side padding: the cell, or the frame inside it. */
type PaddingHolder = "cell" | "inset";

/** The kind and key of each layer, which tell apart the cell that pads itself and the cell whose frame pads. */
function kindsAndKeys(layers: readonly { readonly kind: string; readonly key: string }[]): string {
  return JSON.stringify(layers.map((layer) => [layer.kind, layer.key]));
}

/** The layer at a key path below a root, undefined where no frame holds it. */
function layerAt(root: BoxSpec, path: readonly string[]): BoxSpec | undefined {
  let box: BoxSpec | undefined = root;
  for (const key of path) {
    const child: ChildLayerSpec | undefined = box?.children.find((layer) => layer.key === key);
    box = child?.kind === "frame" ? child : undefined;
  }
  return box;
}

/**
 * Draw a cell of an Item's row: the first fills the row up to its column's cap, which no class of its
 * own sets, and a cell that pads a side draws that padding on a frame inside it.
 *
 * Figma takes each FILL layer's side padding out of the row's free space before it splits the rest,
 * and each layer gets its share plus its own padding, where CSS splits the columns themselves. Probe
 * DL5 (a scratch file, 2026-11-20): in a gapless row of two FILL frames, the first capped at 320,
 * padding the first frame's right by 8px drew it 204, 292 and 320 wide in rows 400, 576 and 800 wide,
 * and 206 and 294 below the cap at 12px, where Chromium draws Description list's term 200 and 288.
 * Padding both frames alike drew 200, 288 and 320, as DL4 did, and so did an unpadded first frame
 * whose inner FILL frame took the padding. So the row's layers carry no side padding:
 * the cell keeps its key, its sizing, its cap, its padding above and below and what it
 * paints, and a FILL frame keyed `inset` takes its side padding and lays out its layers. The frame
 * takes another key where a layer of the cell has that one, since a key is unique among siblings. Padding the
 * other cell to match would also split the row alike, but narrow its text below Chromium's. A layer
 * out of the cell's layout stays on the cell, which still has the cell's border box, before or after
 * the frame as it came before or after the layers the frame takes, so the cell paints them in the
 * order it did. The frame alone paints its first layer on top where the cell did, since the cell
 * becomes a row, where Figma draws that only in a column (PZ2). The cell then lists its layers in
 * the order it paints them, back to front. A cell whose layers in its layout sit on both sides of
 * one out of it keeps its padding, and each side it pads stays unmapped, since no one frame keeps
 * that order. So does a cell with no layer in its layout: a frame inside it would hold nothing, and
 * Figma keeps an auto-layout frame with no layer in it at its last height (PE4), where CSS draws the
 * cell as tall as its padding.
 *
 * A cell of an instance part, built in place, keeps the layers its main draws, since an instance keeps
 * its main's layers, and the diff compares no layer of a box whose layers differ, so the instance
 * would lose its TEXT values and overrides inside the cell. Where the cell's own side padding would
 * add the frame or remove it, the cell draws the main's layers with its own padding, and the instance
 * diff leaves each side whose padding differs from the main's unmapped. The side
 * padding decides whether the frame exists, so it fills the cell's `layers` too, and the frame's
 * fields move with the reads that fill them, so an instance part's coverage tells what it carries.
 *
 * @param style - The cell's style.
 * @param box - The cell as mapped.
 * @param cell - The cell's place in the row, as {@link subgridCellRoom} gives it.
 * @param main - The root of the inner set's variant where the cell is built in place, which holds
 *   the main's cell at the cell's key path; undefined for a set's own cells.
 * @returns The cell's box.
 */
export function drawSubgridCell(
  style: LayerStyle,
  box: BoxSpec,
  cell: SubgridCell,
  main: BoxSpec | undefined
): BoxSpec {
  const capped =
    cell.maximumWidth === undefined
      ? box
      : { ...box, limits: { ...box.limits, maxWidth: cell.maximumWidth } };
  const { path } = style;
  const own = (feed: FeedTarget): boolean =>
    feed.path.length === path.length && path.every((key, index) => feed.path[index] === key);
  // Whether the cell draws the frame follows its side padding, so that padding fills its `layers`.
  const decides = (feed: FeedTarget): readonly FeedTarget[] =>
    own(feed) && SIDE_PADDING.has(feed.field) ? [{ path, field: "layers" }] : [];
  const inFlow = capped.children.flatMap((child, index) => (outOfLayout(child) ? [] : [index]));
  const first = inFlow[0] ?? 0;
  const last = inFlow.at(-1) ?? -1;
  const before = capped.children.slice(0, first);
  const held = capped.children.slice(first, last + 1);
  const after = capped.children.slice(last + 1);
  const refused = inFlow.length === 0 ? NOTHING_IN_FLOW : held.some(outOfLayout) ? INTERLEAVED : undefined;
  const insetKey = freeKey(capped.children);
  const { firstOnTop, ...rest } = capped;
  // A cell that paints its first layer on top lists its layers front to back. It becomes a row with
  // no first layer on top, so it lists the layers beside the frame back to front, and the frame
  // keeps the cell's order and its first layer on top.
  const around = <Layer extends { readonly kind: string; readonly key: string }>(frame: Layer) =>
    firstOnTop === true
      ? [...[...after].reverse(), frame, ...[...before].reverse()]
      : [...before, frame, ...after];
  const ownHolder: PaddingHolder =
    refused === undefined && SIDES.some(({ field }) => pads(capped[field])) ? "inset" : "cell";
  const mainCell = main === undefined ? undefined : layerAt(main, path);
  const mainKeys = mainCell === undefined ? undefined : kindsAndKeys(mainCell.children);
  const mainHolder: PaddingHolder | undefined =
    mainKeys === kindsAndKeys(around({ kind: "frame", key: insetKey }))
      ? "inset"
      : mainKeys === kindsAndKeys(capped.children)
        ? "cell"
        : undefined;
  const holder: PaddingHolder = refused === undefined ? (mainHolder ?? ownHolder) : "cell";
  if (holder === "cell") {
    style.moveFeeds((feed) => [feed, ...decides(feed)]);
    if (refused !== undefined) {
      for (const { field, property } of SIDES) {
        if (pads(capped[field])) {
          style.read(
            property,
            (value) => value,
            () => ({ outcome: "unmapped", detail: refused }),
            []
          );
        }
      }
    }
    return capped;
  }
  style.moveFeeds((feed) => {
    const within = path.every((key, index) => feed.path[index] === key);
    const moves = own(feed)
      ? INSET_FIELDS.has(feed.field)
      : !capped.children.some((child) => child.key === feed.path[path.length] && outOfLayout(child));
    const moved =
      within && moves ? { ...feed, path: [...path, insetKey, ...feed.path.slice(path.length)] } : feed;
    return [moved, ...decides(feed)];
  });
  const frame: FrameLayerSpec = {
    kind: "frame",
    key: insetKey,
    name: insetKey,
    direction: capped.direction,
    sizing: {
      horizontal: { kind: "fill" },
      vertical: capped.sizing.vertical.kind === "hug" ? { kind: "hug" } : { kind: "fill" },
    },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: capped.paddingRight,
    paddingBottom: ZERO,
    paddingLeft: capped.paddingLeft,
    itemSpacing: capped.itemSpacing,
    primaryAlign: capped.primaryAlign,
    counterAlign: capped.counterAlign,
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: held,
  };
  return {
    ...rest,
    direction: "HORIZONTAL",
    paddingLeft: ZERO,
    paddingRight: ZERO,
    itemSpacing: ZERO,
    primaryAlign: "MIN",
    counterAlign: "MIN",
    children: around<ChildLayerSpec>(firstOnTop === true ? { ...frame, firstOnTop } : frame),
  };
}

/**
 * The room an Item's row gives a cell: each fills the row's width, the first up to its cap, and hugs
 * its height from the row's top. {@link drawSubgridCell} draws the cell in it.
 *
 * @param row - The Item's row, as {@link readSubgridFlow} read it.
 * @param index - The cell's place in the row.
 * @returns The cell's room.
 */
export function subgridCellRoom(row: Extract<SubgridLayout, { readonly kind: "item" }>, index: number): Room {
  return {
    horizontal: { percent: { kind: "none" }, auto: { kind: "fill" }, siblings: [], length: undefined },
    vertical: { percent: { kind: "none" }, auto: { kind: "hug" }, siblings: [], length: undefined },
    widthCap: { kind: "unread" },
    unbounded: false,
    subgridCell: { maximumWidth: index === 0 ? row.firstMaximum : undefined },
  };
}
