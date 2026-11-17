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
import { ACCORDION_ITEM, ACCORDION_ITEM_MANIFEST } from "./accordion-kit";
import {
  ALERT_DIALOG_CONTENT,
  ALERT_DIALOG_CONTENT_MANIFEST,
  ALERT_DIALOG_OPEN,
  ALERT_DIALOG_OPEN_MANIFEST,
} from "./alert-dialog-kit";
import { ALERT, ALERT_MANIFEST } from "./alert-kit";
import { AVATAR, AVATAR_GROUP, AVATAR_GROUP_MANIFEST, AVATAR_MANIFEST } from "./avatar-kit";
import { BADGE, BADGE_MANIFEST } from "./badge-kit";
import {
  BREADCRUMB_ELLIPSIS,
  BREADCRUMB_ELLIPSIS_MANIFEST,
  BREADCRUMB_LINK,
  BREADCRUMB_LINK_MANIFEST,
  BREADCRUMB_PAGE,
  BREADCRUMB_PAGE_MANIFEST,
  BREADCRUMB_SEPARATOR,
  BREADCRUMB_SEPARATOR_MANIFEST,
  BREADCRUMB_TRAIL,
  BREADCRUMB_TRAIL_MANIFEST,
} from "./breadcrumb-kit";
import { BUTTON, BUTTON_MANIFEST, ICON_BUTTON, ICON_BUTTON_MANIFEST } from "./button-kit";
import { CHECKBOX, CHECKBOX_MANIFEST } from "./checkbox-kit";
import {
  COMBOBOX_EMPTY,
  COMBOBOX_EMPTY_MANIFEST,
  COMBOBOX_ITEM,
  COMBOBOX_ITEM_MANIFEST,
  COMBOBOX_OPEN,
  COMBOBOX_OPEN_MANIFEST,
  COMBOBOX_POPUP,
  COMBOBOX_POPUP_MANIFEST,
} from "./combobox-kit";
import {
  COMMAND_DIALOG_OPEN,
  COMMAND_DIALOG_OPEN_MANIFEST,
  COMMAND_PALETTE,
  COMMAND_PALETTE_MANIFEST,
} from "./command-dialog-kit";
import { COMMAND_ITEM, COMMAND_ITEM_MANIFEST, COMMAND_LIST, COMMAND_LIST_MANIFEST } from "./command-kit";
import { matrixCells } from "./component-spec";
import type { Cell, ComponentDefinition } from "./component-spec";
import { CONFIRM_BUTTON, CONFIRM_BUTTON_MANIFEST } from "./confirm-button-kit";
import { DIALOG_CONTENT, DIALOG_CONTENT_MANIFEST, DIALOG_OPEN, DIALOG_OPEN_MANIFEST } from "./dialog-kit";
import {
  DROPDOWN_MENU_CHECKBOX_ITEM,
  DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST,
  DROPDOWN_MENU_ITEM,
  DROPDOWN_MENU_ITEM_MANIFEST,
  DROPDOWN_MENU_RADIO_ITEM,
  DROPDOWN_MENU_RADIO_ITEM_MANIFEST,
  DROPDOWN_MENU_SUB_TRIGGER,
  DROPDOWN_MENU_SUB_TRIGGER_MANIFEST,
} from "./dropdown-menu-kit";
import {
  DROPDOWN_MENU_OPEN,
  DROPDOWN_MENU_OPEN_MANIFEST,
  DROPDOWN_MENU_POPUP,
  DROPDOWN_MENU_POPUP_MANIFEST,
  DROPDOWN_MENU_SUB_CONTENT,
  DROPDOWN_MENU_SUB_CONTENT_MANIFEST,
} from "./dropdown-popup-kit";
import { EMPTY, EMPTY_MANIFEST } from "./empty-kit";
import {
  FIELD_DESCRIPTION,
  FIELD_DESCRIPTION_MANIFEST,
  FIELD_ERROR,
  FIELD_ERROR_MANIFEST,
  FIELD_LEGEND,
  FIELD_LEGEND_MANIFEST,
  FIELD_TITLE,
  FIELD_TITLE_MANIFEST,
} from "./field-text-kit";
import { FILE_UPLOAD_DROPZONE, FILE_UPLOAD_DROPZONE_MANIFEST } from "./file-upload-kit";
import { INPUT_GROUP, INPUT_GROUP_MANIFEST } from "./input-group-kit";
import { INPUT, INPUT_MANIFEST } from "./input-kit";
import { ITEM, ITEM_LINK, ITEM_LINK_MANIFEST, ITEM_MANIFEST } from "./item-kit";
import { KBD, KBD_GROUP, KBD_GROUP_MANIFEST, KBD_MANIFEST } from "./kbd-kit";
import { axisValues } from "./kit-spec";
import { LABEL, LABEL_MANIFEST } from "./label-kit";
import { LINK, LINK_MANIFEST } from "./link-kit";
import { LOADER, LOADER_MANIFEST } from "./loader-kit";
import {
  MENU_GROUP_LABEL,
  MENU_GROUP_LABEL_MANIFEST,
  MENU_SEPARATOR,
  MENU_SEPARATOR_MANIFEST,
} from "./menu-kit";
import { METER, METER_MANIFEST } from "./meter-kit";
import {
  NAVIGATION_MENU_BAR_LINK,
  NAVIGATION_MENU_BAR_TRIGGER,
  NAVIGATION_MENU_ROW_LINK,
  NAVIGATION_MENU_VERTICAL_TRIGGER,
} from "./navigation-menu-kit";
import { NAVIGATION_MENU_POPUP } from "./navigation-menu-popup-kit";
import {
  NUMBER_FIELD,
  NUMBER_FIELD_MANIFEST,
  NUMBER_FIELD_STEPPER,
  NUMBER_FIELD_STEPPER_MANIFEST,
} from "./number-field-kit";
import {
  PAGINATION_EDGE,
  PAGINATION_EDGE_MANIFEST,
  PAGINATION_ELLIPSIS,
  PAGINATION_ELLIPSIS_MANIFEST,
  PAGINATION_LINK,
  PAGINATION_LINK_MANIFEST,
  PAGINATION_ROW,
  PAGINATION_ROW_MANIFEST,
} from "./pagination-kit";
import {
  POPOVER_CONTENT,
  POPOVER_CONTENT_MANIFEST,
  POPOVER_OPEN,
  POPOVER_OPEN_MANIFEST,
} from "./popover-kit";
import { RADIO_GROUP, RADIO_GROUP_MANIFEST } from "./radio-group-kit";
import { RADIO_ICON_BUTTON, RADIO_ICON_BUTTON_MANIFEST } from "./radio-icon-button-kit";
import { RADIO, RADIO_MANIFEST } from "./radio-kit";
import { RADIO_ROW, RADIO_ROW_MANIFEST } from "./radio-row-kit";
import { SELECT_FIELD, SELECT_FIELD_MANIFEST } from "./select-field-kit";
import {
  SELECT_ITEM,
  SELECT_ITEM_MANIFEST,
  SELECT_OPEN,
  SELECT_OPEN_MANIFEST,
  SELECT_POPUP,
  SELECT_POPUP_MANIFEST,
} from "./select-kit";
import { SELECT_TRIGGER, SELECT_TRIGGER_MANIFEST } from "./select-trigger-kit";
import { SEPARATOR, SEPARATOR_MANIFEST } from "./separator-kit";
import {
  SIDEBAR_GROUP_LABEL,
  SIDEBAR_MENU_BADGE,
  SIDEBAR_MENU_BUTTON,
  SIDEBAR_MENU_SUB_BUTTON,
} from "./sidebar-kit";
import { SIDEBAR } from "./sidebar-panel-kit";
import {
  SIDEBAR_FOOTER,
  SIDEBAR_GROUP,
  SIDEBAR_HEADER,
  SIDEBAR_MENU_ITEM_WITH_BADGE,
  SIDEBAR_MENU_SUB,
} from "./sidebar-section-kit";
import { SKELETON, SKELETON_MANIFEST } from "./skeleton-kit";
import { SWITCH, SWITCH_MANIFEST } from "./switch-kit";
import { TEXT_FIELD, TEXT_FIELD_MANIFEST } from "./text-field-kit";
import { TEXTAREA_FIELD, TEXTAREA_FIELD_MANIFEST } from "./textarea-field-kit";
import { TEXTAREA, TEXTAREA_MANIFEST } from "./textarea-kit";
import { TOGGLE_GROUP, TOGGLE_GROUP_MANIFEST } from "./toggle-group-kit";
import { ICON_TOGGLE, ICON_TOGGLE_MANIFEST, TOGGLE, TOGGLE_MANIFEST } from "./toggle-kit";
import { TOOLBAR, TOOLBAR_MANIFEST } from "./toolbar-kit";
import {
  TOOLTIP_CONTENT,
  TOOLTIP_CONTENT_MANIFEST,
  TOOLTIP_OPEN,
  TOOLTIP_OPEN_MANIFEST,
} from "./tooltip-kit";

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
  readonly definition: ComponentDefinition;
  readonly page: KitPage;
  readonly previewCells: readonly Cell[];
  /**
   * The set's manifest where the build reads the set from its capture in `captures/`, which switches
   * the set from the recipe cascade to the capture. Undefined for a set the recipe cascade builds.
   */
  readonly manifest?: SetManifest;
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
    manifest: BUTTON_MANIFEST,
  },
  {
    definition: ICON_BUTTON,
    page: BUTTON_PAGE,
    previewCells: previewCells(ICON_BUTTON, "icon", {}),
    manifest: ICON_BUTTON_MANIFEST,
  },
  {
    definition: CONFIRM_BUTTON,
    page: BUTTON_PAGE,
    previewCells: previewCells(CONFIRM_BUTTON, "default", {}, ["armed"]),
    manifest: CONFIRM_BUTTON_MANIFEST,
  },
  {
    definition: TOGGLE,
    page: TOGGLE_PAGE,
    previewCells: [
      ...previewCells(TOGGLE, "default", { icon: "none" }, ["pressed"]),
      ...iconCells(TOGGLE, "default", { pressed: "off" }),
    ],
    manifest: TOGGLE_MANIFEST,
  },
  {
    definition: ICON_TOGGLE,
    page: TOGGLE_PAGE,
    previewCells: previewCells(ICON_TOGGLE, "default", {}, ["pressed"]),
    manifest: ICON_TOGGLE_MANIFEST,
  },
  // A spaced Toggle group has no state, so its previews place every cell of its matrix.
  {
    definition: TOGGLE_GROUP,
    page: TOGGLE_PAGE,
    previewCells: matrixCells(TOGGLE_GROUP.axes),
    manifest: TOGGLE_GROUP_MANIFEST,
  },
  // A Badge has no state, so its previews place every cell of its matrix.
  {
    definition: BADGE,
    page: BADGE_PAGE,
    previewCells: matrixCells(BADGE.axes),
    manifest: BADGE_MANIFEST,
  },
  {
    definition: KBD,
    page: KBD_PAGE,
    previewCells: matrixCells(KBD.axes),
    manifest: KBD_MANIFEST,
  },
  {
    definition: KBD_GROUP,
    page: KBD_PAGE,
    previewCells: matrixCells(KBD_GROUP.axes),
    manifest: KBD_GROUP_MANIFEST,
  },
  {
    definition: RADIO_ICON_BUTTON,
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO_ICON_BUTTON.axes),
    manifest: RADIO_ICON_BUTTON_MANIFEST,
  },
  {
    definition: RADIO,
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO.axes),
    manifest: RADIO_MANIFEST,
  },
  {
    definition: CHECKBOX,
    page: CHECKBOX_PAGE,
    previewCells: matrixCells(CHECKBOX.axes),
    manifest: CHECKBOX_MANIFEST,
  },
  {
    definition: SWITCH,
    page: SWITCH_PAGE,
    previewCells: matrixCells(SWITCH.axes),
    manifest: SWITCH_MANIFEST,
  },
  {
    definition: SEPARATOR,
    page: SEPARATOR_PAGE,
    previewCells: matrixCells(SEPARATOR.axes),
    manifest: SEPARATOR_MANIFEST,
  },
  {
    definition: SKELETON,
    page: SKELETON_PAGE,
    previewCells: matrixCells(SKELETON.axes),
    manifest: SKELETON_MANIFEST,
  },
  {
    definition: LOADER,
    page: LOADER_PAGE,
    previewCells: matrixCells(LOADER.axes),
    manifest: LOADER_MANIFEST,
  },
  { definition: LABEL, page: FIELD_PAGE, previewCells: matrixCells(LABEL.axes), manifest: LABEL_MANIFEST },
  {
    definition: FIELD_DESCRIPTION,
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_DESCRIPTION.axes),
    manifest: FIELD_DESCRIPTION_MANIFEST,
  },
  {
    definition: FIELD_ERROR,
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_ERROR.axes),
    manifest: FIELD_ERROR_MANIFEST,
  },
  {
    definition: FIELD_LEGEND,
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_LEGEND.axes),
    manifest: FIELD_LEGEND_MANIFEST,
  },
  {
    definition: FIELD_TITLE,
    page: FIELD_PAGE,
    previewCells: matrixCells(FIELD_TITLE.axes),
    manifest: FIELD_TITLE_MANIFEST,
  },
  // The labelled radio rows and the group, which show Field's legend, description and error.
  {
    definition: RADIO_ROW,
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO_ROW.axes),
    manifest: RADIO_ROW_MANIFEST,
  },
  {
    definition: RADIO_GROUP,
    page: RADIO_PAGE,
    previewCells: matrixCells(RADIO_GROUP.axes),
    manifest: RADIO_GROUP_MANIFEST,
  },
  { definition: INPUT, page: INPUT_PAGE, previewCells: matrixCells(INPUT.axes), manifest: INPUT_MANIFEST },
  {
    definition: INPUT_GROUP,
    page: INPUT_PAGE,
    previewCells: matrixCells(INPUT_GROUP.axes),
    manifest: INPUT_GROUP_MANIFEST,
  },
  {
    definition: TEXT_FIELD,
    page: INPUT_PAGE,
    previewCells: matrixCells(TEXT_FIELD.axes),
    manifest: TEXT_FIELD_MANIFEST,
  },
  {
    definition: TEXTAREA,
    page: TEXTAREA_PAGE,
    previewCells: matrixCells(TEXTAREA.axes),
    manifest: TEXTAREA_MANIFEST,
  },
  {
    definition: TEXTAREA_FIELD,
    page: TEXTAREA_PAGE,
    previewCells: matrixCells(TEXTAREA_FIELD.axes),
    manifest: TEXTAREA_FIELD_MANIFEST,
  },
  {
    definition: AVATAR,
    page: AVATAR_PAGE,
    previewCells: matrixCells(AVATAR.axes),
    manifest: AVATAR_MANIFEST,
  },
  {
    definition: AVATAR_GROUP,
    page: AVATAR_PAGE,
    previewCells: matrixCells(AVATAR_GROUP.axes),
    manifest: AVATAR_GROUP_MANIFEST,
  },
  {
    definition: METER,
    page: METER_PAGE,
    previewCells: matrixCells(METER.axes),
    manifest: METER_MANIFEST,
  },
  {
    definition: PAGINATION_LINK,
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_LINK.axes),
    manifest: PAGINATION_LINK_MANIFEST,
  },
  {
    definition: PAGINATION_EDGE,
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_EDGE.axes),
    manifest: PAGINATION_EDGE_MANIFEST,
  },
  {
    definition: PAGINATION_ELLIPSIS,
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_ELLIPSIS.axes),
    manifest: PAGINATION_ELLIPSIS_MANIFEST,
  },
  {
    definition: PAGINATION_ROW,
    page: PAGINATION_PAGE,
    previewCells: matrixCells(PAGINATION_ROW.axes),
    manifest: PAGINATION_ROW_MANIFEST,
  },
  {
    definition: BREADCRUMB_LINK,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_LINK.axes),
    manifest: BREADCRUMB_LINK_MANIFEST,
  },
  {
    definition: BREADCRUMB_PAGE,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_PAGE.axes),
    manifest: BREADCRUMB_PAGE_MANIFEST,
  },
  {
    definition: BREADCRUMB_ELLIPSIS,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_ELLIPSIS.axes),
    manifest: BREADCRUMB_ELLIPSIS_MANIFEST,
  },
  {
    definition: BREADCRUMB_SEPARATOR,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_SEPARATOR.axes),
    manifest: BREADCRUMB_SEPARATOR_MANIFEST,
  },
  {
    definition: BREADCRUMB_TRAIL,
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: matrixCells(BREADCRUMB_TRAIL.axes),
    manifest: BREADCRUMB_TRAIL_MANIFEST,
  },
  {
    definition: SELECT_TRIGGER,
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_TRIGGER.axes),
    manifest: SELECT_TRIGGER_MANIFEST,
  },
  {
    definition: SELECT_FIELD,
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_FIELD.axes),
    manifest: SELECT_FIELD_MANIFEST,
  },
  {
    definition: MENU_GROUP_LABEL,
    page: SELECT_PAGE,
    previewCells: matrixCells(MENU_GROUP_LABEL.axes),
    manifest: MENU_GROUP_LABEL_MANIFEST,
  },
  {
    definition: MENU_SEPARATOR,
    page: SELECT_PAGE,
    previewCells: matrixCells(MENU_SEPARATOR.axes),
    manifest: MENU_SEPARATOR_MANIFEST,
  },
  {
    definition: SELECT_ITEM,
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_ITEM.axes),
    manifest: SELECT_ITEM_MANIFEST,
  },
  {
    definition: SELECT_POPUP,
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_POPUP.axes),
    manifest: SELECT_POPUP_MANIFEST,
  },
  {
    definition: SELECT_OPEN,
    page: SELECT_PAGE,
    previewCells: matrixCells(SELECT_OPEN.axes),
    manifest: SELECT_OPEN_MANIFEST,
  },
  {
    definition: POPOVER_CONTENT,
    page: POPOVER_PAGE,
    previewCells: matrixCells(POPOVER_CONTENT.axes),
    manifest: POPOVER_CONTENT_MANIFEST,
  },
  {
    definition: POPOVER_OPEN,
    page: POPOVER_PAGE,
    previewCells: matrixCells(POPOVER_OPEN.axes),
    manifest: POPOVER_OPEN_MANIFEST,
  },
  {
    definition: DROPDOWN_MENU_ITEM,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_ITEM.axes),
    manifest: DROPDOWN_MENU_ITEM_MANIFEST,
  },
  {
    definition: DROPDOWN_MENU_CHECKBOX_ITEM,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_CHECKBOX_ITEM.axes),
    manifest: DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST,
  },
  {
    definition: DROPDOWN_MENU_RADIO_ITEM,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_RADIO_ITEM.axes),
    manifest: DROPDOWN_MENU_RADIO_ITEM_MANIFEST,
  },
  {
    definition: DROPDOWN_MENU_SUB_TRIGGER,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_SUB_TRIGGER.axes),
    manifest: DROPDOWN_MENU_SUB_TRIGGER_MANIFEST,
  },
  {
    definition: DROPDOWN_MENU_POPUP,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_POPUP.axes),
    manifest: DROPDOWN_MENU_POPUP_MANIFEST,
  },
  {
    definition: DROPDOWN_MENU_SUB_CONTENT,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_SUB_CONTENT.axes),
    manifest: DROPDOWN_MENU_SUB_CONTENT_MANIFEST,
  },
  {
    definition: DROPDOWN_MENU_OPEN,
    page: DROPDOWN_MENU_PAGE,
    previewCells: matrixCells(DROPDOWN_MENU_OPEN.axes),
    manifest: DROPDOWN_MENU_OPEN_MANIFEST,
  },
  {
    definition: COMBOBOX_ITEM,
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_ITEM.axes),
    manifest: COMBOBOX_ITEM_MANIFEST,
  },
  {
    definition: COMBOBOX_EMPTY,
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_EMPTY.axes),
    manifest: COMBOBOX_EMPTY_MANIFEST,
  },
  {
    definition: COMBOBOX_POPUP,
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_POPUP.axes),
    manifest: COMBOBOX_POPUP_MANIFEST,
  },
  {
    definition: COMBOBOX_OPEN,
    page: COMBOBOX_PAGE,
    previewCells: matrixCells(COMBOBOX_OPEN.axes),
    manifest: COMBOBOX_OPEN_MANIFEST,
  },
  {
    definition: COMMAND_ITEM,
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_ITEM.axes),
    manifest: COMMAND_ITEM_MANIFEST,
  },
  {
    definition: COMMAND_LIST,
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_LIST.axes),
    manifest: COMMAND_LIST_MANIFEST,
  },
  // The palette and its open example, drawn from the Input group, Kbd and Command item sets above.
  {
    definition: COMMAND_PALETTE,
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_PALETTE.axes),
    manifest: COMMAND_PALETTE_MANIFEST,
  },
  {
    definition: COMMAND_DIALOG_OPEN,
    page: COMMAND_PAGE,
    previewCells: matrixCells(COMMAND_DIALOG_OPEN.axes),
    manifest: COMMAND_DIALOG_OPEN_MANIFEST,
  },
  {
    definition: EMPTY,
    page: EMPTY_PAGE,
    previewCells: matrixCells(EMPTY.axes),
    manifest: EMPTY_MANIFEST,
  },
  {
    definition: LINK,
    page: LINK_PAGE,
    previewCells: matrixCells(LINK.axes),
    manifest: LINK_MANIFEST,
  },
  {
    definition: ITEM,
    page: ITEM_PAGE,
    previewCells: matrixCells(ITEM.axes),
    manifest: ITEM_MANIFEST,
  },
  {
    definition: ITEM_LINK,
    page: ITEM_PAGE,
    previewCells: matrixCells(ITEM_LINK.axes),
    manifest: ITEM_LINK_MANIFEST,
  },
  { definition: ALERT, page: ALERT_PAGE, previewCells: matrixCells(ALERT.axes), manifest: ALERT_MANIFEST },
  {
    definition: ACCORDION_ITEM,
    page: ACCORDION_PAGE,
    previewCells: matrixCells(ACCORDION_ITEM.axes),
    manifest: ACCORDION_ITEM_MANIFEST,
  },
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
  { definition: SIDEBAR, page: SIDEBAR_PAGE, previewCells: matrixCells(SIDEBAR.axes) },
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
  {
    definition: NUMBER_FIELD_STEPPER,
    page: NUMBER_FIELD_PAGE,
    previewCells: matrixCells(NUMBER_FIELD_STEPPER.axes),
    manifest: NUMBER_FIELD_STEPPER_MANIFEST,
  },
  {
    definition: NUMBER_FIELD,
    page: NUMBER_FIELD_PAGE,
    previewCells: matrixCells(NUMBER_FIELD.axes),
    manifest: NUMBER_FIELD_MANIFEST,
  },
  {
    definition: FILE_UPLOAD_DROPZONE,
    page: FILE_UPLOAD_PAGE,
    previewCells: matrixCells(FILE_UPLOAD_DROPZONE.axes),
    manifest: FILE_UPLOAD_DROPZONE_MANIFEST,
  },
  {
    definition: TOOLBAR,
    page: TOOLBAR_PAGE,
    previewCells: matrixCells(TOOLBAR.axes),
    manifest: TOOLBAR_MANIFEST,
  },
  {
    definition: TOOLTIP_CONTENT,
    page: TOOLTIP_PAGE,
    previewCells: matrixCells(TOOLTIP_CONTENT.axes),
    manifest: TOOLTIP_CONTENT_MANIFEST,
  },
  {
    definition: TOOLTIP_OPEN,
    page: TOOLTIP_PAGE,
    previewCells: matrixCells(TOOLTIP_OPEN.axes),
    manifest: TOOLTIP_OPEN_MANIFEST,
  },
  {
    definition: ALERT_DIALOG_CONTENT,
    page: ALERT_DIALOG_PAGE,
    previewCells: matrixCells(ALERT_DIALOG_CONTENT.axes),
    manifest: ALERT_DIALOG_CONTENT_MANIFEST,
  },
  {
    definition: ALERT_DIALOG_OPEN,
    page: ALERT_DIALOG_PAGE,
    previewCells: matrixCells(ALERT_DIALOG_OPEN.axes),
    manifest: ALERT_DIALOG_OPEN_MANIFEST,
  },
  {
    definition: DIALOG_CONTENT,
    page: DIALOG_PAGE,
    previewCells: matrixCells(DIALOG_CONTENT.axes),
    manifest: DIALOG_CONTENT_MANIFEST,
  },
  {
    definition: DIALOG_OPEN,
    page: DIALOG_PAGE,
    previewCells: matrixCells(DIALOG_OPEN.axes),
    manifest: DIALOG_OPEN_MANIFEST,
  },
];
