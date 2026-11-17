/**
 * Toolbar, as one component set on a page of its own: the docs Basic demo's bar, horizontal and
 * vertical, 2 cells. The root is `Toolbar.Root`'s `<div role="toolbar" data-slot="toolbar">`.
 *
 * - The File group holds two buttons. Each button is a ghost small `Button` instance with a start
 *   icon, `Download` and `Duplicate`, whose `Start icon` swap property picks Download and Copy.
 * - The separator is a `Separator` instance across the bar, perpendicular to it: vertical in a
 *   horizontal bar and horizontal in a vertical one.
 * - The last button, `Delete`, is disabled. Base UI's toolbar button marks it `aria-disabled="true"`
 *   and `data-disabled`, and Fuse's Button disables it natively, so the instance is the Button set's
 *   disabled variant.
 * - Base UI stamps `data-orientation` on the root, the group and each button, so each orientation
 *   holds its own button instances.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";
import { SEPARATOR_MANIFEST } from "./separator-kit";

/** A toolbar button of the Basic demo: its label and the icon its `Start icon` swap property picks. */
type ToolbarAction = { readonly key: string; readonly label: string; readonly icon: string };

/** The File group's buttons: the docs Basic demo's. */
export const TOOLBAR_GROUP_ACTIONS: readonly ToolbarAction[] = [
  { key: "download", label: "Download", icon: "Download" },
  { key: "duplicate", label: "Duplicate", icon: "Copy" },
];

/** The disabled button after the separator: the docs Basic demo's. */
export const TOOLBAR_DISABLED_ACTION: ToolbarAction = { key: "delete", label: "Delete", icon: "Trash" };

/** A bar's orientation, as Base UI stamps it on the bar and each of its buttons. */
type Orientation = "horizontal" | "vertical";

/**
 * A ghost small `Button` with a start icon, as `<Toolbar.Button render={<Button variant="ghost" size="sm" />}>`,
 * in a bar of one orientation: the horizontal bar's under the action's key, the vertical bar's under
 * that key and `-vertical`.
 */
function toolbarButtonManifest(
  action: ToolbarAction,
  state: "rest" | "disabled",
  orientation: Orientation
): InstanceManifest {
  return {
    kind: "instance",
    key: orientation === "horizontal" ? action.key : `${action.key}-vertical`,
    of: BUTTON_MANIFEST,
    slot: "toolbar-button",
    cell: () => ({ variant: "ghost", size: "sm", state, icon: "start" }),
    properties: () => ({ text: { Label: action.label }, swap: { "Start icon": action.icon } }),
    shownIn: (cell) => (cell.orientation ?? "horizontal") === orientation,
    exposed: true,
  };
}

/** The bar's buttons in both orientations, each shown in its own. */
function toolbarButtonManifests(
  action: ToolbarAction,
  state: "rest" | "disabled"
): readonly InstanceManifest[] {
  return [
    toolbarButtonManifest(action, state, "horizontal"),
    toolbarButtonManifest(action, state, "vertical"),
  ];
}

/**
 * The toolbar's manifest, which the capture-backed build reads with `captures/toolbar.json`: a
 * toolbar, as the docs Basic demo's `<Toolbar.Root aria-label="Invoice" orientation={orientation}>`,
 * around the File group, `Toolbar.Group`, the separator, as `Toolbar.Separator` renders it, and the
 * disabled button.
 */
export const TOOLBAR_MANIFEST: SetManifest = {
  key: "toolbar",
  name: "Toolbar",
  slot: "toolbar",
  axes: [{ name: "orientation", values: ["horizontal", "vertical"] }],
  columnAxis: "orientation",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "group",
      slot: "toolbar-group",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: TOOLBAR_GROUP_ACTIONS.flatMap((action) => toolbarButtonManifests(action, "rest")),
    },
    {
      kind: "instance",
      key: "separator",
      of: SEPARATOR_MANIFEST,
      slot: "toolbar-separator",
      cell: (outer) => ({ orientation: outer.orientation === "vertical" ? "horizontal" : "vertical" }),
      properties: () => ({}),
      shownIn: always,
    },
    ...toolbarButtonManifests(TOOLBAR_DISABLED_ACTION, "disabled"),
  ],
  swapProperties: [],
};
