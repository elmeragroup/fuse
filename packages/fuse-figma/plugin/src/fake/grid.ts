/**
 * A grid auto layout: a frame whose `layoutMode` is GRID, its tracks, and the cells its layers take.
 * `layout.ts` sizes the tracks and the layers that fill them.
 *
 * It models this rule, from the typings and from probes PG1 to PG12, which the owner ran through the
 * Plugin API on a scratch file on 2026-11-18 (`@figma/plugin-typings` 1.141.0):
 * 61. A grid holds as many rows and columns as `gridRowCount` and `gridColumnCount` say, a positive
 *    whole number each, and one `GridTrackSize` a track in `gridRowSizes` and `gridColumnSizes`. A
 *    HUG track reads back with `value` 1 (PG1). A count write keeps the tracks it keeps and adds FLEX
 *    1 tracks, the fake's own choice where neither names one. A size list of any other length throws.
 *    A FLEX track on an axis the grid hugs does not throw: the grid reads HUG there and keeps its
 *    length, its FLEX tracks sharing it (PG3). `gridRowGap` and `gridColumnGap` hold a number and
 *    bind a FLOAT variable, which a mode switch follows (PG6). Read on a frame that is no grid, the
 *    counts are 0 and the size lists empty (PG5); every other member throws outside a grid, or for a
 *    layer outside one. A frame that turns into a grid takes 2 FLEX columns and 2 FLEX rows, places
 *    its layers MANUAL and leaves them in no cell, anchors -1, and its sizing turns FIXED on both
 *    axes (PG7, in `setLayoutMode`). Under ROW_AUTO_FLOW a layer in the grid's flow takes the next
 *    cell row by row in layer order, as the typings say and PG1 and PG7 showed, and `insertChild`
 *    reorders reflow them (PG7). The fake models no MANUAL cell, so a layer of a MANUAL grid reads
 *    -1, and it models no row Figma adds past the grid's last cell, where a cell read throws, nor
 *    `gridAutoTracks` ROWS, whose write throws. `gridAutoTracks` reads NONE (PG1).
 *    `gridChildHorizontalAlign` and `gridChildVerticalAlign` read AUTO until written (PG1), and AUTO
 *    puts a smaller layer at its cell's start (PG4); CENTER and MAX place it in its cell's middle and
 *    at its end (PG10), which the fake stores and does not lay out. A grid frame's
 *    `primaryAxisAlignItems` and `counterAxisAlignItems` throw for anything but MIN, `must be 'MIN'
 *    when layoutMode is 'GRID'`; its `itemSpacing` takes and reads back a number that lays out nothing,
 *    and its padding insets its cells (PG10). A FILL layer in a FLEX column takes the column's share,
 *    160px of a 200px grid beside a 30px HUG column and a 10px gap, and follows a resize (PG9); a
 *    FLEX track has no content floor, so a layer longer than its share overflows it, a filling text
 *    breaks its words to fit and a filling frame shrinks to it, and the track keeps its share (PG12). A
 *    frame with no auto layout turns into a grid as an auto layout does, its layers keeping their old
 *    `x` and `y` until ROW_AUTO_FLOW places them (PG11). A grid's width is its primary axis in the fake
 *    (`primaryOn` in `layout.ts`), so its layers fill their cells' width by `layoutGrow` and their
 *    height by `layoutAlign`, a mapping the fake picks, since neither names one.
 */

import { f32, write } from "./state.ts";
import type { GridChildAlign, GridState, NodeState } from "./state.ts";
import { childrenOf } from "./tree.ts";

/** The cell a grid's layer takes: its row and column, from 0, or -1 for none. */
export type GridCell = { readonly row: number; readonly column: number };

/** A grid's tracks along an axis: its columns across, its rows down. */
type Tracks = "columnSizes" | "rowSizes";

/** No cell, as a layer Figma placed nowhere reads. */
const UNPLACED: GridCell = { row: -1, column: -1 };

/** A node's grid, which only a grid holds. */
function gridOf(state: NodeState, member: string): GridState {
  if (state.layoutMode !== "GRID") {
    throw new Error(
      `in ${member}: ${state.id} is no grid auto layout, its layoutMode is ${state.layoutMode}.`
    );
  }
  return state.grid;
}

/** A layer's grid parent, which a grid's layer has. */
function gridAround(state: NodeState, member: string): NodeState {
  const parent = state.parent;
  if (parent?.layoutMode !== "GRID") {
    throw new Error(`in ${member}: ${state.id} sits in no grid auto layout.`);
  }
  return parent;
}

/** A grid's tracks along an axis, none on a frame that is no grid (PG5). */
export function tracksOf(state: NodeState, tracks: Tracks): readonly GridTrackSize[] {
  return state.layoutMode === "GRID" ? state.grid[tracks] : [];
}

/** Write how many tracks a grid holds along an axis. */
export function setTrackCount(state: NodeState, tracks: Tracks, count: number): void {
  const member = tracks === "columnSizes" ? "gridColumnCount" : "gridRowCount";
  const grid = gridOf(state, member);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`in ${member}: a grid holds a positive whole number of tracks, not ${count}.`);
  }
  write(state, member);
  const kept = grid[tracks].slice(0, count);
  const added = Array.from({ length: count - kept.length }, (): GridTrackSize => ({
    type: "FLEX",
    value: 1,
  }));
  grid[tracks] = [...kept, ...added];
}

/** Write a grid's tracks along an axis. A HUG track keeps `value` 1 (PG1). */
export function setTrackSizes(state: NodeState, tracks: Tracks, sizes: readonly GridTrackSize[]): void {
  const member = tracks === "columnSizes" ? "gridColumnSizes" : "gridRowSizes";
  const grid = gridOf(state, member);
  if (sizes.length !== grid[tracks].length) {
    throw new Error(
      `in ${member}: the grid holds ${grid[tracks].length} tracks, and the list sizes ${sizes.length}.`
    );
  }
  write(state, member);
  grid[tracks] = sizes.map((size) => (size.type === "HUG" ? { type: "HUG", value: 1 } : { ...size }));
}

/** The grid a frame holds once it turns into one (PG7): 2 FLEX columns and rows, MANUAL. */
export function newGrid(previous: GridState): GridState {
  const flex = (): GridTrackSize => ({ type: "FLEX", value: 1 });
  return { ...previous, columnSizes: [flex(), flex()], rowSizes: [flex(), flex()], positioning: "MANUAL" };
}

/** A grid's gap between its tracks. */
export function gapOf(state: NodeState, gap: "columnGap" | "rowGap"): number {
  return gridOf(state, gap === "columnGap" ? "gridColumnGap" : "gridRowGap")[gap];
}

/** Write a grid's gap between its tracks. */
export function setGap(state: NodeState, gap: "columnGap" | "rowGap", value: number): void {
  const member = gap === "columnGap" ? "gridColumnGap" : "gridRowGap";
  const grid = gridOf(state, member);
  write(state, member);
  grid[gap] = f32(value);
}

/** How a grid places its layers. */
export function positioningOf(state: NodeState): GridState["positioning"] {
  return gridOf(state, "gridItemsPositioning").positioning;
}

/** Write how a grid places its layers. */
export function setPositioning(state: NodeState, value: GridState["positioning"]): void {
  const grid = gridOf(state, "gridItemsPositioning");
  write(state, "gridItemsPositioning");
  grid.positioning = value;
}

/** Whether a grid adds rows for its layers, which the fake models only as NONE. */
export function autoTracksOf(state: NodeState): "NONE" {
  gridOf(state, "gridAutoTracks");
  return "NONE";
}

/** Write whether a grid adds rows for its layers, NONE alone. */
export function setAutoTracks(state: NodeState, value: "NONE" | "ROWS"): void {
  gridOf(state, "gridAutoTracks");
  if (value !== "NONE") {
    throw new Error(`The fake Figma file does not model gridAutoTracks ${value}.`);
  }
  write(state, "gridAutoTracks");
}

/**
 * The cell a layer of a grid takes: row by row in layer order under ROW_AUTO_FLOW, and none under
 * MANUAL, where the fake places nothing. Undefined for a layer out of the grid's flow.
 */
export function placedCell(grid: NodeState, state: NodeState): GridCell | undefined {
  const flow = childrenOf(grid).filter((child) => child.layoutPositioning !== "ABSOLUTE");
  const index = flow.indexOf(state);
  if (index === -1) {
    return undefined;
  }
  if (grid.grid.positioning !== "ROW_AUTO_FLOW") {
    return UNPLACED;
  }
  const columns = grid.grid.columnSizes.length;
  if (index >= columns * grid.grid.rowSizes.length) {
    throw new Error(`The fake Figma file does not model the rows a grid adds for ${state.id}.`);
  }
  return { row: Math.floor(index / columns), column: index % columns };
}

/** The cell a grid's layer takes, as its anchor indices read it. */
export function cellOf(state: NodeState, member: string): GridCell {
  return placedCell(gridAround(state, member), state) ?? UNPLACED;
}

/** A frame's alignment, which a grid takes only as MIN (PG10). */
export function requireGridAlignment(state: NodeState, member: string, value: string): void {
  if (state.layoutMode === "GRID" && value !== "MIN") {
    throw new Error(`in set_${member}: ${member} must be 'MIN' when layoutMode is 'GRID'`);
  }
}

/** How a grid's layer sits in its cell on an axis. */
export function alignOf(state: NodeState, axis: "horizontal" | "vertical"): GridChildAlign {
  gridAround(state, axis === "horizontal" ? "gridChildHorizontalAlign" : "gridChildVerticalAlign");
  return state.gridAlign[axis];
}

/** Write how a grid's layer sits in its cell on an axis. */
export function setAlign(state: NodeState, axis: "horizontal" | "vertical", value: GridChildAlign): void {
  const member = axis === "horizontal" ? "gridChildHorizontalAlign" : "gridChildVerticalAlign";
  gridAround(state, member);
  write(state, member);
  state.gridAlign[axis] = value;
}
