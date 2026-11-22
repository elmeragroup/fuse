/**
 * The renderers of the Toggle group sets, each cell the real Fuse `<ToggleGroup.Root>` at the cell's
 * variant and size.
 *
 * - A `toggle-group` cell is the docs Multiple demo, `<ToggleGroup.Root multiple
 *   defaultValue={["bold"]}>` holding the Bold, Italic and Underline items, at the default spacing,
 *   which the root writes as `--gap` in its inline style.
 * - A `segmented-toggle-group` cell is the docs Segmented demos, `<ToggleGroup.Root
 *   defaultValue={["week"]} spacing={0}>` holding the Day, Week and Month items.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { ToggleGroup } from "../../../fuse/dist/toggle-group.js";
import type { Cell } from "../components/component-spec.ts";
import { SEGMENTED_TOGGLE_GROUP_ITEMS, TOGGLE_GROUP_ITEMS } from "../components/toggle-group-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

type RootProps = ComponentProps<typeof ToggleGroup.Root>;

/** The cell's variant and size, as the root's props, which leave the recipe's defaults unset. */
function looks(cell: Cell): Pick<RootProps, "variant" | "size"> {
  const props: Pick<RootProps, "variant" | "size"> = {};
  if (cell.variant === "outline") {
    props.variant = "outline";
  }
  if (cell.size === "xs" || cell.size === "sm" || cell.size === "lg") {
    props.size = cell.size;
  }
  return props;
}

/** The items of a sample, each `<ToggleGroup.Item value>label</ToggleGroup.Item>`. */
function items(entries: readonly { readonly key: string; readonly label: string }[]) {
  return entries.map((item) =>
    createElement(ToggleGroup.Item, { key: item.key, value: item.key, children: item.label })
  );
}

/** A `toggle-group` cell: the Multiple demo's group at one variant and size. */
export const toggleGroup: CellRendering = {
  element: (cell: Cell) =>
    createElement(ToggleGroup.Root, {
      multiple: true,
      defaultValue: TOGGLE_GROUP_ITEMS.filter((item) => item.pressed).map((item) => item.key),
      "aria-label": "Text style",
      ...looks(cell),
      children: items(TOGGLE_GROUP_ITEMS),
    }),
};

/** A `segmented-toggle-group` cell: the Segmented demos' group at one variant and size. */
export const segmentedToggleGroup: CellRendering = {
  element: (cell: Cell) =>
    createElement(ToggleGroup.Root, {
      defaultValue: SEGMENTED_TOGGLE_GROUP_ITEMS.filter((item) => item.pressed).map((item) => item.key),
      "aria-label": "Period",
      spacing: 0,
      ...looks(cell),
      children: items(SEGMENTED_TOGGLE_GROUP_ITEMS),
    }),
};
