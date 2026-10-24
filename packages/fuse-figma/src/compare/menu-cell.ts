/// <reference lib="dom" />
/**
 * The renderers of the shared menu sets, each as Select renders the part.
 *
 * - `menuGroupLabel`, a client rendering: an open Select whose popup holds one group, the docs Groups
 *   demo's Citrus caption and its first row, measured as the label. The popup is 144px wide, its
 *   minimum, wider than the trigger, so the group gives the label 136px.
 * - `menuSeparator`, a static rendering: `<Select.Separator />` in a host 144px wide that pads
 *   `surface-pad-sm` across, as a popup that pads its rows holds it, so its margins widen it to the
 *   host's 144px. It needs no Select around it, and Select's own popup pads nothing, so its margins
 *   would put it 4px outside its container on each side, where the popup clips it.
 *
 * The popup aligns to its trigger's start, so it starts on the slot's pixel grid and stays inside the
 * slot, and the Select is not modal, so its open popup marks no other cell hidden.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Select } from "../../../fuse/dist/select.js";
import type { Cell } from "../components/component-spec.ts";
import { MENU_GROUP_LABEL_TEXT } from "../components/menu-kit.ts";
import { SELECT_TRIGGER_TEXT } from "../components/select-trigger-kit.ts";
import type { CellRendering, ClientCellRendering } from "./cell-renderers.ts";

/** The caption's group's one row. */
const ROW = { lemon: "Lemon" };

/** The group label of an open Select's one group. */
export const menuGroupLabel: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(
      Select.Root,
      { defaultOpen: true, modal: false, items: ROW },
      createElement(Select.Trigger, null, createElement(Select.Value, { placeholder: SELECT_TRIGGER_TEXT })),
      createElement(
        Select.Content,
        { container, align: "start", alignItemWithTrigger: false },
        createElement(
          Select.Group,
          null,
          createElement(Select.Label, null, MENU_GROUP_LABEL_TEXT),
          createElement(Select.Item, { value: "lemon" }, ROW.lemon)
        )
      )
    ),
};

/** A popup's width and padding, which the host's own build compiles. */
const PADDED_POPUP = "box-border w-36 px-(--surface-pad-sm)";

/** A separator in a host as wide as a popup that pads its rows. */
export const menuSeparator: CellRendering = {
  hostClasses: PADDED_POPUP.split(" "),
  element: () => createElement("div", { className: PADDED_POPUP }, createElement(Select.Separator)),
};
