/**
 * The renderer of the `toggle` and `icon-toggle` sets: each cell as the real Fuse `<Toggle>`.
 *
 * - `pressed=on` sets `defaultPressed`, and `disabled` sets `disabled`. The page renders static
 *   HTML, so the state the markup draws is the one the props start with.
 * - `icon=start` places `<Star data-icon="inline-start" />` before the label, and `icon=end`
 *   places `<Star data-icon="inline-end" />` after it, the icons the kit's swap properties
 *   default to.
 * - An icon toggle holds `<Star data-icon="inline-start" />` alone, as the docs place it, and is
 *   named by `aria-label`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Star } from "../../../fuse/dist/icons.js";
import { Toggle, toggleVariants } from "../../../fuse/dist/toggle.js";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import { markedIcon } from "./cell-renderers.ts";
import type { CellRendering } from "./cell-renderers.ts";

type ToggleVariant = keyof typeof toggleVariants.variants.variant;
type ToggleSize = keyof typeof toggleVariants.variants.size;

/** The label every label cell shows, the kit's `Label` default. */
const CELL_LABEL = "Toggle";

function isVariant(value: string | undefined): value is ToggleVariant {
  return ownKey(toggleVariants.variants.variant, value);
}

function isSize(value: string | undefined): value is ToggleSize {
  return ownKey(toggleVariants.variants.size, value);
}

/** The recipe's variant and size, and the states the markup draws, for a parsed cell. */
function toggleProps(cell: Cell) {
  const { variant, size } = cell;
  if (!isVariant(variant) || !isSize(size)) {
    throw new Error(`Toggle has no variant ${variant ?? ""} or size ${size ?? ""}`);
  }
  return {
    variant,
    size,
    defaultPressed: cell.pressed === "on",
    disabled: cell.state === "disabled",
  };
}

function labelChildren(icon: string | undefined): readonly (ReactElement | string)[] {
  switch (icon) {
    case "start":
      return [markedIcon(Star, "inline-start"), CELL_LABEL];
    case "end":
      return [CELL_LABEL, markedIcon(Star, "inline-end")];
    default:
      return [CELL_LABEL];
  }
}

/** A `toggle` cell: a Toggle with a label, and the icon its `icon` axis places. */
export const labelToggle: CellRendering = {
  element: (cell) => createElement(Toggle, toggleProps(cell), ...labelChildren(cell.icon)),
};

/** An `icon-toggle` cell: a Toggle around one icon. */
export const iconToggle: CellRendering = {
  element: (cell) =>
    createElement(
      Toggle,
      { ...toggleProps(cell), "aria-label": CELL_LABEL },
      markedIcon(Star, "inline-start")
    ),
};
