/**
 * The component sets of the kit, each with its page and the cells its preview frames place.
 * `build-kit.ts` builds a set from each entry and the previews of each page, and `figma:compare`
 * reads each entry's axes to parse a snapshot's variant keys and to pick the self-check's cells.
 *
 * Keep this module free of Tailwind's compiler, the theme catalog and the Fuse build, so the
 * modules that need only the definitions and their cells, such as the compare unit tests that
 * parse keys and check markup, load it without them. A comparison run loads the compiler anyway,
 * through `buildComponentSets()`.
 */
import { ACCORDION_ITEM } from "./accordion-kit";
import { ALERT } from "./alert-kit";
import { AVATAR } from "./avatar-kit";
import { BADGE } from "./badge-kit";
import {
  BREADCRUMB_ELLIPSIS,
  BREADCRUMB_LINK,
  BREADCRUMB_PAGE,
  BREADCRUMB_SEPARATOR,
  BREADCRUMB_TRAIL,
} from "./breadcrumb-kit";
import { BUTTON, ICON_BUTTON } from "./button-kit";
import { CALENDAR_DAY } from "./calendar-day-kit";
import { CHECKBOX } from "./checkbox-kit";
import { COMBOBOX_EMPTY, COMBOBOX_ITEM, COMBOBOX_OPEN, COMBOBOX_POPUP } from "./combobox-kit";
import { COMMAND_ITEM, COMMAND_LIST } from "./command-kit";
import { matrixCells } from "./component-spec";
import type { Cell, ComponentDefinition } from "./component-spec";
import { CONFIRM_BUTTON } from "./confirm-button-kit";
import {
  DROPDOWN_MENU_CHECKBOX_ITEM,
  DROPDOWN_MENU_ITEM,
  DROPDOWN_MENU_RADIO_ITEM,
  DROPDOWN_MENU_SUB_TRIGGER,
} from "./dropdown-menu-kit";
import { DROPDOWN_MENU_OPEN, DROPDOWN_MENU_POPUP, DROPDOWN_MENU_SUB_CONTENT } from "./dropdown-popup-kit";
import { EMPTY } from "./empty-kit";
import { FIELD_DESCRIPTION, FIELD_ERROR, FIELD_LEGEND, FIELD_TITLE } from "./field-text-kit";
import { INPUT_GROUP } from "./input-group-kit";
import { INPUT } from "./input-kit";
import { ITEM, ITEM_LINK } from "./item-kit";
import { KBD, KBD_GROUP } from "./kbd-kit";
import { axisValues } from "./kit-spec";
import { LABEL } from "./label-kit";
import { LINK } from "./link-kit";
import { LOADER } from "./loader-kit";
import { MENU_GROUP_LABEL, MENU_SEPARATOR } from "./menu-kit";
import { METER } from "./meter-kit";
import {
  NAVIGATION_MENU_BAR_LINK,
  NAVIGATION_MENU_BAR_TRIGGER,
  NAVIGATION_MENU_ROW_LINK,
  NAVIGATION_MENU_VERTICAL_TRIGGER,
} from "./navigation-menu-kit";
import { NAVIGATION_MENU_POPUP } from "./navigation-menu-popup-kit";
import { PAGINATION_EDGE, PAGINATION_ELLIPSIS, PAGINATION_LINK, PAGINATION_ROW } from "./pagination-kit";
import { POPOVER_CONTENT, POPOVER_OPEN } from "./popover-kit";
import { RADIO_ICON_BUTTON } from "./radio-icon-button-kit";
import { RADIO } from "./radio-kit";
import { SELECT_ITEM, SELECT_OPEN, SELECT_POPUP } from "./select-kit";
import { SELECT_TRIGGER } from "./select-trigger-kit";
import { SEPARATOR } from "./separator-kit";
import {
  SIDEBAR_GROUP_LABEL,
  SIDEBAR_MENU_BADGE,
  SIDEBAR_MENU_BUTTON,
  SIDEBAR_MENU_SUB_BUTTON,
} from "./sidebar-kit";
import {
  SIDEBAR_FOOTER,
  SIDEBAR_GROUP,
  SIDEBAR_HEADER,
  SIDEBAR_MENU_ITEM_WITH_BADGE,
  SIDEBAR_MENU_SUB,
} from "./sidebar-section-kit";
import { SKELETON } from "./skeleton-kit";
import { SWITCH } from "./switch-kit";
import { TEXTAREA } from "./textarea-kit";
import { ICON_TOGGLE, TOGGLE } from "./toggle-kit";

/**
 * A page of the kit: one component and its close variants, such as Button and Icon button.
 * `slug` names the page in its key, `page/button`, and in its previews' keys.
 */
export type KitPage = {
  readonly slug: string;
  readonly name: string;
};

/** The page Button, Icon button and Confirm button share. */
const BUTTON_PAGE: KitPage = { slug: "button", name: "Button" };

/** The page Toggle and Icon toggle share. */
const TOGGLE_PAGE: KitPage = { slug: "toggle", name: "Toggle" };

/** The page Badge sits on alone. */
const BADGE_PAGE: KitPage = { slug: "badge", name: "Badge" };

/** The page of Kbd's key cap and the group that combines caps. */
const KBD_PAGE: KitPage = { slug: "kbd", name: "Kbd" };

/** The page of the radio controls, Radio icon button first, then Radio. */
const RADIO_PAGE: KitPage = { slug: "radio", name: "Radio" };

/** The page Checkbox sits on alone. */
const CHECKBOX_PAGE: KitPage = { slug: "checkbox", name: "Checkbox" };

/** The page Switch sits on alone. */
const SWITCH_PAGE: KitPage = { slug: "switch", name: "Switch" };

/** The page Separator sits on alone. */
const SEPARATOR_PAGE: KitPage = { slug: "separator", name: "Separator" };

/** The page Skeleton sits on alone. */
const SKELETON_PAGE: KitPage = { slug: "skeleton", name: "Skeleton" };

/** The page Loader sits on alone. */
const LOADER_PAGE: KitPage = { slug: "loader", name: "Loader" };

/**
 * The page of Field's text parts: the label, the description, the error, the legend and the title.
 * Label sat on a page of its own until they joined it.
 */
const FIELD_PAGE: KitPage = { slug: "field", name: "Field" };

/** The page of Input and the Input group that Combobox and Command render. */
const INPUT_PAGE: KitPage = { slug: "input", name: "Input" };

/** The page Textarea sits on alone. */
const TEXTAREA_PAGE: KitPage = { slug: "textarea", name: "Textarea" };

/** The page Avatar sits on alone. */
const AVATAR_PAGE: KitPage = { slug: "avatar", name: "Avatar" };

/** The page Meter sits on alone. */
const METER_PAGE: KitPage = { slug: "meter", name: "Meter" };

/** The page of Pagination's parts, the link, the edge links and the ellipsis, and the row of them. */
const PAGINATION_PAGE: KitPage = { slug: "pagination", name: "Pagination" };

/**
 * The page of Breadcrumb's parts, the link, the current page, the ellipsis and the separator, and the
 * trail of them. Its name keeps it apart from `BREADCRUMB_PAGE`, the current page's set.
 */
const BREADCRUMB_PARTS_PAGE: KitPage = { slug: "breadcrumb", name: "Breadcrumb" };

/**
 * The page of Select's parts: the trigger, the menu parts every menu family shares, the row, the
 * popup and the open Select.
 */
const SELECT_PAGE: KitPage = { slug: "select", name: "Select" };

/** The page of Popover's popup and the open Popover. */
const POPOVER_PAGE: KitPage = { slug: "popover", name: "Popover" };

/** The page of Dropdown menu's rows, until its popups and the open menu join them. */
const DROPDOWN_MENU_PAGE: KitPage = { slug: "dropdown-menu", name: "Dropdown menu" };

/** The page Empty sits on alone. */
const EMPTY_PAGE: KitPage = { slug: "empty", name: "Empty" };

/** The page of the Calendar's day cell, alone until the month frame joins it. */
const CALENDAR_PAGE: KitPage = { slug: "calendar", name: "Calendar" };

/** The page React Aria's Link sits on alone. */
const LINK_PAGE: KitPage = { slug: "link", name: "Link" };

/** The page of Item's rows, the row and the link row, until Item group joins them. */
const ITEM_PAGE: KitPage = { slug: "item", name: "Item" };

/** The page Alert sits on alone. */
const ALERT_PAGE: KitPage = { slug: "alert", name: "Alert" };

/** The page Accordion's item sits on alone, until a stacked accordion joins it. */
const ACCORDION_PAGE: KitPage = { slug: "accordion", name: "Accordion" };

/** The page of Sidebar's rows, until the panel and the icon rail join them. */
const SIDEBAR_PAGE: KitPage = { slug: "sidebar", name: "Sidebar" };

/** The page of Combobox's open state: its row, its empty message, its popup and the open input. */
const COMBOBOX_PAGE: KitPage = { slug: "combobox", name: "Combobox" };

/** The page of Command's rows and list. The palette dialog waits for a dialog surface. */
const COMMAND_PAGE: KitPage = { slug: "command", name: "Command" };

/** The page of Navigation menu's triggers, links and open popup. */
const NAVIGATION_MENU_PAGE: KitPage = { slug: "navigation-menu", name: "Navigation menu" };

/**
 * A component set of the kit, the page it sits on, and the cells its preview frames place, in
 * frame order.
 */
export type KitEntry = {
  readonly definition: ComponentDefinition;
  readonly page: KitPage;
  readonly previewCells: readonly Cell[];
};

/**
 * Every state of each variant at the base size, once for each combination of the `crossed`
 * axes' values, then each variant at rest at every other size, with each crossed axis at its
 * first value. `fixed` sets the cell's other axes.
 */
function previewCells(
  definition: ComponentDefinition,
  baseSize: string,
  fixed: Cell,
  crossed: readonly string[] = []
): Cell[] {
  const variants = axisValues(definition, "variant");
  const combinations = matrixCells(crossed.map((name) => ({ name, values: axisValues(definition, name) })));
  const resting = Object.fromEntries(crossed.map((name) => [name, axisValues(definition, name)[0] ?? ""]));
  return [
    ...variants.flatMap((variant) =>
      combinations.flatMap((combination) =>
        axisValues(definition, "state").map((state) => ({
          ...fixed,
          ...combination,
          variant,
          size: baseSize,
          state,
        }))
      )
    ),
    ...axisValues(definition, "size")
      .filter((size) => size !== baseSize)
      .flatMap((size) => variants.map((variant) => ({ ...fixed, ...resting, variant, size, state: "rest" }))),
  ];
}

/** Each variant at rest at the base size with a start icon, then with an end icon. */
function iconCells(definition: ComponentDefinition, baseSize: string, fixed: Cell): Cell[] {
  return ["start", "end"].flatMap((icon) =>
    axisValues(definition, "variant").map((variant) => ({
      ...fixed,
      variant,
      size: baseSize,
      state: "rest",
      icon,
    }))
  );
}

/** The kit's component sets, in the order the plugin places them. */
export const KIT: readonly KitEntry[] = [
  {
    definition: BUTTON,
    page: BUTTON_PAGE,
    previewCells: [...previewCells(BUTTON, "default", { icon: "none" }), ...iconCells(BUTTON, "default", {})],
  },
  { definition: ICON_BUTTON, page: BUTTON_PAGE, previewCells: previewCells(ICON_BUTTON, "icon", {}) },
  {
    definition: CONFIRM_BUTTON,
    page: BUTTON_PAGE,
    previewCells: previewCells(CONFIRM_BUTTON, "default", {}, ["armed"]),
  },
  {
    definition: TOGGLE,
    page: TOGGLE_PAGE,
    previewCells: [
      ...previewCells(TOGGLE, "default", { icon: "none" }, ["pressed"]),
      ...iconCells(TOGGLE, "default", { pressed: "off" }),
    ],
  },
  {
    definition: ICON_TOGGLE,
    page: TOGGLE_PAGE,
    previewCells: previewCells(ICON_TOGGLE, "default", {}, ["pressed"]),
  },
  // A Badge has no state, so its previews place every cell of its matrix.
  { definition: BADGE, page: BADGE_PAGE, previewCells: matrixCells(BADGE.axes) },
  { definition: KBD, page: KBD_PAGE, previewCells: matrixCells(KBD.axes) },
  { definition: KBD_GROUP, page: KBD_PAGE, previewCells: matrixCells(KBD_GROUP.axes) },
  { definition: RADIO_ICON_BUTTON, page: RADIO_PAGE, previewCells: matrixCells(RADIO_ICON_BUTTON.axes) },
  { definition: RADIO, page: RADIO_PAGE, previewCells: matrixCells(RADIO.axes) },
  { definition: CHECKBOX, page: CHECKBOX_PAGE, previewCells: matrixCells(CHECKBOX.axes) },
  { definition: SWITCH, page: SWITCH_PAGE, previewCells: matrixCells(SWITCH.axes) },
  { definition: SEPARATOR, page: SEPARATOR_PAGE, previewCells: matrixCells(SEPARATOR.axes) },
  { definition: SKELETON, page: SKELETON_PAGE, previewCells: matrixCells(SKELETON.axes) },
  { definition: LOADER, page: LOADER_PAGE, previewCells: matrixCells(LOADER.axes) },
  { definition: LABEL, page: FIELD_PAGE, previewCells: matrixCells(LABEL.axes) },
  { definition: FIELD_DESCRIPTION, page: FIELD_PAGE, previewCells: matrixCells(FIELD_DESCRIPTION.axes) },
  { definition: FIELD_ERROR, page: FIELD_PAGE, previewCells: matrixCells(FIELD_ERROR.axes) },
  { definition: FIELD_LEGEND, page: FIELD_PAGE, previewCells: matrixCells(FIELD_LEGEND.axes) },
  { definition: FIELD_TITLE, page: FIELD_PAGE, previewCells: matrixCells(FIELD_TITLE.axes) },
  { definition: INPUT, page: INPUT_PAGE, previewCells: matrixCells(INPUT.axes) },
  { definition: INPUT_GROUP, page: INPUT_PAGE, previewCells: matrixCells(INPUT_GROUP.axes) },
  { definition: TEXTAREA, page: TEXTAREA_PAGE, previewCells: matrixCells(TEXTAREA.axes) },
  { definition: AVATAR, page: AVATAR_PAGE, previewCells: matrixCells(AVATAR.axes) },
  { definition: METER, page: METER_PAGE, previewCells: matrixCells(METER.axes) },
  { definition: PAGINATION_LINK, page: PAGINATION_PAGE, previewCells: matrixCells(PAGINATION_LINK.axes) },
  { definition: PAGINATION_EDGE, page: PAGINATION_PAGE, previewCells: matrixCells(PAGINATION_EDGE.axes) },
  {
    definition: PAGINATION_ELLIPSIS,
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_ELLIPSIS.axes),
  },
  { definition: PAGINATION_ROW, page: PAGINATION_PAGE, previewCells: matrixCells(PAGINATION_ROW.axes) },
  {
    definition: BREADCRUMB_LINK,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_LINK.axes),
  },
  {
    definition: BREADCRUMB_PAGE,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_PAGE.axes),
  },
  {
    definition: BREADCRUMB_ELLIPSIS,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_ELLIPSIS.axes),
  },
  {
    definition: BREADCRUMB_SEPARATOR,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_SEPARATOR.axes),
  },
  {
    definition: BREADCRUMB_TRAIL,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_TRAIL.axes),
  },
  { definition: SELECT_TRIGGER, page: SELECT_PAGE, previewCells: matrixCells(SELECT_TRIGGER.axes) },
  { definition: MENU_GROUP_LABEL, page: SELECT_PAGE, previewCells: matrixCells(MENU_GROUP_LABEL.axes) },
  { definition: MENU_SEPARATOR, page: SELECT_PAGE, previewCells: matrixCells(MENU_SEPARATOR.axes) },
  { definition: SELECT_ITEM, page: SELECT_PAGE, previewCells: matrixCells(SELECT_ITEM.axes) },
  { definition: SELECT_POPUP, page: SELECT_PAGE, previewCells: matrixCells(SELECT_POPUP.axes) },
  { definition: SELECT_OPEN, page: SELECT_PAGE, previewCells: matrixCells(SELECT_OPEN.axes) },
  { definition: POPOVER_CONTENT, page: POPOVER_PAGE, previewCells: matrixCells(POPOVER_CONTENT.axes) },
  { definition: POPOVER_OPEN, page: POPOVER_PAGE, previewCells: matrixCells(POPOVER_OPEN.axes) },
  {
    definition: DROPDOWN_MENU_ITEM,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_ITEM.axes),
  },
  {
    definition: DROPDOWN_MENU_CHECKBOX_ITEM,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_CHECKBOX_ITEM.axes),
  },
  {
    definition: DROPDOWN_MENU_RADIO_ITEM,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_RADIO_ITEM.axes),
  },
  {
    definition: DROPDOWN_MENU_SUB_TRIGGER,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_SUB_TRIGGER.axes),
  },
  {
    definition: DROPDOWN_MENU_POPUP,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_POPUP.axes),
  },
  {
    definition: DROPDOWN_MENU_SUB_CONTENT,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_SUB_CONTENT.axes),
  },
  {
    definition: DROPDOWN_MENU_OPEN,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_OPEN.axes),
  },
  { definition: COMBOBOX_ITEM, page: COMBOBOX_PAGE, previewCells: matrixCells(COMBOBOX_ITEM.axes) },
  { definition: COMBOBOX_EMPTY, page: COMBOBOX_PAGE, previewCells: matrixCells(COMBOBOX_EMPTY.axes) },
  { definition: COMBOBOX_POPUP, page: COMBOBOX_PAGE, previewCells: matrixCells(COMBOBOX_POPUP.axes) },
  { definition: COMBOBOX_OPEN, page: COMBOBOX_PAGE, previewCells: matrixCells(COMBOBOX_OPEN.axes) },
  { definition: COMMAND_ITEM, page: COMMAND_PAGE, previewCells: matrixCells(COMMAND_ITEM.axes) },
  { definition: COMMAND_LIST, page: COMMAND_PAGE, previewCells: matrixCells(COMMAND_LIST.axes) },
  { definition: EMPTY, page: EMPTY_PAGE, previewCells: matrixCells(EMPTY.axes) },
  { definition: CALENDAR_DAY, page: CALENDAR_PAGE, previewCells: matrixCells(CALENDAR_DAY.axes) },
  { definition: LINK, page: LINK_PAGE, previewCells: matrixCells(LINK.axes) },
  { definition: ITEM, page: ITEM_PAGE, previewCells: matrixCells(ITEM.axes) },
  { definition: ITEM_LINK, page: ITEM_PAGE, previewCells: matrixCells(ITEM_LINK.axes) },
  { definition: ALERT, page: ALERT_PAGE, previewCells: matrixCells(ALERT.axes) },
  { definition: ACCORDION_ITEM, page: ACCORDION_PAGE, previewCells: matrixCells(ACCORDION_ITEM.axes) },
  {
    definition: SIDEBAR_MENU_BUTTON,
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_BUTTON.axes),
  },
  {
    definition: SIDEBAR_MENU_SUB_BUTTON,
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_SUB_BUTTON.axes),
  },
  {
    definition: SIDEBAR_GROUP_LABEL,
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_GROUP_LABEL.axes),
  },
  { definition: SIDEBAR_MENU_BADGE, page: SIDEBAR_PAGE, previewCells: matrixCells(SIDEBAR_MENU_BADGE.axes) },
  { definition: SIDEBAR_GROUP, page: SIDEBAR_PAGE, previewCells: matrixCells(SIDEBAR_GROUP.axes) },
  { definition: SIDEBAR_HEADER, page: SIDEBAR_PAGE, previewCells: matrixCells(SIDEBAR_HEADER.axes) },
  { definition: SIDEBAR_FOOTER, page: SIDEBAR_PAGE, previewCells: matrixCells(SIDEBAR_FOOTER.axes) },
  { definition: SIDEBAR_MENU_SUB, page: SIDEBAR_PAGE, previewCells: matrixCells(SIDEBAR_MENU_SUB.axes) },
  {
    definition: SIDEBAR_MENU_ITEM_WITH_BADGE,
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_ITEM_WITH_BADGE.axes),
  },
  {
    definition: NAVIGATION_MENU_BAR_TRIGGER,
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_BAR_TRIGGER.axes),
  },
  {
    definition: NAVIGATION_MENU_VERTICAL_TRIGGER,
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_VERTICAL_TRIGGER.axes),
  },
  {
    definition: NAVIGATION_MENU_BAR_LINK,
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_BAR_LINK.axes),
  },
  {
    definition: NAVIGATION_MENU_ROW_LINK,
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_ROW_LINK.axes),
  },
  {
    definition: NAVIGATION_MENU_POPUP,
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_POPUP.axes),
  },
];
