/**
 * Dropdown menu's popups, as three component sets on the Dropdown menu page beside its rows.
 *
 * - `Dropdown menu popup` is the open popup, `content` basic, checkboxes, radio, destructive and
 *   submenu: 5 cells, the docs demos' children as instances of the row sets, the shared group label
 *   and the shared separator, each group a frame.
 * - `Dropdown menu sub content` is the submenu's popup, 1 cell, holding the docs Submenu demo's three
 *   rows.
 * - `Dropdown menu (open)` is the outline Button trigger, `Open`, with the Basic demo's popup open
 *   below it, 1 cell. Base UI places the popup 4px below the trigger, aligned to its start. The
 *   submenu form stays out: the sub content's top sits 2 × `row-h` + 10px below the popup's, which no
 *   variable holds, and Figma binds no absolute `y`.
 *
 * A popup hugs its rows. The capture-backed build measures each popup's widest row, so the manifest
 * names none.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST } from "./button-kit";
import type { Cell, InstanceProperties } from "./component-spec";
import {
  DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST,
  DROPDOWN_MENU_ITEM_MANIFEST,
  DROPDOWN_MENU_RADIO_ITEM_MANIFEST,
  DROPDOWN_MENU_SUB_TRIGGER_MANIFEST,
} from "./dropdown-menu-kit";
import {
  DROPDOWN_POPUP_CONTENTS,
  DROPDOWN_POPUPS,
  DROPDOWN_SUBMENU,
  DROPDOWN_TRIGGER_TEXT,
} from "./dropdown-menu-text";
import type { DropdownDemoNode } from "./dropdown-menu-text";
import { MENU_GROUP_LABEL_MANIFEST, MENU_SEPARATOR_MANIFEST } from "./menu-kit";
import { always } from "./popup-facts";

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
function partsManifest(
  nodes: readonly DropdownDemoNode[],
  prefix: string,
  shownIn: (cell: Cell) => boolean,
  group: { readonly value: string } | undefined
): readonly (PartManifest | InstanceManifest)[] {
  return nodes.map((node, index) => partManifest(node, keyOf(prefix, index, node), shownIn, group));
}

/** The part that draws one child: a frame for a group, an instance of a kit set for the rest. */
function partManifest(
  node: DropdownDemoNode,
  key: string,
  shownIn: (cell: Cell) => boolean,
  group: { readonly value: string } | undefined
): PartManifest | InstanceManifest {
  const instance = (
    of: SetManifest,
    cell: Cell,
    properties: NonNullable<InstanceManifest["properties"]>,
    slot?: string
  ): InstanceManifest => {
    const part: InstanceManifest = {
      kind: "instance",
      key,
      of,
      cell: () => cell,
      properties,
      shownIn,
      exposed: true,
    };
    return slot === undefined ? part : { ...part, slot };
  };
  switch (node.kind) {
    case "group":
    case "radio-group":
      return {
        key,
        slot: node.kind === "group" ? "dropdown-menu-group" : "dropdown-menu-radio-group",
        shownIn,
        label: undefined,
        iconsFor: () => [],
        parts: partsManifest(node.children, key, shownIn, node.kind === "radio-group" ? node : group),
      };
    case "label":
      return instance(
        MENU_GROUP_LABEL_MANIFEST,
        { kind: node.inset === true ? "menu inset" : "menu" },
        () => ({
          text: { Label: node.label },
        })
      );
    case "separator":
      // `DropdownMenu.Separator` stamps its own slot on the shared separator.
      return {
        kind: "instance",
        key,
        of: MENU_SEPARATOR_MANIFEST,
        slot: "dropdown-menu-separator",
        cell: () => ({ size: "default" }),
        shownIn,
      };
    case "item":
      return instance(
        DROPDOWN_MENU_ITEM_MANIFEST,
        {
          variant: node.destructive === true ? "destructive" : "default",
          inset: node.inset === true ? "on" : "off",
          state: node.disabled === true ? "disabled" : "rest",
        },
        () => itemProperties(node)
      );
    case "checkbox":
      return instance(
        DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST,
        { checked: node.checked ? "on" : "off", state: "rest" },
        () => ({ text: { Label: node.label } })
      );
    case "radio":
      return instance(
        DROPDOWN_MENU_RADIO_ITEM_MANIFEST,
        { checked: node.value === group?.value ? "on" : "off", state: "rest" },
        () => ({ text: { Label: node.label } })
      );
    case "sub-trigger":
      return instance(DROPDOWN_MENU_SUB_TRIGGER_MANIFEST, { state: "rest" }, () => ({
        text: { Label: node.label },
      }));
  }
}

/**
 * The popup's manifest, which the capture-backed build reads with `captures/dropdown-menu-popup.json`:
 * `<DropdownMenu.Content>` holding a docs demo's children.
 */
export const DROPDOWN_MENU_POPUP_MANIFEST: SetManifest = {
  key: "dropdown-menu-popup",
  name: "Dropdown menu popup",
  slot: "dropdown-menu-content",
  axes: [{ name: "content", values: DROPDOWN_POPUP_CONTENTS }],
  columnAxis: "content",
  label: undefined,
  iconsFor: () => [],
  parts: DROPDOWN_POPUP_CONTENTS.flatMap((value) =>
    partsManifest(DROPDOWN_POPUPS[value], value, (cell) => cell.content === value, undefined)
  ),
  swapProperties: [],
};

/**
 * The open Dropdown menu's manifest, which the capture-backed build reads with
 * `captures/dropdown-menu-open.json`: the trigger Button, which `DropdownMenu.Trigger` stamps with its
 * own slot, and the popup, and `DropdownMenu.Content`'s `sideOffset` as the docs' API reference gives
 * it.
 */
export const DROPDOWN_MENU_OPEN_MANIFEST: SetManifest = {
  key: "dropdown-menu-open",
  name: "Dropdown menu (open)",
  slot: "dropdown-menu-open",
  axes: [{ name: "placement", values: ["below"] }],
  columnAxis: "placement",
  union: ["dropdown-menu-trigger", "dropdown-menu-content"],
  sideOffset: 4,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "trigger",
      of: BUTTON_MANIFEST,
      cell: () => ({ variant: "outline", size: "default", state: "rest", icon: "none" }),
      properties: () => ({ text: { Label: DROPDOWN_TRIGGER_TEXT } }),
      slot: "dropdown-menu-trigger",
      shownIn: always,
      exposed: true,
    },
    {
      kind: "instance",
      key: "popup",
      of: DROPDOWN_MENU_POPUP_MANIFEST,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};

/**
 * The submenu's manifest, which the capture-backed build reads with
 * `captures/dropdown-menu-sub-content.json`: the docs Submenu demo's rows.
 */
export const DROPDOWN_MENU_SUB_CONTENT_MANIFEST: SetManifest = {
  key: "dropdown-menu-sub-content",
  name: "Dropdown menu sub content",
  slot: "dropdown-menu-sub-content",
  axes: [{ name: "content", values: ["submenu"] }],
  columnAxis: "content",
  label: undefined,
  iconsFor: () => [],
  parts: partsManifest(DROPDOWN_SUBMENU, "submenu", always, undefined),
  swapProperties: [],
};
