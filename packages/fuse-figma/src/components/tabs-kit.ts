/**
 * Tabs, as three component sets on a page of their own: the trigger, the docs default demo's list
 * of two triggers, and its panel. Both draw the horizontal Tabs the docs demos render, in `Tabs.List`'s two
 * variants, `default` and `line`.
 *
 * - `Tabs trigger` is `Tabs.Trigger`'s `<button data-slot="tabs-trigger">`, the demo's `Account`
 *   behind the `Label` TEXT property, at rest, hovered, focused, active and disabled: 10 cells. The
 *   active trigger is the one the root's value selects, which Base UI marks `data-active`; the
 *   `line` variant draws it with its underline, the trigger's `::after` box. The trigger sits first in
 *   the demo's list beside `Password`, which the set leaves out.
 * - `Tabs list` is `Tabs.List`'s `<div role="tablist" data-slot="tabs-list">` around the demo's two
 *   triggers, `Account` active and `Password` at rest, as `Tabs trigger` instances: 2 cells.
 * - `Tabs content` is `Tabs.Content`'s `<div role="tabpanel" data-slot="tabs-content">`, the demo's
 *   first panel behind the `Text` TEXT property, at rest and focused: 2 cells.
 * - The vertical orientation stays out.
 */
import type { InstanceManifest, LabelManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The demo's triggers, in order: its value, its label, and whether the root selects it. */
export const TABS_TRIGGERS = [
  { value: "account", label: "Account", active: true },
  { value: "password", label: "Password", active: false },
] as const;

/** The label every trigger cell shows, the default of the `Label` property: the demo's first trigger. */
export const TABS_TRIGGER_LABEL = TABS_TRIGGERS[0].label;

/** `Tabs.List`'s variants, the `variant` prop's values. */
const VARIANTS = ["default", "line"] as const;

/** The trigger's label. */
const TRIGGER_LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: TABS_TRIGGER_LABEL,
  textProperty: "Label",
  shownIn: always,
};

/**
 * The trigger's manifest, which the capture-backed build reads with `captures/tabs-trigger.json`:
 * `<Tabs.Trigger>` first in the demo's list, at the list's variant, in each state.
 */
export const TABS_TRIGGER_MANIFEST: SetManifest = {
  key: "tabs-trigger",
  name: "Tabs trigger",
  api: { page: "tabs", parts: ["Tabs.List", "Tabs.Trigger"] },
  slot: "tabs-trigger",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "state", values: ["rest", "hover", "focus", "active", "disabled"] },
  ],
  columnAxis: "state",
  label: TRIGGER_LABEL,
  iconsFor: () => [],
  swapProperties: [],
};

/** One of the list's triggers, a `Tabs trigger` instance at the list's variant, active where the root selects it. */
function triggerManifest(entry: (typeof TABS_TRIGGERS)[number]): InstanceManifest {
  return {
    kind: "instance",
    key: entry.value,
    of: TABS_TRIGGER_MANIFEST,
    cell: (outer: Cell) => ({ variant: outer.variant ?? "default", state: entry.active ? "active" : "rest" }),
    properties: () => ({ text: { Label: entry.label } }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * The list's manifest, which the capture-backed build reads with `captures/tabs-list.json`: the
 * demo's `<Tabs.List variant>` around its two triggers.
 */
export const TABS_LIST_MANIFEST: SetManifest = {
  key: "tabs-list",
  name: "Tabs list",
  api: { page: "tabs", parts: ["Tabs.List"] },
  slot: "tabs-list",
  axes: [{ name: "variant", values: VARIANTS }],
  columnAxis: "variant",
  label: undefined,
  iconsFor: () => [],
  parts: TABS_TRIGGERS.map(triggerManifest),
  swapProperties: [],
};

/** The panel's text: the demo's first panel, which its first trigger shows. */
export const TABS_CONTENT_TEXT = "Invoice 10041 is billed to the account holder.";

/**
 * The panel's manifest, which the capture-backed build reads with `captures/tabs-content.json`: the
 * demo's `<Tabs.Content value="account">`, at rest and focused.
 */
export const TABS_CONTENT_MANIFEST: SetManifest = {
  key: "tabs-content",
  name: "Tabs content",
  api: { page: "tabs", parts: ["Tabs.Content"] },
  slot: "tabs-content",
  axes: [{ name: "state", values: ["rest", "focus"] }],
  columnAxis: "state",
  label: { key: "text", name: "text", characters: TABS_CONTENT_TEXT, textProperty: "Text", shownIn: always },
  iconsFor: () => [],
  swapProperties: [],
};
