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
import type { SetManifest } from "../capture/manifest";
import { ACCORDION_ITEM_MANIFEST } from "./accordion-kit";
import { ALERT_DIALOG_CONTENT_MANIFEST, ALERT_DIALOG_OPEN_MANIFEST } from "./alert-dialog-kit";
import { ALERT_MANIFEST } from "./alert-kit";
import { AVATAR_GROUP_MANIFEST, AVATAR_MANIFEST } from "./avatar-kit";
import { BADGE_MANIFEST } from "./badge-kit";
import {
  BREADCRUMB_ELLIPSIS_MANIFEST,
  BREADCRUMB_LINK_MANIFEST,
  BREADCRUMB_PAGE_MANIFEST,
  BREADCRUMB_SEPARATOR_MANIFEST,
  BREADCRUMB_TRAIL_MANIFEST,
} from "./breadcrumb-kit";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import { CHECKBOX_MANIFEST } from "./checkbox-kit";
import {
  COMBOBOX_EMPTY_MANIFEST,
  COMBOBOX_ITEM_MANIFEST,
  COMBOBOX_OPEN_MANIFEST,
  COMBOBOX_POPUP_MANIFEST,
} from "./combobox-kit";
import { COMMAND_DIALOG_OPEN_MANIFEST, COMMAND_PALETTE_MANIFEST } from "./command-dialog-kit";
import { COMMAND_ITEM_MANIFEST, COMMAND_LIST_MANIFEST } from "./command-kit";
import { matrixCells } from "./component-spec";
import type { Cell } from "./component-spec";
import { CONFIRM_BUTTON_MANIFEST } from "./confirm-button-kit";
import { DIALOG_CONTENT_MANIFEST, DIALOG_OPEN_MANIFEST } from "./dialog-kit";
import {
  DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST,
  DROPDOWN_MENU_ITEM_MANIFEST,
  DROPDOWN_MENU_RADIO_ITEM_MANIFEST,
  DROPDOWN_MENU_SUB_TRIGGER_MANIFEST,
} from "./dropdown-menu-kit";
import {
  DROPDOWN_MENU_OPEN_MANIFEST,
  DROPDOWN_MENU_POPUP_MANIFEST,
  DROPDOWN_MENU_SUB_CONTENT_MANIFEST,
} from "./dropdown-popup-kit";
import { EMPTY_MANIFEST } from "./empty-kit";
import {
  FIELD_DESCRIPTION_MANIFEST,
  FIELD_ERROR_MANIFEST,
  FIELD_LEGEND_MANIFEST,
  FIELD_TITLE_MANIFEST,
} from "./field-text-kit";
import { FILE_UPLOAD_DROPZONE_MANIFEST } from "./file-upload-kit";
import { INPUT_GROUP_MANIFEST } from "./input-group-kit";
import { INPUT_MANIFEST } from "./input-kit";
import { ITEM_LINK_MANIFEST, ITEM_MANIFEST } from "./item-kit";
import { KBD_GROUP_MANIFEST, KBD_MANIFEST } from "./kbd-kit";
import { axisValues } from "./kit-spec";
import type { AxisSpec } from "./kit-spec";
import { LABEL_MANIFEST } from "./label-kit";
import { LINK_MANIFEST } from "./link-kit";
import { LOADER_MANIFEST } from "./loader-kit";
import { MENU_GROUP_LABEL_MANIFEST, MENU_SEPARATOR_MANIFEST } from "./menu-kit";
import { METER_MANIFEST } from "./meter-kit";
import {
  NAVIGATION_MENU_BAR_LINK_MANIFEST,
  NAVIGATION_MENU_BAR_TRIGGER_MANIFEST,
  NAVIGATION_MENU_ROW_LINK_MANIFEST,
  NAVIGATION_MENU_VERTICAL_TRIGGER_MANIFEST,
} from "./navigation-menu-kit";
import { NAVIGATION_MENU_POPUP_MANIFEST } from "./navigation-menu-popup-kit";
import { NUMBER_FIELD_MANIFEST, NUMBER_FIELD_STEPPER_MANIFEST } from "./number-field-kit";
import {
  PAGINATION_EDGE_MANIFEST,
  PAGINATION_ELLIPSIS_MANIFEST,
  PAGINATION_LINK_MANIFEST,
  PAGINATION_ROW_MANIFEST,
} from "./pagination-kit";
import { POPOVER_CONTENT_MANIFEST, POPOVER_OPEN_MANIFEST } from "./popover-kit";
import { RADIO_GROUP_MANIFEST } from "./radio-group-kit";
import { RADIO_ICON_BUTTON_MANIFEST } from "./radio-icon-button-kit";
import { RADIO_MANIFEST } from "./radio-kit";
import { RADIO_ROW_MANIFEST } from "./radio-row-kit";
import { SELECT_FIELD_MANIFEST } from "./select-field-kit";
import { SELECT_ITEM_MANIFEST, SELECT_OPEN_MANIFEST, SELECT_POPUP_MANIFEST } from "./select-kit";
import { SELECT_TRIGGER_MANIFEST } from "./select-trigger-kit";
import { SEPARATOR_MANIFEST } from "./separator-kit";
import {
  SIDEBAR_GROUP_LABEL_MANIFEST,
  SIDEBAR_MENU_BADGE_MANIFEST,
  SIDEBAR_MENU_BUTTON_MANIFEST,
  SIDEBAR_MENU_SUB_BUTTON_MANIFEST,
} from "./sidebar-kit";
import { SIDEBAR_MANIFEST } from "./sidebar-panel-kit";
import {
  SIDEBAR_FOOTER_MANIFEST,
  SIDEBAR_GROUP_MANIFEST,
  SIDEBAR_HEADER_MANIFEST,
  SIDEBAR_MENU_ITEM_WITH_BADGE_MANIFEST,
  SIDEBAR_MENU_SUB_MANIFEST,
} from "./sidebar-section-kit";
import { SKELETON_MANIFEST } from "./skeleton-kit";
import { SWITCH_MANIFEST } from "./switch-kit";
import { TEXT_FIELD_MANIFEST } from "./text-field-kit";
import { TEXTAREA_FIELD_MANIFEST } from "./textarea-field-kit";
import { TEXTAREA_MANIFEST } from "./textarea-kit";
import { TOGGLE_GROUP_MANIFEST } from "./toggle-group-kit";
import { ICON_TOGGLE_MANIFEST, TOGGLE_MANIFEST } from "./toggle-kit";
import { TOOLBAR_MANIFEST } from "./toolbar-kit";
import { TOOLTIP_CONTENT_MANIFEST, TOOLTIP_OPEN_MANIFEST } from "./tooltip-kit";

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

/** The page of Input, the Input group that Combobox and Command render, and the labelled Text field. */
const INPUT_PAGE: KitPage = { slug: "input", name: "Input" };

/** The page of Textarea and the labelled Textarea field. */
const TEXTAREA_PAGE: KitPage = { slug: "textarea", name: "Textarea" };

/** The page of Alert dialog. */
const ALERT_DIALOG_PAGE: KitPage = { slug: "alert-dialog", name: "Alert dialog" };

/** The page of Dialog. */
const DIALOG_PAGE: KitPage = { slug: "dialog", name: "Dialog" };

/** The page of Tooltip. */
const TOOLTIP_PAGE: KitPage = { slug: "tooltip", name: "Tooltip" };

/** The page of Toolbar. */
const TOOLBAR_PAGE: KitPage = { slug: "toolbar", name: "Toolbar" };

/** The page of File upload's dropzone. */
const FILE_UPLOAD_PAGE: KitPage = { slug: "file-upload", name: "File upload" };

/** The page of Number field and its stepper. */
const NUMBER_FIELD_PAGE: KitPage = { slug: "number-field", name: "Number field" };

/** The page of Avatar and the group that stacks avatars. */
const AVATAR_PAGE: KitPage = { slug: "avatar", name: "Avatar" };

/** The page Meter sits on alone. */
const METER_PAGE: KitPage = { slug: "meter", name: "Meter" };

/** The page of Pagination's parts, the link, the edge links and the ellipsis, and the row of them. */
const PAGINATION_PAGE: KitPage = { slug: "pagination", name: "Pagination" };

/**
 * The page of Breadcrumb's parts, the link, the current page, the ellipsis and the separator, and the
 * trail of them. Its name keeps it apart from `BREADCRUMB_PAGE_MANIFEST`, the current page's set.
 */
const BREADCRUMB_PARTS_PAGE: KitPage = { slug: "breadcrumb", name: "Breadcrumb" };

/**
 * The page of Select's parts: the trigger, the menu parts every menu family shares, the row, the
 * popup and the open Select.
 */
const SELECT_PAGE: KitPage = { slug: "select", name: "Select" };

/** The page of Popover's popup and the open Popover. */
const POPOVER_PAGE: KitPage = { slug: "popover", name: "Popover" };

/** The page of Dropdown menu's rows, its popups and the open menu. */
const DROPDOWN_MENU_PAGE: KitPage = { slug: "dropdown-menu", name: "Dropdown menu" };

/** The page Empty sits on alone. */
const EMPTY_PAGE: KitPage = { slug: "empty", name: "Empty" };

/** The page Link sits on alone. */
const LINK_PAGE: KitPage = { slug: "link", name: "Link" };

/** The page of Item's rows, the row and the link row, until Item group joins them. */
const ITEM_PAGE: KitPage = { slug: "item", name: "Item" };

/** The page Alert sits on alone. */
const ALERT_PAGE: KitPage = { slug: "alert", name: "Alert" };

/** The page Accordion's item sits on alone, until a stacked accordion joins it. */
const ACCORDION_PAGE: KitPage = { slug: "accordion", name: "Accordion" };

/** The page of Sidebar's rows and sections, and of the panel, expanded and collapsed to its icon rail. */
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
  readonly page: KitPage;
  readonly previewCells: readonly Cell[];
  /** The set's manifest, which the build reads with the set's capture in `captures/`. */
  readonly manifest: SetManifest;
};

/**
 * Every state of each variant at the base size, once for each combination of the `crossed`
 * axes' values, then each variant at rest at every other size, with each crossed axis at its
 * first value. `fixed` sets the cell's other axes.
 */
function previewCells(
  definition: { readonly axes: readonly AxisSpec[] },
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
function iconCells(
  definition: { readonly axes: readonly AxisSpec[] },
  baseSize: string,
  fixed: Cell
): Cell[] {
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
    page: BUTTON_PAGE,
    previewCells: [
      ...previewCells(BUTTON_MANIFEST, "default", { icon: "none" }),
      ...iconCells(BUTTON_MANIFEST, "default", {}),
    ],
    manifest: BUTTON_MANIFEST,
  },
  {
    page: BUTTON_PAGE,
    previewCells: previewCells(ICON_BUTTON_MANIFEST, "icon", {}),
    manifest: ICON_BUTTON_MANIFEST,
  },
  {
    page: BUTTON_PAGE,
    previewCells: previewCells(CONFIRM_BUTTON_MANIFEST, "default", {}, ["armed"]),
    manifest: CONFIRM_BUTTON_MANIFEST,
  },
  {
    page: TOGGLE_PAGE,
    previewCells: [
      ...previewCells(TOGGLE_MANIFEST, "default", { icon: "none" }, ["pressed"]),
      ...iconCells(TOGGLE_MANIFEST, "default", { pressed: "off" }),
    ],
    manifest: TOGGLE_MANIFEST,
  },
  {
    page: TOGGLE_PAGE,
    previewCells: previewCells(ICON_TOGGLE_MANIFEST, "default", {}, ["pressed"]),
    manifest: ICON_TOGGLE_MANIFEST,
  },
  // A spaced Toggle group has no state, so its previews place every cell of its matrix.
  {
    page: TOGGLE_PAGE,
    previewCells: matrixCells(TOGGLE_GROUP_MANIFEST.axes),
    manifest: TOGGLE_GROUP_MANIFEST,
  },
  // A Badge has no state, so its previews place every cell of its matrix.
  {
    page: BADGE_PAGE,
    previewCells: matrixCells(BADGE_MANIFEST.axes),
    manifest: BADGE_MANIFEST,
  },
  {
    page: KBD_PAGE,
    previewCells: matrixCells(KBD_MANIFEST.axes),
    manifest: KBD_MANIFEST,
  },
  {
    page: KBD_PAGE,
    previewCells: matrixCells(KBD_GROUP_MANIFEST.axes),
    manifest: KBD_GROUP_MANIFEST,
  },
  {
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO_ICON_BUTTON_MANIFEST.axes),
    manifest: RADIO_ICON_BUTTON_MANIFEST,
  },
  {
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO_MANIFEST.axes),
    manifest: RADIO_MANIFEST,
  },
  {
    page: CHECKBOX_PAGE,
    previewCells: matrixCells(CHECKBOX_MANIFEST.axes),
    manifest: CHECKBOX_MANIFEST,
  },
  {
    page: SWITCH_PAGE,
    previewCells: matrixCells(SWITCH_MANIFEST.axes),
    manifest: SWITCH_MANIFEST,
  },
  {
    page: SEPARATOR_PAGE,
    previewCells: matrixCells(SEPARATOR_MANIFEST.axes),
    manifest: SEPARATOR_MANIFEST,
  },
  {
    page: SKELETON_PAGE,
    previewCells: matrixCells(SKELETON_MANIFEST.axes),
    manifest: SKELETON_MANIFEST,
  },
  {
    page: LOADER_PAGE,
    previewCells: matrixCells(LOADER_MANIFEST.axes),
    manifest: LOADER_MANIFEST,
  },
  { page: FIELD_PAGE, previewCells: matrixCells(LABEL_MANIFEST.axes), manifest: LABEL_MANIFEST },
  {
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_DESCRIPTION_MANIFEST.axes),
    manifest: FIELD_DESCRIPTION_MANIFEST,
  },
  {
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_ERROR_MANIFEST.axes),
    manifest: FIELD_ERROR_MANIFEST,
  },
  {
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_LEGEND_MANIFEST.axes),
    manifest: FIELD_LEGEND_MANIFEST,
  },
  {
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_TITLE_MANIFEST.axes),
    manifest: FIELD_TITLE_MANIFEST,
  },
  // The labelled radio rows and the group, which show Field's legend, description and error.
  {
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO_ROW_MANIFEST.axes),
    manifest: RADIO_ROW_MANIFEST,
  },
  {
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO_GROUP_MANIFEST.axes),
    manifest: RADIO_GROUP_MANIFEST,
  },
  { page: INPUT_PAGE, previewCells: matrixCells(INPUT_MANIFEST.axes), manifest: INPUT_MANIFEST },
  {
    page: INPUT_PAGE,
    previewCells: matrixCells(INPUT_GROUP_MANIFEST.axes),
    manifest: INPUT_GROUP_MANIFEST,
  },
  {
    page: INPUT_PAGE,
    previewCells: matrixCells(TEXT_FIELD_MANIFEST.axes),
    manifest: TEXT_FIELD_MANIFEST,
  },
  {
    page: TEXTAREA_PAGE,
    previewCells: matrixCells(TEXTAREA_MANIFEST.axes),
    manifest: TEXTAREA_MANIFEST,
  },
  {
    page: TEXTAREA_PAGE,
    previewCells: matrixCells(TEXTAREA_FIELD_MANIFEST.axes),
    manifest: TEXTAREA_FIELD_MANIFEST,
  },
  {
    page: AVATAR_PAGE,
    previewCells: matrixCells(AVATAR_MANIFEST.axes),
    manifest: AVATAR_MANIFEST,
  },
  {
    page: AVATAR_PAGE,
    previewCells: matrixCells(AVATAR_GROUP_MANIFEST.axes),
    manifest: AVATAR_GROUP_MANIFEST,
  },
  {
    page: METER_PAGE,
    previewCells: matrixCells(METER_MANIFEST.axes),
    manifest: METER_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_LINK_MANIFEST.axes),
    manifest: PAGINATION_LINK_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_EDGE_MANIFEST.axes),
    manifest: PAGINATION_EDGE_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_ELLIPSIS_MANIFEST.axes),
    manifest: PAGINATION_ELLIPSIS_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_ROW_MANIFEST.axes),
    manifest: PAGINATION_ROW_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_LINK_MANIFEST.axes),
    manifest: BREADCRUMB_LINK_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_PAGE_MANIFEST.axes),
    manifest: BREADCRUMB_PAGE_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_ELLIPSIS_MANIFEST.axes),
    manifest: BREADCRUMB_ELLIPSIS_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_SEPARATOR_MANIFEST.axes),
    manifest: BREADCRUMB_SEPARATOR_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_TRAIL_MANIFEST.axes),
    manifest: BREADCRUMB_TRAIL_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_TRIGGER_MANIFEST.axes),
    manifest: SELECT_TRIGGER_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_FIELD_MANIFEST.axes),
    manifest: SELECT_FIELD_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: matrixCells(MENU_GROUP_LABEL_MANIFEST.axes),
    manifest: MENU_GROUP_LABEL_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: matrixCells(MENU_SEPARATOR_MANIFEST.axes),
    manifest: MENU_SEPARATOR_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_ITEM_MANIFEST.axes),
    manifest: SELECT_ITEM_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_POPUP_MANIFEST.axes),
    manifest: SELECT_POPUP_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_OPEN_MANIFEST.axes),
    manifest: SELECT_OPEN_MANIFEST,
  },
  {
    page: POPOVER_PAGE,
    previewCells: matrixCells(POPOVER_CONTENT_MANIFEST.axes),
    manifest: POPOVER_CONTENT_MANIFEST,
  },
  {
    page: POPOVER_PAGE,
    previewCells: matrixCells(POPOVER_OPEN_MANIFEST.axes),
    manifest: POPOVER_OPEN_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_ITEM_MANIFEST.axes),
    manifest: DROPDOWN_MENU_ITEM_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST.axes),
    manifest: DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_RADIO_ITEM_MANIFEST.axes),
    manifest: DROPDOWN_MENU_RADIO_ITEM_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_SUB_TRIGGER_MANIFEST.axes),
    manifest: DROPDOWN_MENU_SUB_TRIGGER_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_POPUP_MANIFEST.axes),
    manifest: DROPDOWN_MENU_POPUP_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_SUB_CONTENT_MANIFEST.axes),
    manifest: DROPDOWN_MENU_SUB_CONTENT_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_OPEN_MANIFEST.axes),
    manifest: DROPDOWN_MENU_OPEN_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_ITEM_MANIFEST.axes),
    manifest: COMBOBOX_ITEM_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_EMPTY_MANIFEST.axes),
    manifest: COMBOBOX_EMPTY_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_POPUP_MANIFEST.axes),
    manifest: COMBOBOX_POPUP_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_OPEN_MANIFEST.axes),
    manifest: COMBOBOX_OPEN_MANIFEST,
  },
  {
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_ITEM_MANIFEST.axes),
    manifest: COMMAND_ITEM_MANIFEST,
  },
  {
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_LIST_MANIFEST.axes),
    manifest: COMMAND_LIST_MANIFEST,
  },
  // The palette and its open example, drawn from the Input group, Kbd and Command item sets above.
  {
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_PALETTE_MANIFEST.axes),
    manifest: COMMAND_PALETTE_MANIFEST,
  },
  {
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_DIALOG_OPEN_MANIFEST.axes),
    manifest: COMMAND_DIALOG_OPEN_MANIFEST,
  },
  {
    page: EMPTY_PAGE,
    previewCells: matrixCells(EMPTY_MANIFEST.axes),
    manifest: EMPTY_MANIFEST,
  },
  {
    page: LINK_PAGE,
    previewCells: matrixCells(LINK_MANIFEST.axes),
    manifest: LINK_MANIFEST,
  },
  {
    page: ITEM_PAGE,
    previewCells: matrixCells(ITEM_MANIFEST.axes),
    manifest: ITEM_MANIFEST,
  },
  {
    page: ITEM_PAGE,
    previewCells: matrixCells(ITEM_LINK_MANIFEST.axes),
    manifest: ITEM_LINK_MANIFEST,
  },
  { page: ALERT_PAGE, previewCells: matrixCells(ALERT_MANIFEST.axes), manifest: ALERT_MANIFEST },
  {
    page: ACCORDION_PAGE,
    previewCells: matrixCells(ACCORDION_ITEM_MANIFEST.axes),
    manifest: ACCORDION_ITEM_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_BUTTON_MANIFEST.axes),
    manifest: SIDEBAR_MENU_BUTTON_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_SUB_BUTTON_MANIFEST.axes),
    manifest: SIDEBAR_MENU_SUB_BUTTON_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_GROUP_LABEL_MANIFEST.axes),
    manifest: SIDEBAR_GROUP_LABEL_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_BADGE_MANIFEST.axes),
    manifest: SIDEBAR_MENU_BADGE_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_GROUP_MANIFEST.axes),
    manifest: SIDEBAR_GROUP_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_HEADER_MANIFEST.axes),
    manifest: SIDEBAR_HEADER_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_FOOTER_MANIFEST.axes),
    manifest: SIDEBAR_FOOTER_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_SUB_MANIFEST.axes),
    manifest: SIDEBAR_MENU_SUB_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MENU_ITEM_WITH_BADGE_MANIFEST.axes),
    manifest: SIDEBAR_MENU_ITEM_WITH_BADGE_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: matrixCells(SIDEBAR_MANIFEST.axes),
    manifest: SIDEBAR_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_BAR_TRIGGER_MANIFEST.axes),
    manifest: NAVIGATION_MENU_BAR_TRIGGER_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_VERTICAL_TRIGGER_MANIFEST.axes),
    manifest: NAVIGATION_MENU_VERTICAL_TRIGGER_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_BAR_LINK_MANIFEST.axes),
    manifest: NAVIGATION_MENU_BAR_LINK_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_ROW_LINK_MANIFEST.axes),
    manifest: NAVIGATION_MENU_ROW_LINK_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: matrixCells(NAVIGATION_MENU_POPUP_MANIFEST.axes),
    manifest: NAVIGATION_MENU_POPUP_MANIFEST,
  },
  {
    page: NUMBER_FIELD_PAGE,
    previewCells: matrixCells(NUMBER_FIELD_STEPPER_MANIFEST.axes),
    manifest: NUMBER_FIELD_STEPPER_MANIFEST,
  },
  {
    page: NUMBER_FIELD_PAGE,
    previewCells: matrixCells(NUMBER_FIELD_MANIFEST.axes),
    manifest: NUMBER_FIELD_MANIFEST,
  },
  {
    page: FILE_UPLOAD_PAGE,
    previewCells: matrixCells(FILE_UPLOAD_DROPZONE_MANIFEST.axes),
    manifest: FILE_UPLOAD_DROPZONE_MANIFEST,
  },
  {
    page: TOOLBAR_PAGE,
    previewCells: matrixCells(TOOLBAR_MANIFEST.axes),
    manifest: TOOLBAR_MANIFEST,
  },
  {
    page: TOOLTIP_PAGE,
    previewCells: matrixCells(TOOLTIP_CONTENT_MANIFEST.axes),
    manifest: TOOLTIP_CONTENT_MANIFEST,
  },
  {
    page: TOOLTIP_PAGE,
    previewCells: matrixCells(TOOLTIP_OPEN_MANIFEST.axes),
    manifest: TOOLTIP_OPEN_MANIFEST,
  },
  {
    page: ALERT_DIALOG_PAGE,
    previewCells: matrixCells(ALERT_DIALOG_CONTENT_MANIFEST.axes),
    manifest: ALERT_DIALOG_CONTENT_MANIFEST,
  },
  {
    page: ALERT_DIALOG_PAGE,
    previewCells: matrixCells(ALERT_DIALOG_OPEN_MANIFEST.axes),
    manifest: ALERT_DIALOG_OPEN_MANIFEST,
  },
  {
    page: DIALOG_PAGE,
    previewCells: matrixCells(DIALOG_CONTENT_MANIFEST.axes),
    manifest: DIALOG_CONTENT_MANIFEST,
  },
  {
    page: DIALOG_PAGE,
    previewCells: matrixCells(DIALOG_OPEN_MANIFEST.axes),
    manifest: DIALOG_OPEN_MANIFEST,
  },
];
