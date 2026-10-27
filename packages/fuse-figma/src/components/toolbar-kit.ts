/**
 * Toolbar, as one component set on a page of its own: the docs Basic demo's bar, horizontal and
 * vertical, 2 cells. The root is `Toolbar.Root`'s `<div role="toolbar" data-slot="toolbar">` with
 * the `root` slot of `toolbarVariants`.
 *
 * - The bar is the Toolbar shell, rounded `radius-lg` with a 1px `border` stroke and 4px padding, on
 *   the `popover` fill. It hugs its items, which sit 4px apart in a row, or in a column when vertical,
 *   centred across.
 * - The File group lays its two buttons 4px apart the same way. Each button is a ghost small `Button`
 *   instance with a start icon, `Download` and `Duplicate`, whose `Start icon` swap property picks
 *   Download and Copy.
 * - The separator is a `Separator` instance across the bar, perpendicular to it: vertical in a
 *   horizontal bar and horizontal in a vertical one. It stretches across the bar, 4px short of the
 *   items' edges at each end, which its margins set. In Figma the separator instance fills its padded
 *   frame across the hugging bar whatever its main's own length: 1×24 Dense and 1×28 Comfortable in a
 *   horizontal bar, and in a vertical one as wide as the widest button less 8, the bar hugging the
 *   buttons and not the main's 256px (W5-P10).
 * - The last button, `Delete`, is disabled. Base UI's toolbar button marks it `aria-disabled="true"`
 *   and `data-disabled`, and Fuse's Button disables it natively, so the instance is the Button set's
 *   disabled variant.
 * - Base UI stamps `data-orientation` on the root, the group and each button, and the separator's
 *   opposite orientation on the separator.
 */
import { separatorClass, toolbarVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON } from "./button-kit";
import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { always } from "./popup-facts";
import { SEPARATOR } from "./separator-kit";

/** A toolbar button of the Basic demo: its label and the icon its `Start icon` swap property picks. */
type ToolbarAction = { readonly key: string; readonly label: string; readonly icon: string };

/** The File group's buttons: the docs Basic demo's. */
export const TOOLBAR_GROUP_ACTIONS: readonly ToolbarAction[] = [
  { key: "download", label: "Download", icon: "Download" },
  { key: "duplicate", label: "Duplicate", icon: "Copy" },
];

/** The disabled button after the separator: the docs Basic demo's. */
export const TOOLBAR_DISABLED_ACTION: ToolbarAction = { key: "delete", label: "Delete", icon: "Trash" };

const slots = toolbarVariants();

/** The fact a toolbar button stamps over the Button set's pending meaning. */
const ARIA_DISABLED: ReadonlySet<string> = new Set(["aria-disabled"]);

/** A bar's orientation, as Base UI stamps it on the bar and each of its buttons. */
type Orientation = "horizontal" | "vertical";

/**
 * A ghost small `Button` with a start icon, as `<Toolbar.Button render={<Button variant="ghost" size="sm" />}>`,
 * in a bar of one orientation. Base UI stamps the bar's orientation on each button, which no Button
 * cell shows and no Button class reads, and facts read the inner cell, so each orientation holds its
 * own instances whose facts hold it: the horizontal bar's under the action's key, the vertical bar's
 * under that key and `-vertical`.
 */
function toolbarButton(
  action: ToolbarAction,
  state: "rest" | "disabled",
  orientation: Orientation
): InstanceDefinition {
  return {
    kind: "instance",
    key: orientation === "horizontal" ? action.key : `${action.key}-vertical`,
    of: BUTTON,
    slot: "toolbar-button",
    cell: () => ({ variant: "ghost", size: "sm", state, icon: "start" }),
    properties: () => ({ text: { Label: action.label }, swap: { "Start icon": action.icon } }),
    facts: new Map([
      ["data-horizontal", () => orientation === "horizontal"],
      ["data-vertical", () => orientation === "vertical"],
      // Base UI keeps a disabled toolbar button focusable and marks it `aria-disabled`, which the
      // Button set renders only while pending. Its classes draw the disabled face this cell draws.
      ["aria-disabled", () => state === "disabled"],
    ]),
    stamps: ARIA_DISABLED,
    shownIn: (cell) => (cell.orientation ?? "horizontal") === orientation,
    exposed: true,
  };
}

/** The bar's buttons in both orientations, each shown in its own. */
function toolbarButtons(action: ToolbarAction, state: "rest" | "disabled"): readonly InstanceDefinition[] {
  return [toolbarButton(action, state, "horizontal"), toolbarButton(action, state, "vertical")];
}

/** The File group, `Toolbar.Group`, around its two buttons. */
const GROUP: PartDefinition = {
  key: "group",
  slot: "toolbar-group",
  shownIn: always,
  classesFor: () => slots.group(),
  label: undefined,
  iconsFor: () => [],
  parts: TOOLBAR_GROUP_ACTIONS.flatMap((action) => toolbarButtons(action, "rest")),
};

/** The separator, perpendicular to the bar, as `Toolbar.Separator` renders it. */
const SEPARATOR_PART: InstanceDefinition = {
  kind: "instance",
  key: "separator",
  of: SEPARATOR,
  slot: "toolbar-separator",
  cell: (outer: Cell) => ({ orientation: outer.orientation === "vertical" ? "horizontal" : "vertical" }),
  // Toolbar.Separator draws Separator's hairline without the lengths the Separator set's demos pass.
  ownClassesFor: () => separatorClass,
  classesFor: () => slots.separator(),
  properties: () => ({}),
  shownIn: always,
};

/** Whether a cell's bar is vertical, which Base UI stamps as `data-orientation="vertical"`. */
function isVertical(cell: Cell): boolean {
  return cell.orientation === "vertical";
}

/** A toolbar, as the docs Basic demo's `<Toolbar.Root aria-label="Invoice" orientation={orientation}>`. */
export const TOOLBAR: ComponentDefinition = {
  key: "toolbar",
  name: "Toolbar",
  slot: "toolbar",
  axes: [{ name: "orientation", values: ["horizontal", "vertical"] }],
  columnAxis: "orientation",
  classesFor: () => slots.root(),
  states: {},
  // Base UI stamps the bar's orientation on its root as `data-orientation`.
  facts: new Map([
    ["data-horizontal", (cell: Cell) => !isVertical(cell)],
    ["data-vertical", isVertical],
  ]),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [GROUP, SEPARATOR_PART, ...toolbarButtons(TOOLBAR_DISABLED_ACTION, "disabled")],
  swapProperties: [],
};
