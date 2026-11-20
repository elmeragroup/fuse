/**
 * The renderers of the `tabs-trigger` and `tabs-list` sets: each cell as the docs default demo's real
 * Fuse `<Tabs.Root>` around `<Tabs.List variant>` and its `Account` and `Password` triggers.
 *
 * - A trigger cell renders `Account` alone. `active` selects it, and every other state selects
 *   `Password`, which is not there; `disabled` disables it. The page forces hover and focus on it.
 *   The list centers the trigger, 1px shorter than its content box, half a pixel off the grid the
 *   compare page crops on, so the host's own class packs it at the list's start instead, and clears
 *   the list's fill around it. The set draws the trigger alone, so neither changes what it draws.
 * - A list cell selects `Account`, as the demo does.
 * - A content cell renders the demo's tabs with `Account` selected and its panel. The page forces
 *   focus on the panel.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { Tabs } from "../../../fuse/dist/tabs.js";
import type { Cell } from "../components/component-spec.ts";
import { TABS_CONTENT_TEXT, TABS_TRIGGERS } from "../components/tabs-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The demo's tabs at the cell's variant, the given triggers in it, one selected and the first disabled or not. */
function tabs(
  cell: Cell,
  triggers: readonly (typeof TABS_TRIGGERS)[number][],
  selected: string,
  firstDisabled: boolean
): ReactElement {
  return createElement(
    Tabs.Root,
    { defaultValue: selected },
    createElement(
      Tabs.List,
      { variant: cell.variant === "line" ? "line" : "default" },
      ...triggers.map((trigger, index) =>
        createElement(
          Tabs.Trigger,
          { key: trigger.value, value: trigger.value, disabled: index === 0 && firstDisabled },
          trigger.label
        )
      )
    )
  );
}

/**
 * The host's classes around a trigger cell: one packs the trigger at its list's start, on the pixel
 * grid, and one clears the list's fill, which the crop around the trigger would hold at its
 * fractional edges, since the set draws the trigger alone.
 */
const TRIGGER_ALONE = [
  "[&_[data-slot=tabs-list]]:items-start!",
  "[&_[data-slot=tabs-list]]:bg-transparent!",
] as const;

/**
 * A `tabs-trigger` cell: the demo's list holding `Account` alone, in the cell's state, so the cell's
 * one trigger is the one it measures. Every state but `active` selects `Password`, which the list
 * leaves out, so no trigger is active.
 */
export const tabsTrigger: CellRendering = {
  hostClasses: TRIGGER_ALONE,
  element: (cell: Cell) =>
    createElement(
      "div",
      { className: TRIGGER_ALONE.join(" ") },
      tabs(
        cell,
        [TABS_TRIGGERS[0]],
        cell.state === "active" ? "account" : "password",
        cell.state === "disabled"
      )
    ),
};

/** A `tabs-list` cell: the demo's list at the cell's variant, `Account` selected. */
export const tabsList: CellRendering = {
  element: (cell: Cell) => tabs(cell, TABS_TRIGGERS, "account", false),
};

/** A `tabs-content` cell: the demo's tabs with `Account` selected, and its panel. */
export const tabsContent: CellRendering = {
  element: () =>
    createElement(
      Tabs.Root,
      { defaultValue: "account" },
      createElement(
        Tabs.List,
        null,
        ...TABS_TRIGGERS.map((trigger) =>
          createElement(Tabs.Trigger, { key: trigger.value, value: trigger.value }, trigger.label)
        )
      ),
      createElement(Tabs.Content, { value: "account" }, TABS_CONTENT_TEXT)
    ),
};
