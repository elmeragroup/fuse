/**
 * Dropdown menu's popups, as three component sets on the Dropdown menu page beside its rows.
 *
 * - `Dropdown menu popup` is the open popup, `content` basic, checkboxes, radio, destructive and
 *   submenu: 5 cells, the docs demos' children as instances of the row sets, the shared group label
 *   and the shared separator, each group a frame. The popup is the shared surface on the menu shell:
 *   `bg-popover`, `shadow-md` and a 1px `foreground/10` ring, rounded `radius-md`, padding
 *   `surface-pad-sm`, at least `min-w-32` wide and otherwise as wide as its widest row. A separator
 *   cancels the padding across, so the runs between separators sit in padded sections.
 * - `Dropdown menu sub content` is the submenu's popup, 1 cell: the same surface with `shadow-lg`, at
 *   least 96px wide, holding the docs Submenu demo's three rows.
 * - `Dropdown menu (open)` is the outline Button trigger, `Open`, with the Basic demo's popup open
 *   below it, 1 cell. Base UI places the popup 4px below the trigger, aligned to its start, so the
 *   composite is a column of the trigger's instance and the popup's, packed at its start. The trigger
 *   carries the open trigger's `aria-expanded` and `data-popup-open`. The column clips nothing, so the
 *   popup's shadow shows (PQ1). The submenu form stays out: the sub content's top sits 2 × `row-h` +
 *   10px below the popup's, which no variable holds, and Figma binds no absolute `y`.
 *
 * A popup hugs its rows, so the row that sets its width hugs across, with the group and section
 * around it, and every other row, section and separator fills (PM, PH2), as `hugging-rows.ts` says.
 * Each popup names its widest row, as the browser draws it, and that row keeps the popup's content
 * minimum as its own `minWidth`, so it fills to the minimum where its text fits and hugs past it (PH3).
 */
import { dropdownMenuVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON } from "./button-kit";
import type {
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  InstanceProperties,
  PartDefinition,
} from "./component-spec";
import {
  DROPDOWN_MENU_CHECKBOX_ITEM,
  DROPDOWN_MENU_ITEM,
  DROPDOWN_MENU_RADIO_ITEM,
  DROPDOWN_MENU_SUB_TRIGGER,
} from "./dropdown-menu-kit";
import {
  DROPDOWN_POPUP_CONTENTS,
  DROPDOWN_POPUPS,
  DROPDOWN_SUBMENU,
  DROPDOWN_TRIGGER_TEXT,
} from "./dropdown-menu-text";
import type { DropdownDemoNode } from "./dropdown-menu-text";
import { DIV_BLOCK } from "./element-defaults";
import { DROPDOWN_POPUP_FACTS, MENU_GROUP_LABEL, menuSeparatorPart } from "./menu-kit";
import { always, openPopupFacts } from "./popup-facts";

const { content, subContent } = dropdownMenuVariants();

/** A key part made of a node's place, unique within the popup's parts. */
const keyOf = (prefix: string, index: number, node: DropdownDemoNode): string =>
  `${prefix}-${String(index)}-${node.kind}`;

/** The TEXT, BOOLEAN and swap values of an item row: its label, its shortcut and its icon. */
function itemProperties(node: Extract<DropdownDemoNode, { readonly kind: "item" }>): InstanceProperties {
  const shown = { Shortcut: node.shortcut !== undefined, Icon: node.icon !== undefined };
  const label = { text: { Label: node.label }, boolean: shown };
  const keyed =
    node.shortcut === undefined
      ? label
      : { ...label, text: { Label: node.label, "Shortcut keys": node.shortcut } };
  return node.icon === undefined ? keyed : { ...keyed, swap: { "Icon glyph": node.icon } };
}

/** The parts that draw a demo's children, each shown where `shownIn` holds. */
function partsOf(
  nodes: readonly DropdownDemoNode[],
  prefix: string,
  shownIn: (cell: Cell) => boolean,
  group: { readonly value: string } | undefined
): readonly (PartDefinition | InstanceDefinition)[] {
  return nodes.map((node, index) => partOf(node, keyOf(prefix, index, node), shownIn, group));
}

/** The part that draws one child: a frame for a group, an instance of a kit set for the rest. */
function partOf(
  node: DropdownDemoNode,
  key: string,
  shownIn: (cell: Cell) => boolean,
  group: { readonly value: string } | undefined
): PartDefinition | InstanceDefinition {
  const widest =
    (node.kind === "item" || node.kind === "checkbox" || node.kind === "radio") && node.widest === true;
  const instance = (
    of: ComponentDefinition,
    cell: Cell,
    properties: NonNullable<InstanceDefinition["properties"]>
  ): InstanceDefinition => {
    const part: InstanceDefinition = {
      kind: "instance",
      key,
      of,
      cell: () => cell,
      properties,
      shownIn,
      exposed: true,
    };
    return widest ? { ...part, setsWidth: shownIn } : part;
  };
  switch (node.kind) {
    case "group":
    case "radio-group":
      return {
        key,
        slot: node.kind === "group" ? "dropdown-menu-group" : "dropdown-menu-radio-group",
        shownIn,
        classesFor: () => "",
        elementDefaults: DIV_BLOCK,
        label: undefined,
        iconsFor: () => [],
        parts: partsOf(node.children, key, shownIn, node.kind === "radio-group" ? node : group),
      };
    case "label":
      return instance(MENU_GROUP_LABEL, { kind: node.inset === true ? "menu inset" : "menu" }, () => ({
        text: { Label: node.label },
      }));
    case "separator":
      // `DropdownMenu.Separator` stamps its own slot on the shared separator.
      return menuSeparatorPart({ key, slot: "dropdown-menu-separator", shownIn });
    case "item":
      return instance(
        DROPDOWN_MENU_ITEM,
        {
          variant: node.destructive === true ? "destructive" : "default",
          inset: node.inset === true ? "on" : "off",
          state: node.disabled === true ? "disabled" : "rest",
        },
        () => itemProperties(node)
      );
    case "checkbox":
      return instance(
        DROPDOWN_MENU_CHECKBOX_ITEM,
        { checked: node.checked ? "on" : "off", state: "rest" },
        () => ({ text: { Label: node.label } })
      );
    case "radio":
      return instance(
        DROPDOWN_MENU_RADIO_ITEM,
        { checked: node.value === group?.value ? "on" : "off", state: "rest" },
        () => ({ text: { Label: node.label } })
      );
    case "sub-trigger":
      return instance(DROPDOWN_MENU_SUB_TRIGGER, { state: "rest" }, () => ({ text: { Label: node.label } }));
  }
}

/** The open popup, as `<DropdownMenu.Content>` holding a docs demo's children. */
export const DROPDOWN_MENU_POPUP: ComponentDefinition = {
  key: "dropdown-menu-popup",
  name: "Dropdown menu popup",
  slot: "dropdown-menu-content",
  axes: [{ name: "content", values: DROPDOWN_POPUP_CONTENTS }],
  columnAxis: "content",
  classesFor: () => content(),
  elementDefaults: DIV_BLOCK,
  states: {},
  facts: DROPDOWN_POPUP_FACTS,
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: DROPDOWN_POPUP_CONTENTS.flatMap((value) =>
    partsOf(DROPDOWN_POPUPS[value], value, (cell) => cell.content === value, undefined)
  ),
  swapProperties: [],
};

/** The variants Base UI stamps on an open submenu, placed on the right of its trigger. */
const SUBMENU_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = openPopupFacts({ side: "right" });

/** The submenu's popup, as `<DropdownMenu.SubContent>` holding the docs Submenu demo's rows. */
export const DROPDOWN_MENU_SUB_CONTENT: ComponentDefinition = {
  key: "dropdown-menu-sub-content",
  name: "Dropdown menu sub content",
  slot: "dropdown-menu-sub-content",
  axes: [{ name: "content", values: ["submenu"] }],
  columnAxis: "content",
  classesFor: () => subContent(),
  elementDefaults: DIV_BLOCK,
  states: {},
  facts: SUBMENU_FACTS,
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: partsOf(DROPDOWN_SUBMENU, "submenu", always, undefined),
  swapProperties: [],
};

/**
 * The open menu: the outline Button trigger and the Basic demo's popup below it. The composite has no
 * element of its own: the column draws Base UI's placement, the popup 4px below the trigger and
 * aligned to its start.
 */
export const DROPDOWN_MENU_OPEN: ComponentDefinition = {
  key: "dropdown-menu-open",
  name: "Dropdown menu (open)",
  slot: "dropdown-menu-open",
  axes: [{ name: "placement", values: ["below"] }],
  columnAxis: "placement",
  classesFor: () => "flex flex-col items-start gap-1",
  // The popup's shadow reaches past the column below and beside it.
  rootOverflow: "visible",
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "trigger",
      of: BUTTON,
      cell: () => ({ variant: "outline", size: "default", state: "rest", icon: "none" }),
      properties: () => ({ text: { Label: DROPDOWN_TRIGGER_TEXT } }),
      // `DropdownMenu.Trigger` renders the Button with its own slot, and Base UI marks a menu's trigger
      // expanded, `data-popup-open` and `data-pressed` while the popup is open.
      slot: "dropdown-menu-trigger",
      facts: new Map([
        ["aria-expanded", always],
        ["data-popup-open", always],
        ["data-pressed", always],
      ]),
      shownIn: always,
      exposed: true,
    },
    {
      kind: "instance",
      key: "popup",
      of: DROPDOWN_MENU_POPUP,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
