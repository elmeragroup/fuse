/// <reference lib="dom" />
/**
 * The client renderer of the Navigation menu popup set: the docs Basic demo's item that the cell's
 * `content` names, open in a Root that holds that item alone, its popup portalled into the cell's
 * slot, measured as the popup. The page compiles the list's classes, which Fuse's own CSS lacks. With
 * the item alone in the List, its trigger, and the popup Base UI aligns to the trigger's start, begin
 * at the slot's left edge, on its pixel grid.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { NavigationMenu } from "../../../fuse/dist/navigation-menu.js";
import type { Cell } from "../components/component-spec.ts";
import {
  NAVIGATION_MENU_POPUP_CONTENTS,
  NAVIGATION_MENU_POPUPS,
  navigationMenuPopupOf,
} from "../components/navigation-menu-popup-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/** The value of the Root's one item, which the Root's `defaultValue` opens. */
const ITEM = "item";

/**
 * The classes the demo's lists carry. Fuse's standalone `styles.css` holds only the classes Fuse's own
 * source uses, so the page compiles these as the docs app's own Tailwind build does.
 */
const LIST_CLASSES = [
  ...new Set(
    NAVIGATION_MENU_POPUP_CONTENTS.flatMap((name) => NAVIGATION_MENU_POPUPS[name].listClass.split(" "))
  ),
];

/** The Basic demo's item the cell names, open, its content's list of links in the popup. */
export const navigationMenuPopup: ClientCellRendering = {
  hostClasses: LIST_CLASSES,
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) => {
    const { trigger, listClass, links } = navigationMenuPopupOf(cell.content);
    return createElement(
      NavigationMenu.Root,
      { "aria-label": "Main", defaultValue: ITEM, container },
      createElement(
        NavigationMenu.List,
        null,
        createElement(
          NavigationMenu.Item,
          { value: ITEM },
          createElement(NavigationMenu.Trigger, null, trigger),
          createElement(
            NavigationMenu.Content,
            null,
            createElement(
              "ul",
              { className: listClass },
              links.map(({ href, text }) =>
                createElement("li", { key: href }, createElement(NavigationMenu.Link, { href }, text))
              )
            )
          )
        )
      )
    );
  },
};
