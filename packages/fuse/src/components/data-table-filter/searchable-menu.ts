"use client";

// The only module that names Base UI 1.9's preview menu filtering API. Base UI renames preview
// parts on their way out of preview, as OTPFieldPreview became OTPField in 1.6.0, so every filter
// part reaches them through here and a rename is a one-file edit.

import type { KeyboardEvent } from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { isBackspaceOnEmpty } from "../../internal/is-backspace-on-empty";

/** Base UI's preview menu filtering parts. */
export const SearchableMenu = {
  /** Makes the Menu.Root or Menu.SubmenuRoot inside it filterable. Renders no element. */
  Provider: MenuPrimitive.FilterProvider,
  /** The searchbox. It holds real focus, and the list moves a virtual highlight. */
  Input: MenuPrimitive.Input,
  /** The `menu` list inside the popup's `dialog`. */
  List: MenuPrimitive.List,
  /** Shown when the list has no items. */
  Empty: MenuPrimitive.Empty,
};

/** Base UI's composite navigation keys (`internals/composite/composite.ts`). */
const COMPOSITE_KEYS: ReadonlySet<string> = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

/**
 * Keeps a menu popup's navigation keys away from the bar's toolbar. A Menu.Trigger inside a
 * Toolbar registers the toolbar's keyboard relay with its menu (`MenuTrigger.tsx`), and every popup
 * of that menu, submenus included (`MenuStore.ts`), relays a key nothing stopped to the toolbar
 * (`MenuRoot.tsx`). The relay exists for a menubar's detached triggers. For this menu it would move
 * real focus to the next chip segment while the menu stays open, on ArrowRight in an empty search,
 * Home or End. Base UI stops these keys itself only for a popup rendered inside the toolbar
 * (`MenuPopup.tsx`), and the add menu is the bar's sibling, so each of its popups stops them. A
 * popup's own handler runs before the store's relay.
 *
 * @param event - The popup's keydown.
 */
export function keepKeysFromToolbar(event: KeyboardEvent<HTMLElement>): void {
  if (COMPOSITE_KEYS.has(event.key)) {
    event.stopPropagation();
  }
}

/**
 * Closes a value submenu on a fresh Backspace in its empty search, the way ArrowLeft does: focus
 * goes back to the menu's search with the field still highlighted. Base UI has no public call that
 * closes one submenu as its close key does, so the key goes to Base UI's own routing as the text
 * direction's close key (`useMenuFilterKeyDown.ts`, `MenuFilterSubmenuRoot.tsx`). A held Backspace
 * that has just emptied the search is still deleting, so it stays.
 *
 * @param event - The submenu search's keydown.
 */
export function closeSubmenuOnBackspace(event: KeyboardEvent<HTMLInputElement>): void {
  if (!isBackspaceOnEmpty(event)) {
    return;
  }
  const input = event.currentTarget;
  event.preventDefault();
  const view = input.ownerDocument.defaultView;
  if (view === null) {
    return;
  }
  const closeKey = view.getComputedStyle(input).direction === "rtl" ? "ArrowRight" : "ArrowLeft";
  input.dispatchEvent(
    new view.KeyboardEvent("keydown", { key: closeKey, code: closeKey, bubbles: true, cancelable: true })
  );
}
