/**
 * The renderer of the `toggle-group` set: each cell as the docs Multiple demo, the real Fuse
 * `<ToggleGroup.Root multiple defaultValue={["bold"]}>` at the cell's variant and size, holding the
 * Bold, Italic and Underline items, at the default spacing, which the root writes as `--gap` in its
 * inline style.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { ToggleGroup } from "../../../fuse/dist/toggle-group.js";
import type { Cell } from "../components/component-spec.ts";
import { TOGGLE_GROUP_ITEMS } from "../components/toggle-group-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

type RootProps = ComponentProps<typeof ToggleGroup.Root>;

/** A `toggle-group` cell: the Multiple demo's group at one variant and size. */
export const toggleGroup: CellRendering = {
  element: (cell: Cell) => {
    const props: RootProps = {
      multiple: true,
      defaultValue: TOGGLE_GROUP_ITEMS.filter((item) => item.pressed).map((item) => item.key),
      "aria-label": "Text style",
      children: TOGGLE_GROUP_ITEMS.map((item) =>
        createElement(ToggleGroup.Item, { key: item.key, value: item.key, children: item.label })
      ),
    };
    if (cell.variant === "outline") {
      props.variant = "outline";
    }
    if (cell.size === "xs" || cell.size === "sm" || cell.size === "lg") {
      props.size = cell.size;
    }
    return createElement(ToggleGroup.Root, props);
  },
};
