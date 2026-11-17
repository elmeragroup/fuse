/**
 * Navigation menu's open popup, as one component set on the Navigation menu page beside its triggers
 * and links. The manifest names the popup's parts and their places, and the build reads the rest
 * from `captures/navigation-menu-popup.json`.
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
import type { PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { NAVIGATION_MENU_ROW_LINK_MANIFEST } from "./navigation-menu-kit";
import { NAVIGATION_MENU_POPUP_CONTENTS, NAVIGATION_MENU_POPUPS } from "./navigation-menu-popup-text";
import type { NavigationMenuPopupContentName, NavigationMenuPopupLink } from "./navigation-menu-popup-text";
import { always } from "./popup-facts";

/**
 * A `<li>` of an item's list at its place in the list, shown in that item's cell, holding a row link
 * instance at rest and inactive, its label exposed.
 */
function itemManifest(
  name: NavigationMenuPopupContentName,
  { href, text }: NavigationMenuPopupLink,
  index: number
): PartManifest {
  const shownIn = (cell: Cell): boolean => cell.content === name;
  return {
    key: `item-${href.slice(1)}`,
    slot: undefined,
    place: `navigation-menu-content/0/${String(index)}`,
    shownIn,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        kind: "instance",
        key: "link",
        of: NAVIGATION_MENU_ROW_LINK_MANIFEST,
        cell: () => ({ state: "rest", active: "off" }),
        properties: () => ({ text: { Label: text } }),
        shownIn,
        exposed: true,
      },
    ],
  };
}

/**
 * The popup's manifest, which the capture-backed build reads with `captures/navigation-menu-popup.json`:
 * Base UI's viewport at the popup's second place, after a focus guard, the content, and its list at the
 * content's first place.
 */
export const NAVIGATION_MENU_POPUP_MANIFEST: SetManifest = {
  key: "navigation-menu-popup",
  name: "Navigation menu popup",
  slot: "navigation-menu-popup",
  axes: [{ name: "content", values: NAVIGATION_MENU_POPUP_CONTENTS }],
  columnAxis: "content",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "viewport",
      slot: undefined,
      place: "navigation-menu-popup/1",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "content",
          slot: "navigation-menu-content",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              key: "list",
              slot: undefined,
              place: "navigation-menu-content/0",
              shownIn: always,
              label: undefined,
              iconsFor: () => [],
              parts: NAVIGATION_MENU_POPUP_CONTENTS.flatMap((name) =>
                NAVIGATION_MENU_POPUPS[name].links.map((link, index) => itemManifest(name, link, index))
              ),
            },
          ],
        },
      ],
    },
  ],
  swapProperties: [],
};
