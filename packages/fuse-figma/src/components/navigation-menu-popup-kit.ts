/**
 * Navigation menu's open popup, as one component set on the Navigation menu page beside its triggers
 * and links.
 *
 * - `Navigation menu popup` is the popup the docs Basic demo's bar opens, `content` customers and
 *   business: 2 cells. The Root renders one popup for every item: the shared surface, `bg-popover`,
 *   `shadow-md` and a 1px `foreground/10` ring, rounded `radius-md`, clipping. Base UI writes the
 *   content's measured size on it, so it is as wide as the item's list plus `surface-pad-sm` on each
 *   side, 264px for `Customers`' `w-64` list and 296px for `Business`' `w-72` one, and as tall as the
 *   content. It holds Base UI's classless viewport `<div>`, which holds the item's
 *   `NavigationMenu.Content`, which pads by `surface-pad-sm` and publishes the inner corner. The
 *   content holds the demo's `<ul className="grid … gap-1">`, a grid in one column whose rows fill the
 *   list 4px apart, each `<li>` holding a `Navigation menu row link` instance. In the popup a row
 *   rounds with the synced inner corner `radius-inner/md-pad-sm` and takes `popover-foreground`,
 *   which its instance carries as overrides.
 *
 * The open trigger and popup stay out as a composite: Base UI's positioner places the popup 8px below
 * the open trigger against the whole menu, with the trigger's offset in the List as its start, and no
 * auto layout draws a layer placed against an ancestor's box.
 */
import { navigationMenuVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { DIV_BLOCK } from "./menu-kit";
import { NAVIGATION_MENU_ROW_LINK } from "./navigation-menu-kit";
import {
  NAVIGATION_MENU_POPUP_CONTENTS,
  NAVIGATION_MENU_POPUPS,
  navigationMenuPopupOf,
} from "./navigation-menu-popup-text";
import type { NavigationMenuPopupContentName, NavigationMenuPopupLink } from "./navigation-menu-popup-text";

const { popup, viewport, content } = navigationMenuVariants();

const always = (): boolean => true;

/** The display the browser's default style sheet gives an `<li>`, which no class of the demo's sets. */
const LI_LIST_ITEM = [
  { className: "user agent style sheet, li", property: "display", value: "list-item" },
] as const;

/**
 * A `<li>` of an item's list, shown in that item's cell, holding a row link instance at rest and
 * inactive, its label exposed. Inside the popup the row's `in-data-[slot=navigation-menu-popup]:`
 * arm holds, which the row link set omits.
 */
function itemOf(
  name: NavigationMenuPopupContentName,
  { href, text }: NavigationMenuPopupLink
): PartDefinition {
  const shownIn = (cell: Cell): boolean => cell.content === name;
  const link: InstanceDefinition = {
    kind: "instance",
    key: "link",
    of: NAVIGATION_MENU_ROW_LINK,
    cell: () => ({ state: "rest", active: "off" }),
    properties: () => ({ text: { Label: text } }),
    shownIn,
    exposed: true,
    facts: new Map([["in-data-[slot=navigation-menu-popup]", always]]),
  };
  return {
    key: `item-${href.slice(1)}`,
    slot: undefined,
    element: { tag: "li", attributes: {} },
    shownIn,
    classesFor: () => "",
    elementDefaults: LI_LIST_ITEM,
    label: undefined,
    iconsFor: () => [],
    parts: [link],
  };
}

/** The open popup, as the docs Basic demo's Root shows an item's content. */
export const NAVIGATION_MENU_POPUP: ComponentDefinition = {
  key: "navigation-menu-popup",
  name: "Navigation menu popup",
  slot: "navigation-menu-popup",
  axes: [{ name: "content", values: NAVIGATION_MENU_POPUP_CONTENTS }],
  columnAxis: "content",
  classesFor: () => popup(),
  elementDefaults: DIV_BLOCK,
  inheritedFor: (cell) => [
    {
      className: "Base UI's popup, which writes the content's measured width",
      property: "--popup-width",
      value: `${String(navigationMenuPopupOf(cell.content).popupWidth)}px`,
    },
    {
      // The measured height is the content's own, which differs by density, so the popup hugs it.
      className: "Base UI's popup, which writes the content's measured height",
      property: "--popup-height",
      value: "auto",
    },
  ],
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "viewport",
      slot: undefined,
      element: { tag: "div", attributes: {} },
      shownIn: always,
      classesFor: () => viewport(),
      elementDefaults: DIV_BLOCK,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "content",
          slot: "navigation-menu-content",
          shownIn: always,
          classesFor: () => content(),
          elementDefaults: DIV_BLOCK,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              key: "list",
              slot: undefined,
              element: { tag: "ul", attributes: {} },
              shownIn: always,
              classesFor: (cell) => navigationMenuPopupOf(cell.content).listClass,
              label: undefined,
              iconsFor: () => [],
              parts: NAVIGATION_MENU_POPUP_CONTENTS.flatMap((name) =>
                NAVIGATION_MENU_POPUPS[name].links.map((link) => itemOf(name, link))
              ),
            },
          ],
        },
      ],
    },
  ],
  swapProperties: [],
};
