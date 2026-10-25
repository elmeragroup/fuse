/**
 * Navigation menu's bar and row parts, as four component sets on the Navigation menu page. The open
 * popup is `navigation-menu-popup-kit.ts`'s set. The indicator is in no set.
 *
 * - `Navigation menu bar trigger`: `NavigationMenu.Trigger` in a horizontal Root, the md control box
 *   that hugs the docs Basic demo's `Customers` and a 16px CaretDown, in four states, closed and
 *   open, 8 cells. `open=on` holds `data-popup-open`, which Base UI stamps on an open trigger, so the
 *   trigger fills `muted` and the caret, whose `data-side` is the Root's default `bottom`, turns half
 *   a turn through `data-[side=bottom]:group-data-popup-open/navigation-menu-trigger:rotate-180`.
 * - `Navigation menu vertical trigger`: the trigger in a vertical Root, a full-width row that holds
 *   the docs Nested demo's `Electric car` and the caret, in the same four states, closed and open,
 *   8 cells. The demo's vertical Root opens its popup on its `right`, and the caret writes that side,
 *   so `data-[side=right]:-rotate-90` turns it a quarter turn in every cell and no cell turns it
 *   further. Hover and open fill the row `accent` and recolour it and its caret `accent-foreground`,
 *   the caret through the `**:` arms that reach every element below the trigger.
 * - `Navigation menu bar link`: `NavigationMenu.Link` in a horizontal List, the md control box that
 *   hugs the docs Links demo's `Overview`, in three states, inactive and active, 6 cells.
 * - `Navigation menu row link`: the link in a vertical List, a row that holds the docs Basic demo's
 *   `Electricity`, in the same states, inactive and active, 6 cells.
 *
 * A trigger takes `disabled`, which Base UI renders as `aria-disabled="true"` and `data-disabled`
 * on its `<button>`, never the native attribute, so the trigger stays focusable. A link is an `<a>`,
 * which takes no disabled state. `data-active` marks the link of the current page.
 *
 * The rows draw outside the popup, on `rounded-sm`. In the popup they round with the popup's inner
 * corner, which the popup set's row instances carry as an override. The demos give a row a title and a description below
 * it, and the sets draw the one-line form, the title alone.
 */
import { navigationMenuVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";

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

/** The sides a caret can point to, as `data-side` names them, which the caret's classes read. */
const CARET_SIDES = ["bottom", "left", "right", "top", "inline-end", "inline-start"] as const;

/** A side the caret points to: its Root's `side`, where the popup opens. */
export type CaretSide = (typeof CARET_SIDES)[number];

/** The recipe's slots, which take no variant but the trigger's orientation and the link's box. */
const SLOTS = navigationMenuVariants();

const always = (): boolean => true;

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

/** The CaretDown a trigger renders after its label, with the `triggerIcon` slot's classes. */
const CARET: IconSlot = {
  key: "caret",
  name: "Caret",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretDown",
  swapProperty: undefined,
  classes: SLOTS.triggerIcon(),
};

/** Why no cell draws a vertical trigger's arm inside the popup, where the docs Nested demo puts it. */
const TRIGGER_IN_POPUP =
  "a row inside the Navigation menu's popup, as the docs Nested demo's trigger sits, which no set draws: the Navigation menu popup set holds row links alone";

/** Why no cell draws a row link's arm inside the popup. */
const LINK_IN_POPUP =
  "a row inside the Navigation menu's popup, which the Navigation menu popup set draws as an instance of this set with its corner overridden";

/**
 * Why no cell draws a caret's right-to-left arm. The kit draws a left-to-right page, where a logical
 * side such as `inline-end` points right.
 */
const RIGHT_TO_LEFT = "a right-to-left page, which the kit does not draw";

/**
 * The variants a trigger's cells hold: the open state Base UI stamps on the trigger, which the
 * trigger's own classes and its caret's group arm read, and the caret's side, which only the side
 * the Root writes matches.
 */
function triggerFacts(side: CaretSide): ReadonlyMap<string, (cell: Cell) => boolean> {
  return new Map([
    ["data-popup-open", showsOpen],
    // Base UI stamps `data-pressed` beside `data-popup-open` while the trigger is open. No class
    // reads it.
    ["data-pressed", showsOpen],
    ["group-data-popup-open/navigation-menu-trigger", showsOpen],
    ...CARET_SIDES.map((candidate): [string, (cell: Cell) => boolean] => [
      `data-[side=${candidate}]`,
      () => candidate === side,
    ]),
    // The kit draws a left-to-right page.
    ["ltr", always],
  ]);
}

/** The parts of a trigger set that do not depend on the Root's orientation. */
const TRIGGER_BASE = {
  slot: "navigation-menu-trigger",
  // Base UI disables the trigger's `<button>` with `aria-disabled="true"` and `data-disabled`, never
  // the native attribute, so `disabled:` holds in no cell.
  rootKind: "plain-element",
  axes: [
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
    { name: "open", values: ["off", "on"] },
  ],
  columnAxis: "state",
  states: { disabled: ["aria-disabled", "data-disabled"] },
  omittedStates: new Set(["disabled"]),
  iconsFor: () => [CARET],
  swapProperties: [],
} as const satisfies Partial<ComponentDefinition>;

/** A trigger in a horizontal Root, as `<NavigationMenu.Trigger>` in the bar. */
export const NAVIGATION_MENU_BAR_TRIGGER: ComponentDefinition = {
  ...TRIGGER_BASE,
  key: "navigation-menu-bar-trigger",
  name: "Navigation menu bar trigger",
  classesFor: () => SLOTS.trigger({ orientation: "horizontal" }),
  facts: triggerFacts("bottom"),
  omittedCompositions: new Map([["rtl", RIGHT_TO_LEFT]]),
  label: {
    key: "text",
    name: "text",
    characters: NAVIGATION_MENU_BAR_TRIGGER_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
};

/**
 * A trigger in a vertical Root that opens its popup on its right, as the docs Nested demo's
 * `<NavigationMenu.Root orientation="vertical" side="right" align="end">`, in its 288px list.
 */
export const NAVIGATION_MENU_VERTICAL_TRIGGER: ComponentDefinition = {
  ...TRIGGER_BASE,
  key: "navigation-menu-vertical-trigger",
  name: "Navigation menu vertical trigger",
  previewWidth: NAVIGATION_MENU_VERTICAL_TRIGGER_WIDTH,
  classesFor: () => SLOTS.trigger({ orientation: "vertical" }),
  facts: triggerFacts("right"),
  omittedCompositions: new Map([
    ["rtl", RIGHT_TO_LEFT],
    ["in-data-[slot=navigation-menu-popup]", TRIGGER_IN_POPUP],
  ]),
  label: {
    key: "text",
    name: "text",
    characters: NAVIGATION_MENU_VERTICAL_TRIGGER_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
};

/** The parts of a link set that do not depend on the box it takes. */
const LINK_BASE = {
  slot: "navigation-menu-link",
  axes: [
    { name: "state", values: ["rest", "hover", "focus"] },
    { name: "active", values: ["off", "on"] },
  ],
  columnAxis: "state",
  states: {},
  facts: new Map([["data-active", showsActive]]),
  omittedStates: new Set<string>(),
  iconsFor: () => [],
  swapProperties: [],
} as const satisfies Partial<ComponentDefinition>;

/** A link directly in a horizontal List, as the docs Links demo places `<NavigationMenu.Link>`. */
export const NAVIGATION_MENU_BAR_LINK: ComponentDefinition = {
  ...LINK_BASE,
  key: "navigation-menu-bar-link",
  name: "Navigation menu bar link",
  classesFor: () => SLOTS.link({ box: "bar" }),
  label: {
    key: "text",
    name: "text",
    characters: NAVIGATION_MENU_BAR_LINK_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
};

/** A link in a vertical List, outside the popup, in the docs Basic demo's 256px list. */
export const NAVIGATION_MENU_ROW_LINK: ComponentDefinition = {
  ...LINK_BASE,
  key: "navigation-menu-row-link",
  name: "Navigation menu row link",
  previewWidth: NAVIGATION_MENU_ROW_LINK_WIDTH,
  classesFor: () => SLOTS.link({ box: "row" }),
  omittedCompositions: new Map([["in-data-[slot=navigation-menu-popup]", LINK_IN_POPUP]]),
  label: {
    key: "text",
    name: "text",
    characters: NAVIGATION_MENU_ROW_LINK_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
};
