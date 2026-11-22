/**
 * Toggle group, as two component sets on the Toggle page, each the root `ToggleGroup.Root`'s
 * `<div role="group" data-slot="toggle-group">` holding a row of three exposed `Toggle` instances
 * at every variant and size of the recipe, 8 cells each. `ToggleGroup.Item` renders the Toggle
 * under the `toggle-group-item` slot, and each item's `Label` text property sets its label.
 *
 * - `Toggle group` is the docs Multiple demo, spaced: `Bold` pressed, `Italic` and `Underline` not.
 * - `Segmented toggle group` is the docs Segmented demos, `spacing={0}`: `Week` pressed, `Day` and
 *   `Month` not. Each item picks the `Toggle` variant of its `segment`, the group's first, a middle
 *   or its last item, which supplies the item's icon-inset padding, its squared inner corners and,
 *   after the first, an outline item's 0 left-edge weight. The two looks are two sets because the
 *   segmented outline root casts the items' shadow, so its roots clip, and a spaced root that
 *   clipped would cut its outline items' shadows.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";
import { TOGGLE_MANIFEST } from "./toggle-kit";

/** An item of a group's sample: its value, its label, and whether it starts pressed. */
type GroupItem = { readonly key: string; readonly label: string; readonly pressed: boolean };

/** The spaced group's items: the docs Multiple demo's labels, and whether each starts pressed. */
export const TOGGLE_GROUP_ITEMS = [
  { key: "bold", label: "Bold", pressed: true },
  { key: "italic", label: "Italic", pressed: false },
  { key: "underline", label: "Underline", pressed: false },
] as const satisfies readonly GroupItem[];

/** The segmented group's items: the docs Segmented demos' labels, and whether each starts pressed. */
export const SEGMENTED_TOGGLE_GROUP_ITEMS = [
  { key: "day", label: "Day", pressed: false },
  { key: "week", label: "Week", pressed: true },
  { key: "month", label: "Month", pressed: false },
] as const satisfies readonly GroupItem[];

/** An item's place in a segmented group of the given length, as the Toggle set's `segment` axis names it. */
function segmentAt(index: number, length: number): string {
  if (index === 0) {
    return "first";
  }
  return index === length - 1 ? "last" : "middle";
}

/** An item's Toggle cell: the group's variant and size, at rest, pressed as the item starts, with no icon. */
function itemCell(entry: GroupItem, segment: string, outer: Cell): Cell {
  return {
    variant: outer.variant ?? "default",
    size: outer.size ?? "default",
    state: "rest",
    pressed: entry.pressed ? "true" : "false",
    icon: "none",
    segment,
  };
}

/** One item, a `Toggle` of the group's variant and size, as `<ToggleGroup.Item value>label</ToggleGroup.Item>`. */
function itemManifest(entry: GroupItem, segment: string): InstanceManifest {
  return {
    kind: "instance",
    key: entry.key,
    of: TOGGLE_MANIFEST,
    slot: "toggle-group-item",
    cell: (outer) => itemCell(entry, segment, outer),
    properties: () => ({ text: { Label: entry.label } }),
    shownIn: always,
    exposed: true,
  };
}

/** The group's axes: the Toggle's variant and size. */
const GROUP_AXES = TOGGLE_MANIFEST.axes.filter((axis) => axis.name === "variant" || axis.name === "size");

/**
 * The group's manifest, which the capture-backed build reads with `captures/toggle-group.json`: a
 * spaced toggle group, as the docs Multiple demo's `<ToggleGroup.Root multiple variant size>`.
 */
export const TOGGLE_GROUP_MANIFEST: SetManifest = {
  key: "toggle-group",
  name: "Toggle group",
  api: { page: "toggle-group", parts: ["ToggleGroup.Root"] },
  slot: "toggle-group",
  axes: GROUP_AXES,
  columnAxis: "size",
  label: undefined,
  iconsFor: () => [],
  parts: TOGGLE_GROUP_ITEMS.map((entry) => itemManifest(entry, "none")),
  swapProperties: [],
};

/**
 * The segmented group's manifest, which the capture-backed build reads with
 * `captures/segmented-toggle-group.json`: a segmented toggle group, as the docs Segmented demos'
 * `<ToggleGroup.Root spacing={0} variant size>`.
 */
export const SEGMENTED_TOGGLE_GROUP_MANIFEST: SetManifest = {
  key: "segmented-toggle-group",
  name: "Segmented toggle group",
  api: { page: "toggle-group", parts: ["ToggleGroup.Root"] },
  slot: "toggle-group",
  axes: GROUP_AXES,
  columnAxis: "size",
  label: undefined,
  iconsFor: () => [],
  parts: SEGMENTED_TOGGLE_GROUP_ITEMS.map((entry, index, items) =>
    itemManifest(entry, segmentAt(index, items.length))
  ),
  swapProperties: [],
};
