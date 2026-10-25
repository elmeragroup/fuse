/// <reference lib="dom" />
/**
 * The client renderers of the Dropdown menu sets, each an open `DropdownMenu.Root` mounted on the
 * compare page with its popup in the cell's slot, as `dropdown-menu-kit.ts` draws it.
 *
 * - `dropdownMenuSubTrigger`: a popup that holds one row, `Share`, the docs Submenu demo's sub trigger,
 *   disabled through its `disabled` prop, measured as the row. Fuse styles a highlighted row with
 *   `focus:`, so the page forces `:focus` on the highlighted cell. The open cell opens the submenu,
 *   which marks the row `data-popup-open`, and places the submenu 24px from the popup rather than
 *   flush, so its surface and shadow stay clear of the row's crop.
 * - `dropdownMenuItem`: a popup that holds one row, the docs Basic demo's `Profile` with its `⇧⌘P`
 *   shortcut, its tone and `inset` from the cell, disabled through its `disabled` prop, with a
 *   `<User />` before its text where the cell turns the `Icon` property on.
 * - `dropdownMenuCheckboxItem` and `dropdownMenuRadioItem`: a popup that holds one checkable row, the
 *   docs Checkboxes demo's `Show toolbar` or the Radio group demo's `Status bar`, checked or not.
 *
 * - `dropdownMenuPopup`: the docs demo the cell's `content` names, its children as the demo writes
 *   them, measured as the popup. The Submenu demo's submenu stays closed.
 * - `dropdownMenuSubContent`: the Submenu demo with its submenu open, measured as the submenu's popup,
 *   which sits 24px from the parent popup, as the open sub trigger's cell places it.
 * - `dropdownMenuOpen`: the Basic demo's trigger and popup, measured together.
 *
 * Each row cell's row sits in a `<div>` 160px wide with no `data-slot`, which the markup check passes over, so
 * the popup hugs it and the row is as wide as the set draws it. The popup aligns to its trigger's
 * start, so it starts on the slot's pixel grid and stays inside the slot, and the menu is not modal,
 * so its open popup marks no other cell hidden.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactNode } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { DropdownMenu } from "../../../fuse/dist/dropdown-menu.js";
import { Trash, User } from "../../../fuse/dist/icons.js";
import type { Cell } from "../components/component-spec.ts";
import {
  DROPDOWN_MENU_CHECKBOX_TEXT,
  DROPDOWN_MENU_ITEM_TEXT,
  DROPDOWN_MENU_RADIO_TEXT,
  DROPDOWN_MENU_SHORTCUT_TEXT,
  DROPDOWN_MENU_SUB_TRIGGER_TEXT,
  DROPDOWN_POPUPS,
  DROPDOWN_SUBMENU,
} from "../components/dropdown-menu-text.ts";
import type { DropdownDemoNode } from "../components/dropdown-menu-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/** The docs demos' trigger, which the page hides. */
const TRIGGER_TEXT = "Open";

/** How far the open cell's submenu sits from the popup, beyond the row's crop and its shadow. */
const SUBMENU_GAP = 24;

/** The sub trigger of an open menu, at rest, highlighted, focused, open or disabled. */
export const dropdownMenuSubTrigger: ClientCellRendering = {
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(
      DropdownMenu.Root,
      { defaultOpen: true, modal: false },
      createElement(
        DropdownMenu.Trigger,
        { render: createElement(Button, { variant: "outline" }) },
        TRIGGER_TEXT
      ),
      createElement(
        DropdownMenu.Content,
        { container, align: "start" },
        createElement(
          DropdownMenu.Sub,
          { defaultOpen: cell.state === "open" },
          createElement(
            DropdownMenu.SubTrigger,
            { disabled: cell.state === "disabled" },
            DROPDOWN_MENU_SUB_TRIGGER_TEXT
          ),
          createElement(
            DropdownMenu.SubContent,
            { container, sideOffset: SUBMENU_GAP },
            createElement(DropdownMenu.Item, null, "Email link")
          )
        )
      )
    ),
  highlight: "focus",
};

/** The width a row cell takes, `DROPDOWN_ROW_CELL_WIDTH`, which the host's own build compiles. */
const ROW_WIDTH = "w-40";

/** An open, non-modal menu whose popup holds `row` in a 160px `<div>`. */
function openRow(container: HTMLElement, row: ReactNode) {
  return createElement(
    DropdownMenu.Root,
    { defaultOpen: true, modal: false },
    createElement(
      DropdownMenu.Trigger,
      { render: createElement(Button, { variant: "outline" }) },
      TRIGGER_TEXT
    ),
    createElement(
      DropdownMenu.Content,
      { container, align: "start" },
      createElement("div", { className: ROW_WIDTH }, row)
    )
  );
}

/** A row of an open menu, in a tone, inset or not, in a state, with its icon where `Icon` is on. */
export const dropdownMenuItem: ClientCellRendering = {
  hostClasses: [ROW_WIDTH],
  element: (cell: Cell, turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openRow(
      container,
      createElement(
        DropdownMenu.Item,
        {
          variant: cell.variant === "destructive" ? "destructive" : "default",
          inset: cell.inset === "on",
          disabled: cell.state === "disabled",
        },
        turnedOn.has("Icon") ? createElement(User) : null,
        DROPDOWN_MENU_ITEM_TEXT,
        createElement(DropdownMenu.Shortcut, null, DROPDOWN_MENU_SHORTCUT_TEXT)
      )
    ),
  highlight: "focus",
};

/** A checkbox row of an open menu, checked or not, in a state. */
export const dropdownMenuCheckboxItem: ClientCellRendering = {
  hostClasses: [ROW_WIDTH],
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openRow(
      container,
      createElement(
        DropdownMenu.CheckboxItem,
        { checked: cell.checked === "on", disabled: cell.state === "disabled" },
        DROPDOWN_MENU_CHECKBOX_TEXT
      )
    ),
  highlight: "focus",
};

/** A radio row of an open menu, the group's value or not, in a state. */
export const dropdownMenuRadioItem: ClientCellRendering = {
  hostClasses: [ROW_WIDTH],
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openRow(
      container,
      createElement(
        DropdownMenu.RadioGroup,
        { value: cell.checked === "on" ? "status" : "activity" },
        createElement(
          DropdownMenu.RadioItem,
          { value: "status", disabled: cell.state === "disabled" },
          DROPDOWN_MENU_RADIO_TEXT
        )
      )
    ),
  highlight: "focus",
};

const ICONS = { User, Trash } as const;

/** A docs demo's child as the demo writes it. */
function demoNode(node: DropdownDemoNode, key: string): ReactNode {
  switch (node.kind) {
    case "group":
      return createElement(
        DropdownMenu.Group,
        { key },
        ...node.children.map((child, index) => demoNode(child, `${key}-${String(index)}`))
      );
    case "radio-group":
      return createElement(
        DropdownMenu.RadioGroup,
        { key, value: node.value },
        ...node.children.map((child, index) => demoNode(child, `${key}-${String(index)}`))
      );
    case "label":
      return createElement(DropdownMenu.Label, { key, inset: node.inset === true }, node.label);
    case "separator":
      return createElement(DropdownMenu.Separator, { key });
    case "item":
      return createElement(
        DropdownMenu.Item,
        {
          key,
          inset: node.inset === true,
          disabled: node.disabled === true,
          variant: node.destructive === true ? "destructive" : "default",
        },
        node.icon === undefined ? null : createElement(ICONS[node.icon]),
        node.label,
        node.shortcut === undefined ? null : createElement(DropdownMenu.Shortcut, null, node.shortcut)
      );
    case "checkbox":
      return createElement(DropdownMenu.CheckboxItem, { key, checked: node.checked }, node.label);
    case "radio":
      return createElement(DropdownMenu.RadioItem, { key, value: node.value }, node.label);
    case "sub-trigger":
      return createElement(
        DropdownMenu.Sub,
        { key },
        createElement(DropdownMenu.SubTrigger, null, node.label),
        createElement(
          DropdownMenu.SubContent,
          null,
          ...DROPDOWN_SUBMENU.map((child, index) => demoNode(child, `sub-${String(index)}`))
        )
      );
  }
}

/** An open, non-modal menu whose popup holds a docs demo's children. */
function openDemo(container: HTMLElement, nodes: readonly DropdownDemoNode[]) {
  return createElement(
    DropdownMenu.Root,
    { defaultOpen: true, modal: false },
    createElement(
      DropdownMenu.Trigger,
      { render: createElement(Button, { variant: "outline" }) },
      TRIGGER_TEXT
    ),
    createElement(
      DropdownMenu.Content,
      { container, align: "start" },
      ...nodes.map((node, index) => demoNode(node, String(index)))
    )
  );
}

/** The popup of the docs demo a cell's `content` names. */
export const dropdownMenuPopup: ClientCellRendering = {
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) => {
    const nodes = Object.entries(DROPDOWN_POPUPS).find(([content]) => content === cell.content)?.[1];
    if (nodes === undefined) {
      throw new Error(`the docs show no Dropdown menu popup ${cell.content ?? ""}`);
    }
    return openDemo(container, nodes);
  },
};

/** The docs Submenu demo with its submenu open, measured as the submenu's popup. */
export const dropdownMenuSubContent: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(
      DropdownMenu.Root,
      { defaultOpen: true, modal: false },
      createElement(
        DropdownMenu.Trigger,
        { render: createElement(Button, { variant: "outline" }) },
        TRIGGER_TEXT
      ),
      createElement(
        DropdownMenu.Content,
        { container, align: "start" },
        createElement(
          DropdownMenu.Sub,
          { defaultOpen: true },
          createElement(DropdownMenu.SubTrigger, null, DROPDOWN_MENU_SUB_TRIGGER_TEXT),
          createElement(
            DropdownMenu.SubContent,
            { container, sideOffset: SUBMENU_GAP },
            ...DROPDOWN_SUBMENU.map((child, index) => demoNode(child, String(index)))
          )
        )
      )
    ),
};

/** The docs Basic demo open: its trigger and its popup. */
export const dropdownMenuOpen: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openDemo(container, DROPDOWN_POPUPS.basic),
  union: ["dropdown-menu-trigger", "dropdown-menu-content"],
};
