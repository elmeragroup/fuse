/**
 * Toggle group, spaced, as one component set on the Toggle page: the docs Multiple demo's row of
 * three toggles at every variant and size of the recipe, 8 cells. The root is `ToggleGroup.Root`'s
 * `<div role="group" data-slot="toggle-group">`.
 *
 * - Each item is a `Toggle` instance of the group's variant and size with the Multiple demo's label,
 *   `Bold` pressed, `Italic` and `Underline` not, which the `Label` text property sets.
 *   `ToggleGroup.Item` renders the Toggle under the `toggle-group-item` slot.
 * - The segmented look, `spacing={0}`, stays out. Its items change their padding and stroke weight,
 *   and Figma takes neither as an override of a nested Toggle instance.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";
import { TOGGLE_MANIFEST } from "./toggle-kit";

/** The group's items: the docs Multiple demo's labels, and whether each starts pressed. */
export const TOGGLE_GROUP_ITEMS = [
  { key: "bold", label: "Bold", pressed: true },
  { key: "italic", label: "Italic", pressed: false },
  { key: "underline", label: "Underline", pressed: false },
] as const;

/** An item's Toggle cell: the group's variant and size, at rest, pressed as the item starts, with no icon. */
function itemCell(entry: (typeof TOGGLE_GROUP_ITEMS)[number], outer: Cell): Cell {
  return {
    variant: outer.variant ?? "default",
    size: outer.size ?? "default",
    state: "rest",
    pressed: entry.pressed ? "on" : "off",
    icon: "none",
  };
}

/** One item, a `Toggle` of the group's variant and size, as `<ToggleGroup.Item value>label</ToggleGroup.Item>`. */
function itemManifest(entry: (typeof TOGGLE_GROUP_ITEMS)[number]): InstanceManifest {
  return {
    kind: "instance",
    key: entry.key,
    of: TOGGLE_MANIFEST,
    slot: "toggle-group-item",
    cell: (outer) => itemCell(entry, outer),
    properties: () => ({ text: { Label: entry.label } }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * The group's manifest, which the capture-backed build reads with `captures/toggle-group.json`: a
 * spaced toggle group, as the docs Multiple demo's `<ToggleGroup.Root multiple variant size>`.
 */
export const TOGGLE_GROUP_MANIFEST: SetManifest = {
  key: "toggle-group",
  name: "Toggle group",
  slot: "toggle-group",
  axes: TOGGLE_MANIFEST.axes.filter((axis) => axis.name === "variant" || axis.name === "size"),
  columnAxis: "size",
  label: undefined,
  iconsFor: () => [],
  parts: TOGGLE_GROUP_ITEMS.map(itemManifest),
  swapProperties: [],
};
