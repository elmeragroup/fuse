/**
 * Button group, as one component set on the Button page: the docs demos' groups at each
 * `orientation`, 2 cells. The root is `ButtonGroup.Root`'s `<div role="group" data-slot="button-group">`.
 *
 * - `orientation=horizontal` is the default demo: `Archive`, `Snooze` and `Report`, each an outline
 *   `Button` instance at the default size, which the `Label` text property sets.
 * - `orientation=vertical` is the Vertical demo: `Increase` and `Decrease`, each an outline
 *   `Icon button` instance at the `icon` size, its `Icon` swapped to the demo's caret.
 * - The group squares each member's inner corners and collapses the border it shares with the
 *   member before it, `border-l-0` or `border-t-0`, which each instance carries as overrides of its
 *   corners and of that side's weight. Its `[--button-px-floor:0px]` pads a Button by the size's
 *   plain `control-px-button` inset.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";

/** The default demo's members, in order. */
export const BUTTON_GROUP_LABELS = ["Archive", "Snooze", "Report"] as const;

/** The Vertical demo's members, in order: each one's accessible name and the caret it shows. */
export const BUTTON_GROUP_STEPS = [
  { key: "increase", label: "Increase", icon: "CaretUp" },
  { key: "decrease", label: "Decrease", icon: "CaretDown" },
] as const;

/** Whether a cell is the group's horizontal one. */
const horizontal = (cell: Cell): boolean => cell.orientation === "horizontal";

/** A member of the default demo, an outline `Button` that shows its label. */
function labelMember(label: (typeof BUTTON_GROUP_LABELS)[number]): InstanceManifest {
  return {
    kind: "instance",
    key: label.toLowerCase(),
    of: BUTTON_MANIFEST,
    slot: "button",
    cell: () => ({ variant: "outline", size: "default", state: "rest", icon: "none" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: horizontal,
    exposed: true,
  };
}

/** A member of the Vertical demo, an outline `Icon button` that shows its caret. */
function stepMember(step: (typeof BUTTON_GROUP_STEPS)[number]): InstanceManifest {
  return {
    kind: "instance",
    key: step.key,
    of: ICON_BUTTON_MANIFEST,
    slot: "button",
    cell: () => ({ variant: "outline", size: "icon", state: "rest" }),
    properties: () => ({ swap: { Icon: step.icon } }),
    shownIn: (cell) => !horizontal(cell),
    exposed: true,
  };
}

/**
 * The group's manifest, which the capture-backed build reads with `captures/button-group.json`: the
 * default demo's horizontal group and the Vertical demo's column.
 */
export const BUTTON_GROUP_MANIFEST: SetManifest = {
  key: "button-group",
  name: "Button group",
  api: { page: "button-group", parts: ["ButtonGroup.Root"] },
  slot: "button-group",
  axes: [{ name: "orientation", values: ["horizontal", "vertical"] }],
  columnAxis: "orientation",
  label: undefined,
  iconsFor: () => [],
  parts: [...BUTTON_GROUP_LABELS.map(labelMember), ...BUTTON_GROUP_STEPS.map(stepMember)],
  swapProperties: [],
};
