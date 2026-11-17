/**
 * Navigation menu's bar and row parts, as four component sets on the Navigation menu page. The open
 * popup is `navigation-menu-popup-kit.ts`'s set. The indicator is in no set. Each set's manifest names
 * its axes, label and icons, and the build reads the rest from the set's browser capture in
 * `captures/`.
 *
 * - `Navigation menu bar trigger`: `NavigationMenu.Trigger` in a horizontal Root, the md control box
 *   that hugs the docs Basic demo's `Customers` and a 16px CaretDown, in four states, closed and
 *   open, 8 cells. An open trigger fills `muted`, and its caret, on the Root's default `bottom` side,
 *   turns half a turn.
 * - `Navigation menu vertical trigger`: the trigger in a vertical Root, a full-width row that holds
 *   the docs Nested demo's `Electric car` and the caret, in the same four states, closed and open,
 *   8 cells. The demo's vertical Root opens its popup on its `right`, so the caret turns a quarter
 *   turn in every cell and no cell turns it further. Hover and open fill the row `accent` and
 *   recolor it and its caret `accent-foreground`.
 * - `Navigation menu bar link`: `NavigationMenu.Link` in a horizontal List, the md control box that
 *   hugs the docs Links demo's `Overview`, in three states, inactive and active, 6 cells.
 * - `Navigation menu row link`: the link in a vertical List, a row that holds the docs Basic demo's
 *   `Electricity`, in the same states, inactive and active, 6 cells.
 *
 * Base UI disables a trigger with `aria-disabled="true"` and `data-disabled` on its `<button>`, never
 * the native attribute, so the trigger stays focusable. A link is an `<a>`, which takes no disabled
 * state. `data-active` marks the link of the current page.
 *
 * The rows draw outside the popup, on `rounded-sm`. In the popup they round with the popup's inner
 * corner, which the popup set's row instances carry as an override. The demos give a row a title and
 * a description below it, and the sets draw the one-line form, the title alone.
 */
import type { IconManifest, LabelManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The bar trigger's text, the default of its `Label` property: the docs Basic demo's first trigger. */
export const NAVIGATION_MENU_BAR_TRIGGER_TEXT = "Customers";

/** The vertical trigger's text, the default of its `Label` property: the docs Nested demo's trigger. */
export const NAVIGATION_MENU_VERTICAL_TRIGGER_TEXT = "Electric car";

/** The bar link's text, the default of its `Label` property: the docs Links demo's active link. */
export const NAVIGATION_MENU_BAR_LINK_TEXT = "Overview";

/** The row link's text, the default of its `Label` property: the docs Basic demo's first row. */
export const NAVIGATION_MENU_ROW_LINK_TEXT = "Electricity";

/**
 * The width a vertical trigger fills: the docs Nested demo's list, `w-[min(18rem,calc(100vw-4rem))]`,
 * 18rem in a desktop window.
 */
export const NAVIGATION_MENU_VERTICAL_TRIGGER_WIDTH = 288;

/** The width a row link fills: the docs Basic demo's list, `w-64`. */
export const NAVIGATION_MENU_ROW_LINK_WIDTH = 256;

/**
 * Whether a cell shows the trigger's popup open.
 *
 * @param cell - A trigger cell.
 * @returns True at `open=on`.
 */
export function showsOpen(cell: Cell): boolean {
  return cell.open === "on";
}

/**
 * Whether a cell shows the link of the current page.
 *
 * @param cell - A link cell.
 * @returns True at `active=on`.
 */
export function showsActive(cell: Cell): boolean {
  return cell.active === "on";
}

/** The CaretDown a trigger renders after its label. */
const CARET: IconManifest = {
  key: "caret",
  name: "Caret",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretDown",
  swapProperty: undefined,
};

/** A trigger's axes: four states, closed and open. */
const TRIGGER_AXES = [
  { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  { name: "open", values: ["off", "on"] },
];

/** A link's axes: three states, inactive and active. */
const LINK_AXES = [
  { name: "state", values: ["rest", "hover", "focus"] },
  { name: "active", values: ["off", "on"] },
];

/** A label holding its text in every cell, the default of the set's `Label` property. */
function textManifest(characters: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty: "Label", shownIn: always };
}

/** The bar trigger's manifest, which the capture-backed build reads with `captures/navigation-menu-bar-trigger.json`. */
export const NAVIGATION_MENU_BAR_TRIGGER_MANIFEST: SetManifest = {
  key: "navigation-menu-bar-trigger",
  name: "Navigation menu bar trigger",
  slot: "navigation-menu-trigger",
  axes: TRIGGER_AXES,
  columnAxis: "state",
  label: textManifest(NAVIGATION_MENU_BAR_TRIGGER_TEXT),
  iconsFor: () => [CARET],
  swapProperties: [],
};

/**
 * The vertical trigger's manifest, which the capture-backed build reads with
 * `captures/navigation-menu-vertical-trigger.json`.
 */
export const NAVIGATION_MENU_VERTICAL_TRIGGER_MANIFEST: SetManifest = {
  key: "navigation-menu-vertical-trigger",
  name: "Navigation menu vertical trigger",
  slot: "navigation-menu-trigger",
  axes: TRIGGER_AXES,
  columnAxis: "state",
  label: textManifest(NAVIGATION_MENU_VERTICAL_TRIGGER_TEXT),
  iconsFor: () => [CARET],
  swapProperties: [],
};

/** The bar link's manifest, which the capture-backed build reads with `captures/navigation-menu-bar-link.json`. */
export const NAVIGATION_MENU_BAR_LINK_MANIFEST: SetManifest = {
  key: "navigation-menu-bar-link",
  name: "Navigation menu bar link",
  slot: "navigation-menu-link",
  axes: LINK_AXES,
  columnAxis: "state",
  label: textManifest(NAVIGATION_MENU_BAR_LINK_TEXT),
  iconsFor: () => [],
  swapProperties: [],
};

/** The row link's manifest, which the capture-backed build reads with `captures/navigation-menu-row-link.json`. */
export const NAVIGATION_MENU_ROW_LINK_MANIFEST: SetManifest = {
  key: "navigation-menu-row-link",
  name: "Navigation menu row link",
  slot: "navigation-menu-link",
  axes: LINK_AXES,
  columnAxis: "state",
  label: textManifest(NAVIGATION_MENU_ROW_LINK_TEXT),
  iconsFor: () => [],
  swapProperties: [],
};
