/**
 * A CSS grid of two or more columns as a Figma grid (`layoutMode` GRID), where the capture proves
 * each column draws alike for the sample text and for text a designer would realistically type into
 * the grid's TEXT properties. A grid of one column is a column, which `box-flow.ts` reads.
 *
 * Each column of `grid-template-columns` maps to one Figma track (the typings' `GridTrackSize`):
 *
 * - a literal length to a FIXED track of that length;
 * - `minmax(0, Nfr)` to a FLEX track of share N. CSS gives it no floor, and neither does Figma: on
 *   2026-11-18 a FLEX track of a 100px grid kept its 50px share under an 80px layer, a FILL text and
 *   a filling frame, which it squeezed to 50px (probe PG12), so the two draw alike for any content;
 * - `Nfr` to a FLEX track of share N only where the capture measured the column wider than its items'
 *   min-content width in every mode, by a clearance no platform's font moves (`gridHolds`): CSS floors
 *   `Nfr` at that min-content width (CSS Grid 1 §7.2.4), its longest word, where Figma's FLEX keeps
 *   its share. A realistic retyped label keeps its words short, so its floor stays below the share;
 *   a single word wider than the column is a known limit, which CSS would widen the column for and
 *   Figma breaks across lines;
 * - `auto` to a HUG track only where the capture measured the column following its widest item at
 *   max-content in every mode, its text one character longer included (`gridHugs`). A longer
 *   realistic label widens CSS's column and Figma's HUG track alike, each to its widest layer that
 *   does not fill it; a label so long that it meets the grid's other columns is a known limit.
 *
 * Any other column, a grid whose flexible columns hold a `0fr` share or shares that sum below 1, which
 * take only that fraction of the free space (§12.7.1) where no probe has shown what Figma's FLEX
 * tracks do, a grid whose width hugs beside a FLEX column, which the typings call invalid and
 * a real file drew at its old width (PG3), a grid of fixed or filling height, whose `auto` rows
 * stretch to its height (§11.8), and a grid that sets a limit on an axis it hugs, which CSS's tracks
 * stretch to and Figma's HUG tracks do not, leave the grid unmapped. Its rows are its implicit `auto`
 * rows, one per row of items, each a HUG track. Its items are its parts in flow, auto-placed in rows
 * in source order (§8.5), so a grid that sets rows, areas, auto columns or a flow other than `row`,
 * holds an icon or its own text as an anonymous item, or holds a part that places itself, as
 * `grid-column` or `order` does, stays unmapped. So does a grid holding a positioned part, which CSS
 * paints above the others and the box mapping orders so, since Figma places a grid's layers by their
 * order, and one holding an absolute part. Each item fills its cell on an axis its own and the grid's
 * alignment leave at `stretch` or `normal` with no length of its own there, and sits at its cell's
 * start where it aligns `start`, or keeps a length of its own, which a stretch leaves at the start
 * (CSS Box Alignment 3 §6.1); any other alignment leaves the grid unmapped. A grid frame aligns MIN
 * on both axes, the one value Figma takes on a grid (PG10), and places each item by its cell.
 *
 * Probes PG1 to PG12, which the owner ran through the Plugin API on a scratch file on 2026-11-18,
 * showed how a GRID frame hugs its tracks, places and fills its cells and aligns them, and the fake
 * models them as its rule 61.
 */
import type { Room, WidthCap } from "./box-sizing";
import type { BoxDefinition, InstanceDefinition } from "./component-spec";
import {
  describeNumber,
  evaluateLength,
  evaluateNumber,
  normalizeCss,
  readNumber,
  splitTopLevel,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import { outOfLayout, ZERO } from "./kit-spec";
import type {
  ChildLayerSpec,
  GridCellSpec,
  GridSpec,
  GridTrackSpec,
  LimitsSpec,
  NumberSpec,
  SizingSpec,
} from "./kit-spec";
import type { CoverageNote, LayerStyle } from "./layer-style";

/** How an item sits in its cell on one axis: filling it, or at its start at its own length. */
export type CellFit = "fill" | "start";

/** A grid as planned: its tracks, and each item's cell and fit, by the item's key. */
export type GridPlan = {
  readonly columns: readonly GridTrackSpec[];
  readonly rows: readonly GridTrackSpec[];
  readonly cells: readonly FittedCell[];
};

/**
 * An item of a grid, as the reader needs it: its key, its style, and whether it holds text a TEXT
 * property sets, whose length the sample text does not bound.
 */
type GridItem = { readonly key: string; readonly style: LayerStyle; readonly editable: boolean };

/** Why a grid whose flexible columns share out less than all of its free space stays unmapped. */
const FRACTIONAL_SHARES =
  "flexible columns whose shares sum below 1, or hold a 0fr share, take only that fraction of the free space (CSS Grid 1 §12.7.1), and no probe has shown how Figma's FLEX tracks share them";

/** The grid properties a mapped grid leaves at their initial values. */
const UNSET_GRID = [
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-columns",
  "grid-auto-rows",
] as const;

/** The item properties that place an item away from auto-placement. */
const PLACES_ITSELF = [
  "grid-area",
  "grid-column",
  "grid-column-start",
  "grid-column-end",
  "grid-row",
  "grid-row-start",
  "grid-row-end",
  "order",
] as const;

/**
 * One column of `grid-template-columns` as a Figma track, where the capture proves it, as the module
 * says.
 *
 * @param token - The column's track.
 * @param column - The column's place.
 * @param measured - What the capture measured of the grid's columns.
 * @returns The track, or undefined where it does not draw alike.
 */
function track(
  token: string,
  column: number,
  measured: Pick<GridMeasure, "hugs" | "holds">
): GridTrackSpec | undefined {
  const value = normalizeCss(token);
  if (value === "auto") {
    return measured.hugs.includes(column) ? { kind: "hug" } : undefined;
  }
  const floorless = /^minmax\(0(?:px)?,\s*(\d+(?:\.\d+)?)fr\)$/.exec(value)?.[1];
  const floored = /^(\d+(?:\.\d+)?)fr$/.exec(value)?.[1];
  if (floorless !== undefined) {
    const share = evaluateNumber(floorless);
    return share === undefined ? undefined : { kind: "flex", share };
  }
  if (floored !== undefined) {
    const share = evaluateNumber(floored);
    return share === undefined || !measured.holds.includes(column) ? undefined : { kind: "flex", share };
  }
  const length = evaluateLength(value);
  return length === undefined || length < 0 ? undefined : { kind: "fixed", length };
}

/**
 * Whether a part holds text a TEXT property sets, its own or a part's below it, or an instance part's
 * inner component's, which a designer can retype, so the sample text bounds none of its lengths.
 *
 * @param part - The part's definition.
 * @returns True where it holds such text.
 */
export function holdsEditableText(part: BoxDefinition | InstanceDefinition): boolean {
  if ("kind" in part) {
    return holdsEditableText(part.of);
  }
  const own =
    part.label !== undefined && "textProperty" in part.label && part.label.textProperty !== undefined;
  return own || (part.parts ?? []).some(holdsEditableText);
}

/** What the capture measured of a grid's tracks in every mode, as `capture/grid-facts.ts` reads it. */
export type GridMeasure = {
  /** The columns as wide as their widest item at max-content. */
  readonly hugs: readonly number[];
  /** The columns wider than their items at min-content by a clearance. */
  readonly holds: readonly number[];
  /**
   * Each column's item longer than every other in it by a clearance, by its place among the items,
   * or -1.
   */
  readonly widest: readonly number[];
  /** Each row's item taller than every other in it by a clearance, or -1. */
  readonly tallest: readonly number[];
  /** How many items the grid lays out, or undefined where the capture did not measure them. */
  readonly items: number | undefined;
  /** Each part in the grid's flow's place among those items, in flow order, or undefined. */
  readonly places: readonly (number | undefined)[];
};

/** A cell as the plan fits its item, before a HUG track settles which items may fill it. */
type FittedCell = GridCellSpec & { readonly horizontal: CellFit; readonly vertical: CellFit };

/**
 * Settle the fits in a HUG track. Figma sizes a HUG track from its layers that do not fill it, so a
 * filling layer never widens it (probe PG2, 2026-11-18), where CSS's `auto` track is as long as its
 * longest item, stretched or not (CSS Grid 1 §11.5). They draw alike where the track's longest item
 * does not fill it: that item draws at its own length, which is the track's, as its stretch would,
 * and every other item fills the track it sets. The longest item is the track's only item, which
 * sets it whatever its text, or the one the capture measured longer than every other item in the
 * track by a clearance in every mode, where no item in the track holds text a TEXT property sets,
 * since a longer realistic label in a filling item widens CSS's track and never Figma's. A track whose items fill with no such
 * item leaves the grid unmapped.
 *
 * @param cells - The fitted cells.
 * @param axis - The axis the track sizes.
 * @param inTrack - Which cells sit in the track.
 * @param longest - The track's longest item, by its place among the cells, or -1.
 * @param editable - Which cells hold text a TEXT property sets, by their place.
 * @returns The cells with the longest item at its own length, or undefined.
 */
function settleHugTrack(
  cells: readonly FittedCell[],
  axis: "horizontal" | "vertical",
  inTrack: (cell: FittedCell) => boolean,
  longest: number | undefined,
  editable: readonly boolean[]
): readonly FittedCell[] | undefined {
  if (!cells.some((cell) => inTrack(cell) && cell[axis] === "fill")) {
    return cells;
  }
  const members = cells.flatMap((cell, index) => (inTrack(cell) ? [index] : []));
  const [sole] = members;
  const measured = members.every((index) => editable[index] !== true) ? longest : undefined;
  const setter = members.length === 1 ? sole : measured;
  if (setter === undefined || setter < 0 || !members.includes(setter)) {
    return undefined;
  }
  return cells.map((cell, index) => (index === setter ? { ...cell, [axis]: "start" } : cell));
}

/** How an item fits its cell on one axis, or undefined for an alignment the reader does not map. */
function fit(
  item: LayerStyle,
  grid: LayerStyle,
  self: string,
  items: string,
  length: string
): CellFit | undefined {
  const own = normalizeCss(item.resolved(self) ?? "auto");
  const align = own === "auto" ? normalizeCss(grid.resolved(items) ?? "normal") : own;
  if (["start", "flex-start", "self-start"].includes(align)) {
    return "start";
  }
  if (!["normal", "stretch"].includes(align)) {
    return undefined;
  }
  // A stretch takes only an item whose length is auto; one of its own length sits at the start.
  return ["", "auto"].includes(normalizeCss(item.resolved(length) ?? "auto")) ? "fill" : "start";
}

/**
 * Plan a grid of two or more columns, reading nothing. A grid refused for its flexible columns'
 * shares notes why on its `grid-template-columns`.
 *
 * @param grid - The grid's style.
 * @param items - The parts in the grid's flow, in order.
 * @param others - How many icons and labels sit in the grid's flow beside its parts.
 * @param box - The grid's sizing, what the capture measured of its tracks, and how many of its parts
 *   sit out of its flow.
 * @returns The plan, or undefined where the grid does not draw as a Figma grid.
 */
export function planGrid(
  grid: LayerStyle,
  items: readonly GridItem[],
  others: number,
  box: {
    readonly sizing: SizingSpec;
    readonly limits: LimitsSpec;
    readonly measure: GridMeasure;
    readonly outOfFlow: number;
  }
): GridPlan | undefined {
  if (normalizeCss(grid.resolved("display") ?? "") !== "grid") {
    return undefined;
  }
  const tokens = splitTopLevel(normalizeCss(grid.resolved("grid-template-columns") ?? "none"), " ");
  const autoFlow = normalizeCss(grid.resolved("grid-auto-flow") ?? "row");
  const unset = UNSET_GRID.every(
    (property) =>
      !grid.has(property) || ["none", "auto"].includes(normalizeCss(grid.resolved(property) ?? ""))
  );
  // Figma places a grid's layers by their layer order, which a positioned item can change, as CSS
  // paints it on top, and no probe has shown where a grid puts an absolute layer.
  const placed = items.some(
    ({ style }) =>
      PLACES_ITSELF.some((property) => style.has(property)) ||
      normalizeCss(style.resolved("position") ?? "static") !== "static"
  );
  // The facts number the items the grid lays out, so they read only where the parts are those items.
  const measuredItems =
    box.measure.items === items.length && box.measure.places.every((place, index) => place === index);
  if (
    !measuredItems ||
    tokens.length < 2 ||
    items.length === 0 ||
    others > 0 ||
    box.outOfFlow > 0 ||
    autoFlow !== "row" ||
    !unset ||
    placed
  ) {
    return undefined;
  }
  const editable = items.map((item) => item.editable);
  const columns = tokens.map((token, column) => track(token, column, box.measure));
  // Flexible tracks whose shares sum below 1 take only that fraction of the free space (CSS Grid 1
  // §12.7.1), so two `0.25fr` columns of a 200px grid take 50px each, and a `0fr` track takes none.
  // No probe has shown how Figma's FLEX tracks share out such values.
  const shares = columns.flatMap((column) => (column?.kind === "flex" ? [column.share] : []));
  if (shares.length > 0 && (shares.includes(0) || shares.reduce((sum, share) => sum + share, 0) < 1)) {
    grid.mark("grid-template-columns", "unmapped", FRACTIONAL_SHARES, []);
    return undefined;
  }
  const hugsWidth = box.sizing.horizontal.kind === "hug";
  // CSS stretches a grid's `auto` tracks to a limit on an axis it hugs, and Figma's HUG tracks hug.
  const { minWidth, maxWidth, minHeight, maxHeight } = box.limits;
  const limited =
    minHeight !== undefined || maxHeight !== undefined || (hugsWidth && (minWidth ?? maxWidth) !== undefined);
  if (
    limited ||
    columns.some((column) => column === undefined || (column.kind === "flex" && hugsWidth)) ||
    box.sizing.vertical.kind !== "hug"
  ) {
    return undefined;
  }
  const cells = items.map(({ key, style }, index) => ({
    key,
    row: Math.floor(index / tokens.length),
    column: index % tokens.length,
    horizontal: fit(style, grid, "justify-self", "justify-items", "width"),
    vertical: fit(style, grid, "align-self", "align-items", "height"),
  }));
  const fits = cells.flatMap(({ horizontal, vertical, ...cell }) =>
    horizontal === undefined || vertical === undefined ? [] : [{ ...cell, horizontal, vertical }]
  );
  if (fits.length !== cells.length) {
    return undefined;
  }
  const rowCount = Math.ceil(items.length / tokens.length);
  // Every row is a HUG track, and so is each `auto` column.
  let settled: readonly FittedCell[] | undefined = fits;
  columns.forEach((column, index) => {
    if (settled !== undefined && column?.kind === "hug") {
      settled = settleHugTrack(
        settled,
        "horizontal",
        (cell) => cell.column === index,
        box.measure.widest[index],
        editable
      );
    }
  });
  for (let row = 0; row < rowCount && settled !== undefined; row += 1) {
    settled = settleHugTrack(
      settled,
      "vertical",
      (cell) => cell.row === row,
      box.measure.tallest[row],
      editable
    );
  }
  if (settled === undefined) {
    return undefined;
  }
  return {
    columns: columns.flatMap((column) => (column === undefined ? [] : [column])),
    rows: Array.from({ length: rowCount }, (): GridTrackSpec => ({ kind: "hug" })),
    cells: settled,
  };
}

/**
 * The room a Figma grid gives the item in one of its cells, as {@link planGrid} plans it. The item
 * fills its cell on an axis where it stretches there, and hugs where it sits at the cell's start. A
 * percentage resolves against the cell, a length the build does not read. The width that wraps its
 * text is its column's: a fixed column's length, none in a column the capture measured as wide as its
 * widest item at max-content, where nothing in it wraps and every item lays out at its max-content
 * width, and unread in a flexible one.
 *
 * @param grid - The grid's plan.
 * @param index - The item's place among the grid's items, which are all its layers.
 * @returns The item's room.
 */
export function cellRoom(grid: GridPlan, index: number): Room {
  const cell = grid.cells[index];
  const column = cell === undefined ? undefined : grid.columns[cell.column];
  if (cell === undefined || column === undefined) {
    throw new Error(`the grid plans no cell for its item ${index}`);
  }
  const axis = (fit: CellFit): Room["horizontal"] => ({
    percent: { kind: "none" },
    auto: { kind: fit === "fill" ? "fill" : "hug" },
    siblings: [],
    length: undefined,
  });
  return {
    horizontal: axis(cell.horizontal),
    vertical: axis(cell.vertical),
    widthCap: columnCap(column),
    unbounded: column.kind === "hug",
  };
}

/** The width that wraps the text of an item in a grid's column, as {@link cellRoom} says. */
function columnCap(column: GridTrackSpec): WidthCap {
  switch (column.kind) {
    case "fixed":
      return { kind: "pixels", value: column.length };
    case "hug":
      return { kind: "none" };
    case "flex":
      return { kind: "unread" };
  }
}

/**
 * A grid's cells keyed by the layers the box lays out in its flow, in order, which the cells number
 * row by row: a part the box draws inside a frame of its margins, or under a wrapper's key, is that
 * layer. Where the box lays out another number of layers, the cells stay as planned, and the kit
 * check stops the build.
 *
 * @param grid - The grid.
 * @param children - The box's layers.
 * @returns The grid, its cells keyed by the layers.
 */
export function keyedCells(grid: GridSpec, children: readonly ChildLayerSpec[]): GridSpec {
  const inFlow = children.filter((child) => !outOfLayout(child));
  if (inFlow.length !== grid.cells.length) {
    return grid;
  }
  return {
    ...grid,
    cells: grid.cells.map((cell, index) => ({ ...cell, key: inFlow[index]?.key ?? cell.key })),
  };
}

/** How the coverage table names a mapped grid's display. */
const GRID_DISPLAY = "a Figma grid (GRID auto layout), its items in their cells";

/** How the coverage table names a mapped grid's columns. */
const GRID_TEMPLATE = "the Figma grid's column tracks, each sized as the capture measured it";

/** How the coverage table names an alignment that decides how an item sits in its cell. */
const CELL_FIT = "how the item sits in its Figma grid cell: filling it, or at its start at its own length";

/** How the coverage table names an initial grid property a mapped grid leaves as it is. */
const AUTO_PLACED = "the Figma grid places its items in rows in source order, as CSS's auto-placement does";

/**
 * Read a grid `planGrid` planned: its display, columns, gaps and placement, and the alignments that
 * fit its items in their cells, each as the plan draws it, and give the box's grid.
 *
 * @param grid - The grid's style.
 * @param plan - The grid's plan.
 * @param items - The styles of the grid's items, in the plan's order.
 * @param variables - The synced variables, which a gap binds.
 * @returns The grid the box draws.
 */
export function readGrid(
  grid: LayerStyle,
  plan: GridPlan,
  items: readonly LayerStyle[],
  variables: VariableIndex
): GridSpec {
  const feed = grid.feed("grid");
  const literal = (detail: string) => (): CoverageNote => ({ outcome: "literal", detail });
  grid.read("display", (value) => value, literal(GRID_DISPLAY), [...grid.feed("direction"), ...feed]);
  grid.read("grid-template-columns", (value) => value, literal(GRID_TEMPLATE), feed);
  for (const property of ["grid-auto-flow", ...UNSET_GRID]) {
    grid.read(property, (value) => value, literal(AUTO_PLACED), feed);
  }
  for (const property of ["justify-items", "align-items"]) {
    grid.read(property, (value) => value, literal(CELL_FIT), feed);
  }
  // `flex-wrap` sets how a flex container breaks its lines, and sets nothing on a grid (CSS Flexbox 1
  // §5.2), as Item's `flex-wrap` does on Selection item's shell.
  grid.read(
    "flex-wrap",
    (value) => value,
    () => ({
      outcome: "dropped",
      detail: "flex-wrap applies only to flex containers, and the box is a grid",
    }),
    []
  );
  for (const item of items) {
    for (const property of ["justify-self", "align-self"]) {
      item.read(property, (value) => value, literal(CELL_FIT), item.feed("sizing"));
    }
  }
  const gap = (property: string): NumberSpec | undefined =>
    grid.read(property, (value) => readNumber(value, variables), describeNumber, feed);
  const both = gap("gap");
  return {
    columns: plan.columns,
    rows: plan.rows,
    columnGap: gap("column-gap") ?? both ?? ZERO,
    rowGap: gap("row-gap") ?? both ?? ZERO,
    cells: plan.cells.map(({ key, row, column }) => ({ key, row, column })),
  };
}
