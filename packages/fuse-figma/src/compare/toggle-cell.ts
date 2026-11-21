/**
 * The renderer of the `toggle` and `icon-toggle` sets: each cell as the real Fuse `<Toggle>`.
 *
 * - `pressed=true` sets `defaultPressed`, and `disabled` sets `disabled`. The page renders static
 *   HTML, so the state the markup draws is the one the props start with.
 * - `icon=start` places `<Star data-icon="inline-start" />` before the label, and `icon=end`
 *   places `<Star data-icon="inline-end" />` after it, the icons the kit's swap properties
 *   default to.
 * - An icon toggle holds `<Star data-icon="inline-start" />` alone, as the docs place it, and is
 *   named by `aria-label`.
 * - A `segment` other than `none` renders the toggle as `<ToggleGroup.Item>` in a
 *   `<ToggleGroup.Root spacing={0}>` of the cell's variant and size. A hidden `<div>` before the
 *   item makes it no first child, and one after it no last child, so the item rounds the corners
 *   its place in the group rounds, while the capture finds it as the group's one item.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Star } from "../../../fuse/dist/icons.js";
import { ToggleGroup } from "../../../fuse/dist/toggle-group.js";
import { Toggle, toggleVariants } from "../../../fuse/dist/toggle.js";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import { TOGGLE_LABEL } from "../components/toggle-kit.ts";
import { markedIcon } from "./cell-renderers.ts";
import type { CellRendering } from "./cell-renderers.ts";

type ToggleVariant = keyof typeof toggleVariants.variants.variant;
type ToggleSize = keyof typeof toggleVariants.variants.size;

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
    defaultPressed: cell.pressed === "true",
    disabled: cell.state === "disabled",
  };
}

function labelChildren(icon: string | undefined): readonly (ReactElement | string)[] {
  switch (icon) {
    case "start":
      return [markedIcon(Star, "inline-start"), TOGGLE_LABEL];
    case "end":
      return [TOGGLE_LABEL, markedIcon(Star, "inline-end")];
    default:
      return [TOGGLE_LABEL];
  }
}

/** The value of the one item a segmented cell renders. */
const SEGMENT_VALUE = "item";

/** A hidden sibling, which keeps the item from being its group's first or last child. */
function hiddenSibling(key: string): ReactElement {
  return createElement("div", { key, hidden: true });
}

/** A segmented cell: the toggle as the one visible item of a `spacing={0}` group, at its place. */
function segmentedItem(cell: Cell, segment: string): ReactElement {
  const { variant, size, defaultPressed, disabled } = toggleProps(cell);
  const item = createElement(
    ToggleGroup.Item,
    { key: SEGMENT_VALUE, value: SEGMENT_VALUE, disabled },
    ...labelChildren(cell.icon)
  );
  const before = segment === "first" ? [] : [hiddenSibling("before")];
  const after = segment === "last" ? [] : [hiddenSibling("after")];
  return createElement(
    ToggleGroup.Root,
    {
      "aria-label": TOGGLE_LABEL,
      spacing: 0,
      variant,
      size,
      defaultValue: defaultPressed ? [SEGMENT_VALUE] : [],
    },
    ...before,
    item,
    ...after
  );
}

/**
 * A `toggle` cell: a Toggle with a label, and the icon its `icon` axis places, on its own or at
 * the place its `segment` axis gives it in a segmented group.
 */
export const labelToggle: CellRendering = {
  element: (cell) => {
    const segment = cell.segment ?? "none";
    return segment === "none"
      ? createElement(Toggle, toggleProps(cell), ...labelChildren(cell.icon))
      : segmentedItem(cell, segment);
  },
};

/** An `icon-toggle` cell: a Toggle around one icon. */
export const iconToggle: CellRendering = {
  element: (cell) =>
    createElement(
      Toggle,
      { ...toggleProps(cell), "aria-label": TOGGLE_LABEL },
      markedIcon(Star, "inline-start")
    ),
};
