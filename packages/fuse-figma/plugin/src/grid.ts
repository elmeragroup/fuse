/**
 * A box whose direction is GRID: Figma's grid auto layout, as the typings' `GridLayoutMixin` and
 * `GridChildrenMixin` describe it and probe PG showed on a scratch file on 2026-11-18. The box takes
 * its placement, tracks, one `GridTrackSize` each, and gaps, which bind a variable as `gridRowGap`
 * and `gridColumnGap` do and follow its mode (PG6), right after its direction: a frame that turns
 * into a grid takes 2 FLEX columns and rows, leaves its layers in no cell under the default MANUAL
 * placement and fixes its sizing (PG7), so `planBox` writes the box's sizing after these. It places
 * its layers `ROW_AUTO_FLOW`, which the typings define as CSS's `grid-auto-flow: row`: each layer
 * takes the next free cell row by row in layer order, as PG1 and PG7 showed, and an `insertChild`
 * reorder reflows them, so the layer order the plugin keeps puts each layer in the cell the spec
 * names, which the kit check holds row by row in that order. That spares the plugin
 * `setGridChildPosition`, which the typings say throws for a cell another layer takes. The rows stay
 * at the spec's count under the default `gridAutoTracks` NONE. Each layer sits at its cell's start
 * where it does not fill it: AUTO does so (PG4), and the plugin writes MIN, which the typings name.
 * The fake models these as rule 61 in `fake/grid.ts`.
 */
import type { GridSpec, GridTrackSpec } from "../../src/components/kit-spec.ts";
import type { LayerParent } from "./box.ts";
import { near, planNumber } from "./fields.ts";
import type { Run } from "./fields.ts";
import { change } from "./plan.ts";
import type { Target } from "./plan.ts";

/** Whether a layer is one a grid holds in a cell: a frame, an instance or a text. */
function inCells(node: SceneNode): node is SceneNode & GridChildrenMixin {
  return "gridChildHorizontalAlign" in node;
}

/** A spec track as Figma's `GridTrackSize`. */
function trackSize(track: GridTrackSpec): GridTrackSize {
  switch (track.kind) {
    case "fixed":
      return { type: "FIXED", value: track.length };
    case "flex":
      return { type: "FLEX", value: track.share };
    case "hug":
      return { type: "HUG" };
  }
}

/** Whether a node's tracks are the spec's, type by type and length by length. */
function holdsTracks(held: readonly GridTrackSize[], desired: readonly GridTrackSize[]): boolean {
  return (
    held.length === desired.length &&
    held.every((size, index) => {
      const wanted = desired[index];
      return (
        wanted !== undefined &&
        size.type === wanted.type &&
        (wanted.type === "HUG" || near(size.value ?? Number.NaN, wanted.value ?? Number.NaN))
      );
    })
  );
}

/** How a change line names some tracks. */
function describeTracks(sizes: readonly GridTrackSize[]): string {
  return sizes.map((size) => (size.type === "HUG" ? "HUG" : `${size.type} ${size.value ?? ""}`)).join(", ");
}

/**
 * Plan a grid's placement, tracks and gaps, after its direction and sizing: the counts first, since a
 * track list holds one size a track, then the sizes and the gaps. A box that lays out otherwise plans
 * none.
 *
 * @param run - The run.
 * @param node - The box.
 * @param label - The box's label, for change lines.
 * @param grid - The box's grid, or undefined for none.
 */
export function planGridTracks(run: Run, node: LayerParent, label: string, grid: GridSpec | undefined): void {
  if (grid === undefined) {
    return;
  }
  // A box that turns into a grid in this run holds no grid fields to compare until the turn runs.
  const held = node.layoutMode === "GRID";
  const scalar = <Value extends string | number>(
    name: string,
    read: () => Value,
    desired: Value,
    write: () => void
  ) => {
    if (!held || read() !== desired) {
      change(run.plan, label, `${name} → ${String(desired)}`, write);
    }
  };
  scalar(
    "gridItemsPositioning",
    () => node.gridItemsPositioning,
    "ROW_AUTO_FLOW",
    () => {
      node.gridItemsPositioning = "ROW_AUTO_FLOW";
    }
  );
  scalar(
    "gridColumnCount",
    () => node.gridColumnCount,
    grid.columns.length,
    () => {
      node.gridColumnCount = grid.columns.length;
    }
  );
  scalar(
    "gridRowCount",
    () => node.gridRowCount,
    grid.rows.length,
    () => {
      node.gridRowCount = grid.rows.length;
    }
  );
  for (const [name, tracks] of [
    ["gridColumnSizes", grid.columns],
    ["gridRowSizes", grid.rows],
  ] as const) {
    const desired = tracks.map(trackSize);
    if (!held || !holdsTracks(node[name], desired)) {
      change(run.plan, label, `${name} → ${describeTracks(desired)}`, () => {
        node[name] = desired;
      });
    }
  }
  for (const [name, gap] of [
    ["gridColumnGap", grid.columnGap],
    ["gridRowGap", grid.rowGap],
  ] as const) {
    planNumber(
      run,
      node,
      label,
      {
        name,
        bindings: [name],
        matches: (value) => near(node[name], value),
        write: (value) => {
          node[name] = value;
        },
      },
      gap,
      held ? "read" : "unknown"
    );
  }
}

/**
 * Plan each layer of a grid at its cell's start, once the layers are planned.
 *
 * @param run - The run.
 * @param label - The box's label, for change lines.
 * @param grid - The box's grid, or undefined for none.
 * @param held - Whether the box is a grid as the plan reads it, so its layers hold cells to compare.
 * @param planned - The box's layers, each with its key and its node.
 */
export function planGridItems(
  run: Run,
  label: string,
  grid: GridSpec | undefined,
  held: boolean,
  planned: readonly {
    readonly spec: { readonly key: string; readonly name: string };
    readonly node: Target<SceneNode>;
  }[]
): void {
  for (const cell of grid?.cells ?? []) {
    const layer = planned.find(({ spec }) => spec.key === cell.key);
    if (layer === undefined) {
      continue;
    }
    const at = `${label} / ${layer.spec.name}`;
    const found = held ? layer.node.existing : undefined;
    const item = found !== undefined && inCells(found) ? found : undefined;
    for (const name of ["gridChildHorizontalAlign", "gridChildVerticalAlign"] as const) {
      if (item?.[name] !== "MIN") {
        change(run.plan, at, `${name} → MIN`, () => {
          const node = layer.node.get();
          if (!inCells(node)) {
            throw new Error(`${at} is no layer a grid holds in a cell.`);
          }
          node[name] = "MIN";
        });
      }
    }
  }
}
