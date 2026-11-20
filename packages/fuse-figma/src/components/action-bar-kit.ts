/**
 * Action bar, as one component set on a page of its own: the docs default demo's bar over two
 * selected rows, 1 cell. The root is `ActionBar.Root`'s Toolbar bar, `<div role="toolbar"
 * data-slot="action-bar">`.
 *
 * - The count is `ActionBar.Count`'s `<span data-slot="action-bar-count">`, "2 selected" in en-US.
 * - Clear is a ghost `icon-xs` Icon button instance with its `X`, as `ActionBar.Clear` renders it.
 * - The separator is a vertical `Separator` instance, as Toolbar's separator renders it.
 * - Export and Delete are ghost `xs` Button instances with a start icon, `Download` and `Trash`,
 *   whose `Label` and `Start icon` properties carry the demo's words and icons.
 *
 * The bar renders inside its positioner, at the bottom of a positioned host as wide as the demo's
 * `max-w-xl` column, where it is wider than 28rem, so each button shows its words. The set draws no
 * narrow bar, whose buttons hide their words by a container query.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";
import { SEPARATOR_MANIFEST } from "./separator-kit";

/** The width of the positioned host the bar floats in: the docs default demo's `max-w-xl` column. */
export const ACTION_BAR_HOST_WIDTH = 576;

/** How many rows the docs default demo selects, which the count shows. */
export const ACTION_BAR_COUNT = 2;

/** The count's text in en-US for {@link ACTION_BAR_COUNT}, the default of its `Count` property. */
export const ACTION_BAR_COUNT_TEXT = "2 selected";

/** An action of the docs default demo: its words and the icon its `Start icon` property picks. */
type Action = { readonly key: string; readonly label: string; readonly icon: string };

/** The actions after the separator: the docs default demo's. */
export const ACTION_BAR_ACTIONS: readonly Action[] = [
  { key: "export", label: "Export", icon: "Download" },
  { key: "delete", label: "Delete", icon: "Trash" },
];

/** An action, as `<ActionBar.Button>` renders a ghost `xs` Button around its icon and words. */
function actionManifest(action: Action): InstanceManifest {
  return {
    kind: "instance",
    key: action.key,
    of: BUTTON_MANIFEST,
    slot: "action-bar-button",
    cell: () => ({ variant: "ghost", size: "xs", state: "rest", icon: "start" }),
    properties: () => ({ text: { Label: action.label }, swap: { "Start icon": action.icon } }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * The bar's manifest, which the capture-backed build reads with `captures/action-bar.json`: the
 * docs default demo's `<ActionBar.Root count={2}>` around its count, Clear, separator and the
 * Export and Delete buttons.
 */
export const ACTION_BAR_MANIFEST: SetManifest = {
  key: "action-bar",
  name: "Action bar",
  api: { page: "action-bar", parts: ["ActionBar.Root"] },
  slot: "action-bar",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "count",
      slot: "action-bar-count",
      shownIn: always,
      label: {
        key: "label",
        name: "label",
        characters: ACTION_BAR_COUNT_TEXT,
        textProperty: "Count",
        shownIn: always,
      },
      iconsFor: () => [],
    },
    {
      kind: "instance",
      key: "clear",
      of: ICON_BUTTON_MANIFEST,
      slot: "action-bar-clear",
      cell: () => ({ variant: "ghost", size: "icon-xs", state: "rest" }),
      properties: () => ({ swap: { Icon: "X" } }),
      shownIn: always,
    },
    {
      kind: "instance",
      key: "separator",
      of: SEPARATOR_MANIFEST,
      slot: "action-bar-separator",
      cell: () => ({ orientation: "vertical" }),
      properties: () => ({}),
      shownIn: always,
    },
    ...ACTION_BAR_ACTIONS.map(actionManifest),
  ],
  swapProperties: [],
};
