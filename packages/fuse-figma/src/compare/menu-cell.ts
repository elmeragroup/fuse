/// <reference lib="dom" />
/**
 * The renderers of the shared menu sets, each as Select renders the part.
 *
 * - `menuGroupLabel`, a client rendering of each family's caption, measured as the label. At
 *   `kind=plain`, an open Select whose popup holds one group, the docs Groups demo's Citrus caption and
 *   its first row. The popup is 144px wide, its minimum, wider than the trigger, so the group gives the
 *   label 136px. At `kind=menu` and `kind=menu inset`, an open Dropdown menu whose popup holds one
 *   group, the caption, `inset` at `menu inset`, and one row. The caption sits in a `<div>` 136px wide,
 *   which carries no `data-slot`, so the popup hugs it at the same 144px and the markup check reads
 *   the popup and the group around the caption as Fuse renders them.
 * - `menuSeparator`, a static rendering: `<Select.Separator />` in a host 144px wide that pads
 *   `surface-pad-sm` across, as a popup that pads its rows holds it, so its margins widen it to the
 *   host's 144px. It needs no Select around it, and Select's own popup pads nothing, so its margins
 *   would put it 4px outside its container on each side, where the popup clips it.
 *
 * Each popup aligns to its trigger's start, so it starts on the slot's pixel grid and stays inside the
 * slot, and neither overlay is modal, so its open popup marks no other cell hidden.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { DropdownMenu } from "../../../fuse/dist/dropdown-menu.js";
import { Select } from "../../../fuse/dist/select.js";
import type { Cell } from "../components/component-spec.ts";
import { MENU_GROUP_LABEL_TEXT } from "../components/menu-kit.ts";
import { SELECT_TRIGGER_TEXT } from "../components/select-trigger-kit.ts";
import type { CellRendering, ClientCellRendering } from "./cell-renderers.ts";

/** The caption's group's one row. */
const ROW = { lemon: "Lemon" };

/** The width a Select group gives its caption in the Groups demo, which the host's own build compiles. */
const CAPTION_WIDTH = "w-34";

/** The group label of an open Select's one group. */
function selectLabel(container: HTMLElement) {
  return createElement(
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
  );
}

/** The group label of an open Dropdown menu's one group, inset or not. */
function dropdownLabel(container: HTMLElement, inset: boolean) {
  return createElement(
    DropdownMenu.Root,
    { defaultOpen: true, modal: false },
    createElement(
      DropdownMenu.Trigger,
      { render: createElement(Button, { variant: "outline" }) },
      SELECT_TRIGGER_TEXT
    ),
    createElement(
      DropdownMenu.Content,
      { container, align: "start" },
      createElement(
        DropdownMenu.Group,
        null,
        createElement(
          "div",
          { className: CAPTION_WIDTH },
          createElement(DropdownMenu.Label, { inset }, MENU_GROUP_LABEL_TEXT)
        ),
        createElement(DropdownMenu.Item, { inset }, ROW.lemon)
      )
    )
  );
}

/** The group label of each family, by the cell's `kind`. */
export const menuGroupLabel: ClientCellRendering = {
  hostClasses: [CAPTION_WIDTH],
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    cell.kind === "plain" ? selectLabel(container) : dropdownLabel(container, cell.kind === "menu inset"),
};

/** A popup's width and padding, which the host's own build compiles. */
const PADDED_POPUP = "box-border w-36 px-(--surface-pad-sm)";

/** A separator in a host as wide as a popup that pads its rows. */
export const menuSeparator: CellRendering = {
  hostClasses: PADDED_POPUP.split(" "),
  element: () => createElement("div", { className: PADDED_POPUP }, createElement(Select.Separator)),
};
