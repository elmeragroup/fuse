/**
 * Toggle group, spaced, as one component set on the Toggle page: the docs Multiple demo's row of
 * three toggles at every variant and size of the recipe, 8 cells. The root is `ToggleGroup.Root`'s
 * `<div role="group" data-slot="toggle-group">` with the `root` slot of `toggleGroupVariants`.
 *
 * - The root lays its items in a hugging row, centred across. Its gap is `--spacing(var(--gap))`,
 *   and the root writes `--gap` from its `spacing`, 2 by default, in its inline `style`, so the items
 *   sit 8px apart.
 * - Each item is a `Toggle` instance of the group's variant and size with the Multiple demo's label,
 *   `Bold` pressed, `Italic` and `Underline` not, which the `Label` text property sets.
 *   `ToggleGroup.Item` renders the Toggle with the group's `item` classes before its own, under the
 *   `toggle-group-item` slot, and Base UI stamps `data-spacing`, `data-variant` and `data-size` on it.
 * - The segmented look, `spacing={0}`, stays out: its items take the icon inset in place of the label
 *   inset, square their inner corners and drop the left border of every outline item but the first,
 *   which an instance of the Toggle set cannot carry, since Figma takes none of a nested instance's
 *   padding or stroke weight as an override.
 */
import { toggleGroupVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition } from "./component-spec";
import { always } from "./popup-facts";
import { TOGGLE } from "./toggle-kit";

/** The group's items: the docs Multiple demo's labels, and whether each starts pressed. */
export const TOGGLE_GROUP_ITEMS = [
  { key: "bold", label: "Bold", pressed: true },
  { key: "italic", label: "Italic", pressed: false },
  { key: "underline", label: "Underline", pressed: false },
] as const;

/** The spacing ToggleGroup gives its items by default, in Tailwind spacing units. */
export const TOGGLE_GROUP_SPACING = 2;

/** Why the segmented group stays out of the set. */
const SEGMENTED =
  "the segmented group, `spacing={0}`, which the set leaves out: its items' inset padding and the outline items' `border-l-0` would be overrides of a nested Toggle instance's padding and stroke weight, which Figma does not take";

const slots = toggleGroupVariants();

/**
 * What the group's `item` classes read on an item that no Toggle cell shows, by the item's place
 * among the three. The group is horizontal, which the items read through the root's
 * `group/toggle-group` marker, and spaced, so no `group-data-[spacing=0]/toggle-group:` or
 * `data-[spacing=0]:` arm holds: the segmented look, which the set leaves out (see `SEGMENTED`). The
 * other variants those arms chain, the item's `data-variant` and its place first or last, each hold
 * where the markup says. `focus:z-10` raises a focused item over its neighbours, and no item is
 * focused.
 */
function itemFacts(index: number): ReadonlyMap<string, (cell: Cell) => boolean> {
  return new Map([
    ["group-data-horizontal/toggle-group", () => true],
    ["group-data-vertical/toggle-group", () => false],
    ["group-data-[spacing=0]/toggle-group", () => false],
    // Base UI stamps the group's spacing and variant on each item too.
    ["data-[spacing=0]", () => false],
    ["data-[variant=outline]", (cell: Cell) => cell.variant === "outline"],
    ["first", () => index === 0],
    ["last", () => index === TOGGLE_GROUP_ITEMS.length - 1],
    ["focus", () => false],
  ]);
}

/** One item, a `Toggle` of the group's variant and size, as `<ToggleGroup.Item value>label</ToggleGroup.Item>`. */
function item(entry: (typeof TOGGLE_GROUP_ITEMS)[number], index: number): InstanceDefinition {
  return {
    kind: "instance",
    key: entry.key,
    of: TOGGLE,
    slot: "toggle-group-item",
    cell: (outer: Cell) => ({
      variant: outer.variant ?? "default",
      size: outer.size ?? "default",
      state: "rest",
      pressed: entry.pressed ? "on" : "off",
      icon: "none",
    }),
    classesFor: () => slots.item(),
    facts: itemFacts(index),
    properties: () => ({ text: { Label: entry.label } }),
    shownIn: always,
    exposed: true,
  };
}

/** A spaced toggle group, as the docs Multiple demo's `<ToggleGroup.Root multiple variant size>`. */
export const TOGGLE_GROUP: ComponentDefinition = {
  key: "toggle-group",
  // CSS leaves the root unclipped, so a ring a layer draws at its edge shows past it (compare-real-1).
  rootOverflow: "visible",
  name: "Toggle group",
  slot: "toggle-group",
  axes: TOGGLE.axes.filter((axis) => axis.name === "variant" || axis.name === "size"),
  columnAxis: "size",
  classesFor: () => slots.root(),
  // ToggleGroup writes `--gap` from its `spacing` on the root.
  styleFor: () => [{ property: "--gap", value: String(TOGGLE_GROUP_SPACING) }],
  states: {},
  // Base UI stamps the group's orientation on its root as `data-orientation`, which its items read
  // through the root's `group/toggle-group` marker.
  facts: new Map([
    ["data-horizontal", () => true],
    ["data-vertical", () => false],
    ["group-data-horizontal/toggle-group", () => true],
    ["group-data-vertical/toggle-group", () => false],
    // ToggleGroup stamps its variant on the root as `data-variant`.
    ["data-[variant=outline]", (cell: Cell) => cell.variant === "outline"],
  ]),
  omittedStates: new Set(),
  omittedCompositions: new Map([
    ["data-[spacing=0]", SEGMENTED],
    ["group-data-[spacing=0]/toggle-group", SEGMENTED],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: TOGGLE_GROUP_ITEMS.map(item),
  swapProperties: [],
};
