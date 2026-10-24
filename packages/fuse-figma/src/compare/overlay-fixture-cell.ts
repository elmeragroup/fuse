/// <reference lib="dom" />
/**
 * The client renderings of the self-check's overlay fixtures, which prove the client cells before a
 * kit set needs them. No kit set draws them, and `figma:compare` never renders them for a real
 * snapshot.
 *
 * - `popoverPopup`, a popup part: an open Popover whose popup holds a header, measured alone. Its
 *   outline Button trigger is the anchor, which the page hides.
 * - `popoverOpen`, an open composite: the same Popover, measured as its trigger and popup together.
 * - `menuItem`, a row: an open Dropdown menu with one item, measured alone. Base UI focuses a
 *   highlighted menu item, so the page forces `:focus` on the highlighted cell.
 * - `selectItem`, a row: an open Select with two items and the second selected, measured as the
 *   selected item. Fuse styles a highlighted Select item with `focus:`, so the page forces `:focus`.
 *
 * Each popup aligns to its trigger's start, so it starts on the slot's pixel grid and stays inside
 * the slot. The menu and the Select are not modal, so no open overlay marks the page's other cells
 * hidden. `overlay-fixtures.ts` lists them with their definitions.
 */

import { createElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { DropdownMenu } from "../../../fuse/dist/dropdown-menu.js";
import { Popover } from "../../../fuse/dist/popover.js";
import { Select } from "../../../fuse/dist/select.js";
import type { Cell } from "../components/component-spec.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";
import { FIXTURE_TEXT, SELECTED_FIXTURE_VALUE } from "./overlay-fixtures.ts";

const TRIGGER = createElement(Button, { variant: "outline" });

function openPopover(container: HTMLElement) {
  return createElement(
    Popover.Root,
    { defaultOpen: true },
    createElement(Popover.Trigger, { render: TRIGGER }, FIXTURE_TEXT.trigger),
    createElement(
      Popover.Content,
      { container, align: "start" },
      createElement(
        Popover.Header,
        null,
        createElement(Popover.Title, null, FIXTURE_TEXT.title),
        createElement(Popover.Description, null, FIXTURE_TEXT.description)
      )
    )
  );
}

/** An open Popover's popup, with a title and a description in its header. */
export const popoverPopup: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) => openPopover(container),
};

/** An open Popover, its trigger and its popup. */
export const popoverOpen: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) => openPopover(container),
  union: ["popover-trigger", "popover-content"],
};

/** One item of an open Dropdown menu, at rest or highlighted. */
export const menuItem: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(
      DropdownMenu.Root,
      { defaultOpen: true, modal: false },
      createElement(DropdownMenu.Trigger, { render: TRIGGER }, FIXTURE_TEXT.trigger),
      createElement(
        DropdownMenu.Content,
        { container, align: "start" },
        createElement(DropdownMenu.Item, null, FIXTURE_TEXT.menuItem)
      )
    ),
  highlight: "focus",
};

const [apple, banana] = FIXTURE_TEXT.selectItems;
const SELECT_ITEMS = { apple, [SELECTED_FIXTURE_VALUE]: banana };

/** The selected item of an open Select, at rest or highlighted. */
export const selectItem: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(
      Select.Root,
      { defaultOpen: true, modal: false, items: SELECT_ITEMS, defaultValue: SELECTED_FIXTURE_VALUE },
      createElement(Select.Trigger, null, createElement(Select.Value, null)),
      createElement(
        Select.Content,
        { container, align: "start", alignItemWithTrigger: false },
        ...Object.entries(SELECT_ITEMS).map(([value, label]) =>
          createElement(Select.Item, { key: value, value }, label)
        )
      )
    ),
  highlight: "focus",
};
