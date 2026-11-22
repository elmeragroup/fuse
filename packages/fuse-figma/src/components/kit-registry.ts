/**
 * The component sets of the kit, each with its page and the cells its preview frames place.
 * `build-kit.ts` builds a set from each entry and the previews of each page, and `figma:compare`
 * reads each entry's axes to parse a snapshot's variant keys and to pick the self-check's cells.
 *
 * Keep this module free of Tailwind's compiler, the theme catalog and the Fuse build, so the
 * modules that need only the definitions and their cells, such as the compare unit tests that
 * parse keys, load it without them. A comparison run loads the compiler anyway,
 * through `buildComponentSets()`.
 */
import type { SetManifest } from "../capture/manifest";
import { ACCORDION_ITEM_MANIFEST } from "./accordion-kit";
import { ACTION_BAR_MANIFEST } from "./action-bar-kit";
import { ALERT_DIALOG_CONTENT_MANIFEST, ALERT_DIALOG_OPEN_MANIFEST } from "./alert-dialog-kit";
import { ALERT_MANIFEST } from "./alert-kit";
import { ASPECT_RATIO_MANIFEST } from "./aspect-ratio-kit";
import { ATTACHMENT_MANIFEST } from "./attachment-kit";
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
import { CALENDAR_DAY_MANIFEST } from "./calendar-day-kit";
import { CALENDAR_MANIFEST, RANGE_CALENDAR_MANIFEST } from "./calendar-kit";
import { CARD_MANIFEST } from "./card-kit";
import { CHECKBOX_CARD_MANIFEST } from "./checkbox-card-kit";
import { CHECKBOX_MANIFEST } from "./checkbox-kit";
import { CODE_MANIFEST } from "./code-kit";
import {
  COMBOBOX_EMPTY_MANIFEST,
  COMBOBOX_ITEM_MANIFEST,
  COMBOBOX_OPEN_MANIFEST,
  COMBOBOX_POPUP_MANIFEST,
} from "./combobox-kit";
import { COMMAND_DIALOG_OPEN_MANIFEST, COMMAND_PALETTE_MANIFEST } from "./command-dialog-kit";
import { COMMAND_ITEM_MANIFEST, COMMAND_LIST_MANIFEST } from "./command-kit";
import { isPossible, possibleCells } from "./component-spec";
import type { Cell, ImpossibleCells } from "./component-spec";
import { CONFIRM_BUTTON_MANIFEST } from "./confirm-button-kit";
import { DATA_TABLE_FILTER_BAR_MANIFEST } from "./data-table-filter-kit";
import { DATE_FIELD_MANIFEST } from "./date-field-kit";
import { DATE_PICKER_MANIFEST } from "./date-picker-kit";
import { DATE_RANGE_PICKER_MANIFEST } from "./date-range-picker-kit";
import { DESCRIPTION_LIST_ITEM_MANIFEST, DESCRIPTION_LIST_MANIFEST } from "./description-list-kit";
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
  DROPDOWN_MENU_SUBMENU_OPEN_MANIFEST,
} from "./dropdown-popup-kit";
import { EMPTY_MANIFEST } from "./empty-kit";
import {
  FIELD_DESCRIPTION_MANIFEST,
  FIELD_ERROR_MANIFEST,
  FIELD_LEGEND_MANIFEST,
  FIELD_TITLE_MANIFEST,
} from "./field-text-kit";
import { FILE_UPLOAD_DROPZONE_MANIFEST } from "./file-upload-kit";
import { FRAME_MANIFEST } from "./frame-kit";
import {
  FRAME_TABLE_CELL_MANIFEST,
  FRAME_TABLE_ROW_MANIFEST,
  FRAME_TABLE_ROW_PREVIEW_CELLS,
  FRAME_TABLE_BODY_MANIFEST,
} from "./frame-table-kit";
import { INPUT_GROUP_MANIFEST } from "./input-group-kit";
import { INPUT_MANIFEST } from "./input-kit";
import { ITEM_LINK_MANIFEST, ITEM_MANIFEST } from "./item-kit";
import { KBD_GROUP_MANIFEST, KBD_MANIFEST } from "./kbd-kit";
import { axisValues } from "./kit-spec";
import type { AxisSpec } from "./kit-spec";
import { LABEL_MANIFEST } from "./label-kit";
import { LINK_MANIFEST } from "./link-kit";
import {
  LIST_DETAIL_MANIFEST,
  LIST_DETAIL_OPEN_MANIFEST,
  LIST_DETAIL_PANE_MANIFEST,
  LIST_DETAIL_SHEET_MANIFEST,
} from "./list-detail-kit";
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
import { SELECTION_ITEM_MANIFEST } from "./selection-item-kit";
import { SEPARATOR_MANIFEST } from "./separator-kit";
import { SHEET_CONTENT_MANIFEST, SHEET_OPEN_MANIFEST } from "./sheet-kit";
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
import {
  TABLE_CAPTION_MANIFEST,
  TABLE_CELL_MANIFEST,
  TABLE_HEAD_MANIFEST,
  TABLE_ROW_MANIFEST,
} from "./table-kit";
import { TABS_CONTENT_MANIFEST, TABS_LIST_MANIFEST, TABS_TRIGGER_MANIFEST } from "./tabs-kit";
import { TEXT_FIELD_MANIFEST } from "./text-field-kit";
import { TEXTAREA_FIELD_MANIFEST } from "./textarea-field-kit";
import { TEXTAREA_MANIFEST } from "./textarea-kit";
import { TIMELINE_LIST_LINKS_MANIFEST, TIMELINE_LIST_MANIFEST } from "./timeline-list-kit";
import { TOAST_MANIFEST } from "./toast-kit";
import { SEGMENTED_TOGGLE_GROUP_MANIFEST, TOGGLE_GROUP_MANIFEST } from "./toggle-group-kit";
import { ICON_TOGGLE_MANIFEST, TOGGLE_MANIFEST } from "./toggle-kit";
import { TOOLBAR_MANIFEST } from "./toolbar-kit";
import { TOOLTIP_CONTENT_MANIFEST, TOOLTIP_OPEN_MANIFEST } from "./tooltip-kit";
import { TOUR_POPUP_MANIFEST, TOUR_STEP_MANIFEST } from "./tour-kit";

/**
 * A page of the kit: one component and its close variants, such as Button and Icon button.
 * `slug` names the page in its key, `page/button`, and in its previews' keys.
 */
export type KitPage = {
  readonly slug: string;
  readonly name: string;
  /**
   * The key of the set whose default variant is the page's usage example, the set that draws the
   * docs default demo where the page has one, such as Select (open) on the Select page.
   */
  readonly example: string;
  /**
   * The slug of the component's docs page, `apps/docs/src/app/(docs)/components/<docs>`, where it
   * differs from the page's own, as Radio's docs page is `radio-group`.
   */
  readonly docs?: string;
};

/** The page Button, Icon button and Confirm button share. */
const BUTTON_PAGE: KitPage = { slug: "button", name: "Button", example: "button" };

/** The page Toggle and Icon toggle share. */
const TOGGLE_PAGE: KitPage = { slug: "toggle", name: "Toggle", example: "toggle-group" };

/** The page Badge sits on alone. */
const BADGE_PAGE: KitPage = { slug: "badge", name: "Badge", example: "badge" };

/** The page of Kbd's key cap and the group that combines caps. */
const KBD_PAGE: KitPage = { slug: "kbd", name: "Kbd", example: "kbd-group" };

/** The page of the radio controls, Radio icon button first, then Radio. */
const RADIO_PAGE: KitPage = { slug: "radio", name: "Radio", example: "radio-group", docs: "radio-group" };

/** The page Checkbox sits on alone. */
const CHECKBOX_PAGE: KitPage = { slug: "checkbox", name: "Checkbox", example: "checkbox" };

/** The page Switch sits on alone. */
const SWITCH_PAGE: KitPage = { slug: "switch", name: "Switch", example: "switch" };

/** The page Separator sits on alone. */
const SEPARATOR_PAGE: KitPage = { slug: "separator", name: "Separator", example: "separator" };

/** The page Skeleton sits on alone. */
const SKELETON_PAGE: KitPage = { slug: "skeleton", name: "Skeleton", example: "skeleton" };

/** The page Loader sits on alone. */
const LOADER_PAGE: KitPage = { slug: "loader", name: "Loader", example: "loader" };

/**
 * The page of Field's text parts: the label, the description, the error, the legend and the title.
 * Label sat on a page of its own until they joined it.
 */
const FIELD_PAGE: KitPage = { slug: "field", name: "Field", example: "label" };

/** The page of Input, the Input group that Combobox and Command render, and the labelled Text field. */
const INPUT_PAGE: KitPage = { slug: "input", name: "Input", example: "text-field" };

/** The page of Textarea and the labelled Textarea field. */
const TEXTAREA_PAGE: KitPage = { slug: "textarea", name: "Textarea", example: "textarea-field" };

/** The page of Alert dialog. */
const ALERT_DIALOG_PAGE: KitPage = {
  slug: "alert-dialog",
  name: "Alert dialog",
  example: "alert-dialog-open",
};

/** The page of Dialog. */
const DIALOG_PAGE: KitPage = { slug: "dialog", name: "Dialog", example: "dialog-open" };

/** The page of Tooltip. */
const TOOLTIP_PAGE: KitPage = { slug: "tooltip", name: "Tooltip", example: "tooltip-open" };

/** The page of Toolbar. */
const TOOLBAR_PAGE: KitPage = { slug: "toolbar", name: "Toolbar", example: "toolbar" };

/** The page of File upload's dropzone. */
const FILE_UPLOAD_PAGE: KitPage = {
  slug: "file-upload",
  name: "File upload",
  example: "file-upload-dropzone",
};

/** The page of Number field and its stepper. */
const NUMBER_FIELD_PAGE: KitPage = { slug: "number-field", name: "Number field", example: "number-field" };

/** The page of Avatar and the group that stacks avatars. */
const AVATAR_PAGE: KitPage = { slug: "avatar", name: "Avatar", example: "avatar-group" };

/** The page Meter sits on alone. */
const METER_PAGE: KitPage = { slug: "meter", name: "Meter", example: "meter" };

/** The page of Pagination's parts, the link, the edge links and the ellipsis, and the row of them. */
const PAGINATION_PAGE: KitPage = { slug: "pagination", name: "Pagination", example: "pagination-row" };

/**
 * The page of Breadcrumb's parts, the link, the current page, the ellipsis and the separator, and the
 * trail of them. Its name keeps it apart from `BREADCRUMB_PAGE_MANIFEST`, the current page's set.
 */
const BREADCRUMB_PARTS_PAGE: KitPage = {
  slug: "breadcrumb",
  name: "Breadcrumb",
  example: "breadcrumb-trail",
};

/**
 * The page of Select's parts: the trigger, the menu parts every menu family shares, the row, the
 * popup and the open Select.
 */
const SELECT_PAGE: KitPage = { slug: "select", name: "Select", example: "select-open" };

/** The page of Popover's popup and the open Popover. */
const POPOVER_PAGE: KitPage = { slug: "popover", name: "Popover", example: "popover-open" };

/** The page of Dropdown menu's rows, its popups and the open menu. */
const DROPDOWN_MENU_PAGE: KitPage = {
  slug: "dropdown-menu",
  name: "Dropdown menu",
  example: "dropdown-menu-open",
};

/** The page Empty sits on alone. */
const EMPTY_PAGE: KitPage = { slug: "empty", name: "Empty", example: "empty" };

/** The page Aspect ratio sits on alone. */
const ASPECT_RATIO_PAGE: KitPage = { slug: "aspect-ratio", name: "Aspect ratio", example: "aspect-ratio" };

/** The page Attachment sits on alone. */
const ATTACHMENT_PAGE: KitPage = { slug: "attachment", name: "Attachment", example: "attachment" };

/** The page Description list's Item and list sit on. */
const DESCRIPTION_LIST_PAGE: KitPage = {
  slug: "description-list",
  name: "Description list",
  example: "description-list",
};

/** The page of List detail's pane and the root that holds the list beside it. */
const LIST_DETAIL_PAGE: KitPage = { slug: "list-detail", name: "List detail", example: "list-detail" };

/** The page Data table filter's bar sits on alone. */
const DATA_TABLE_FILTER_PAGE: KitPage = {
  slug: "data-table-filter",
  name: "Data table filter",
  example: "data-table-filter-bar",
};

/** The page Tour's tip and step card sit on. */
const TOUR_PAGE: KitPage = { slug: "tour", name: "Tour", example: "tour-popup" };

/** The page Toast sits on alone. */
const TOAST_PAGE: KitPage = { slug: "toast", name: "Toast", example: "toast" };

/** The page Card sits on alone. */
const CARD_PAGE: KitPage = { slug: "card", name: "Card", example: "card" };

/** The page Frame sits on alone. */
const FRAME_PAGE: KitPage = { slug: "frame", name: "Frame", example: "frame" };

/** The page Action bar sits on alone. */
const ACTION_BAR_PAGE: KitPage = { slug: "action-bar", name: "Action bar", example: "action-bar" };

/** The page Calendar, Range calendar and the day they share sit on. */
const CALENDAR_PAGE: KitPage = { slug: "calendar", name: "Calendar", example: "calendar" };

/** The page Date field sits on alone. */
const DATE_FIELD_PAGE: KitPage = { slug: "date-field", name: "Date field", example: "date-field" };

/** The page Date picker sits on alone. */
const DATE_PICKER_PAGE: KitPage = { slug: "date-picker", name: "Date picker", example: "date-picker" };

/** The page Date range picker sits on alone. */
const DATE_RANGE_PICKER_PAGE: KitPage = {
  slug: "date-range-picker",
  name: "Date range picker",
  example: "date-range-picker",
};

/** The page Tabs trigger and Tabs list share. */
const TABS_PAGE: KitPage = { slug: "tabs", name: "Tabs", example: "tabs-list" };

/** The page of Sheet: the panel, and the panel open over its scrim. */
const SHEET_PAGE: KitPage = { slug: "sheet", name: "Sheet", example: "sheet-open" };

/** The page Table's head, cell, row and caption share. */
const TABLE_PAGE: KitPage = { slug: "table", name: "Table", example: "table-row" };

/** The page Timeline list and its links list share. */
const TIMELINE_LIST_PAGE: KitPage = {
  slug: "timeline-list",
  name: "Timeline list",
  example: "timeline-list",
};

/** The page Code sits on alone. */
const CODE_PAGE: KitPage = { slug: "code", name: "Code", example: "code" };

/** The page Selection item sits on alone. */
const SELECTION_ITEM_PAGE: KitPage = {
  slug: "selection-item",
  name: "Selection item",
  example: "selection-item",
};

/** The page Checkbox card sits on alone. */
const CHECKBOX_CARD_PAGE: KitPage = {
  slug: "checkbox-card",
  name: "Checkbox card",
  example: "checkbox-card",
};

/** The page Link sits on alone. */
const LINK_PAGE: KitPage = { slug: "link", name: "Link", example: "link" };

/** The page of Item's rows, the row and the link row, until Item group joins them. */
const ITEM_PAGE: KitPage = { slug: "item", name: "Item", example: "item" };

/** The page Alert sits on alone. */
const ALERT_PAGE: KitPage = { slug: "alert", name: "Alert", example: "alert" };

/** The page Accordion's item sits on alone, until a stacked accordion joins it. */
const ACCORDION_PAGE: KitPage = { slug: "accordion", name: "Accordion", example: "accordion-item" };

/** The page of Sidebar's rows and sections, and of the panel, expanded and collapsed to its icon rail. */
const SIDEBAR_PAGE: KitPage = { slug: "sidebar", name: "Sidebar", example: "sidebar" };

/** The page of Combobox's open state: its row, its empty message, its popup and the open input. */
const COMBOBOX_PAGE: KitPage = { slug: "combobox", name: "Combobox", example: "combobox-open" };

/** The page of Command's rows and list. The palette dialog waits for a dialog surface. */
const COMMAND_PAGE: KitPage = { slug: "command", name: "Command", example: "command-dialog-open" };

/** The page of Navigation menu's triggers, links and open popup. */
const NAVIGATION_MENU_PAGE: KitPage = {
  slug: "navigation-menu",
  name: "Navigation menu",
  example: "navigation-menu-popup",
};

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
 * first value. `fixed` sets the cell's other axes. A cell the set rules out is left out.
 */
function previewCells(
  definition: { readonly axes: readonly AxisSpec[]; readonly impossible?: readonly ImpossibleCells[] },
  baseSize: string,
  fixed: Cell,
  crossed: readonly string[] = []
): Cell[] {
  const variants = axisValues(definition, "variant");
  const combinations = possibleCells({
    axes: crossed.map((name) => ({ name, values: axisValues(definition, name) })),
  });
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
  ].filter((cell) => isPossible(definition, cell));
}

/**
 * Each variant at rest at the base size with a start icon, then with an end icon. A cell the set
 * rules out is left out.
 */
function iconCells(
  definition: { readonly axes: readonly AxisSpec[]; readonly impossible?: readonly ImpossibleCells[] },
  baseSize: string,
  fixed: Cell
): Cell[] {
  return ["start", "end"]
    .flatMap((icon) =>
      axisValues(definition, "variant").map((variant) => ({
        ...fixed,
        variant,
        size: baseSize,
        state: "rest",
        icon,
      }))
    )
    .filter((cell) => isPossible(definition, cell));
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
      ...previewCells(TOGGLE_MANIFEST, "default", { icon: "none", segment: "none" }, ["pressed"]),
      ...iconCells(TOGGLE_MANIFEST, "default", { pressed: "false", segment: "none" }),
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
    previewCells: possibleCells(TOGGLE_GROUP_MANIFEST),
    manifest: TOGGLE_GROUP_MANIFEST,
  },
  // A segmented Toggle group has no state either, so its previews place every cell too.
  {
    page: TOGGLE_PAGE,
    previewCells: possibleCells(SEGMENTED_TOGGLE_GROUP_MANIFEST),
    manifest: SEGMENTED_TOGGLE_GROUP_MANIFEST,
  },
  // A Badge has no state, so its previews place every cell of its matrix.
  {
    page: BADGE_PAGE,
    previewCells: possibleCells(BADGE_MANIFEST),
    manifest: BADGE_MANIFEST,
  },
  {
    page: KBD_PAGE,
    previewCells: possibleCells(KBD_MANIFEST),
    manifest: KBD_MANIFEST,
  },
  {
    page: KBD_PAGE,
    previewCells: possibleCells(KBD_GROUP_MANIFEST),
    manifest: KBD_GROUP_MANIFEST,
  },
  {
    page: RADIO_PAGE,
    previewCells: possibleCells(RADIO_ICON_BUTTON_MANIFEST),
    manifest: RADIO_ICON_BUTTON_MANIFEST,
  },
  {
    page: RADIO_PAGE,
    previewCells: possibleCells(RADIO_MANIFEST),
    manifest: RADIO_MANIFEST,
  },
  {
    page: CHECKBOX_PAGE,
    previewCells: possibleCells(CHECKBOX_MANIFEST),
    manifest: CHECKBOX_MANIFEST,
  },
  {
    page: SWITCH_PAGE,
    previewCells: possibleCells(SWITCH_MANIFEST),
    manifest: SWITCH_MANIFEST,
  },
  {
    page: SEPARATOR_PAGE,
    previewCells: possibleCells(SEPARATOR_MANIFEST),
    manifest: SEPARATOR_MANIFEST,
  },
  {
    page: SKELETON_PAGE,
    previewCells: possibleCells(SKELETON_MANIFEST),
    manifest: SKELETON_MANIFEST,
  },
  {
    page: LOADER_PAGE,
    previewCells: possibleCells(LOADER_MANIFEST),
    manifest: LOADER_MANIFEST,
  },
  { page: FIELD_PAGE, previewCells: possibleCells(LABEL_MANIFEST), manifest: LABEL_MANIFEST },
  {
    page: FIELD_PAGE,
    previewCells: possibleCells(FIELD_DESCRIPTION_MANIFEST),
    manifest: FIELD_DESCRIPTION_MANIFEST,
  },
  {
    page: FIELD_PAGE,
    previewCells: possibleCells(FIELD_ERROR_MANIFEST),
    manifest: FIELD_ERROR_MANIFEST,
  },
  {
    page: FIELD_PAGE,
    previewCells: possibleCells(FIELD_LEGEND_MANIFEST),
    manifest: FIELD_LEGEND_MANIFEST,
  },
  {
    page: FIELD_PAGE,
    previewCells: possibleCells(FIELD_TITLE_MANIFEST),
    manifest: FIELD_TITLE_MANIFEST,
  },
  // The labelled radio rows and the group, which show Field's legend, description and error.
  {
    page: RADIO_PAGE,
    previewCells: possibleCells(RADIO_ROW_MANIFEST),
    manifest: RADIO_ROW_MANIFEST,
  },
  {
    page: RADIO_PAGE,
    previewCells: possibleCells(RADIO_GROUP_MANIFEST),
    manifest: RADIO_GROUP_MANIFEST,
  },
  { page: INPUT_PAGE, previewCells: possibleCells(INPUT_MANIFEST), manifest: INPUT_MANIFEST },
  {
    page: INPUT_PAGE,
    previewCells: possibleCells(INPUT_GROUP_MANIFEST),
    manifest: INPUT_GROUP_MANIFEST,
  },
  {
    page: INPUT_PAGE,
    previewCells: possibleCells(TEXT_FIELD_MANIFEST),
    manifest: TEXT_FIELD_MANIFEST,
  },
  {
    page: TEXTAREA_PAGE,
    previewCells: possibleCells(TEXTAREA_MANIFEST),
    manifest: TEXTAREA_MANIFEST,
  },
  {
    page: TEXTAREA_PAGE,
    previewCells: possibleCells(TEXTAREA_FIELD_MANIFEST),
    manifest: TEXTAREA_FIELD_MANIFEST,
  },
  {
    page: AVATAR_PAGE,
    previewCells: possibleCells(AVATAR_MANIFEST),
    manifest: AVATAR_MANIFEST,
  },
  {
    page: AVATAR_PAGE,
    previewCells: possibleCells(AVATAR_GROUP_MANIFEST),
    manifest: AVATAR_GROUP_MANIFEST,
  },
  {
    page: METER_PAGE,
    previewCells: possibleCells(METER_MANIFEST),
    manifest: METER_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: possibleCells(PAGINATION_LINK_MANIFEST),
    manifest: PAGINATION_LINK_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: possibleCells(PAGINATION_EDGE_MANIFEST),
    manifest: PAGINATION_EDGE_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: possibleCells(PAGINATION_ELLIPSIS_MANIFEST),
    manifest: PAGINATION_ELLIPSIS_MANIFEST,
  },
  {
    page: PAGINATION_PAGE,
    previewCells: possibleCells(PAGINATION_ROW_MANIFEST),
    manifest: PAGINATION_ROW_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: possibleCells(BREADCRUMB_LINK_MANIFEST),
    manifest: BREADCRUMB_LINK_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: possibleCells(BREADCRUMB_PAGE_MANIFEST),
    manifest: BREADCRUMB_PAGE_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: possibleCells(BREADCRUMB_ELLIPSIS_MANIFEST),
    manifest: BREADCRUMB_ELLIPSIS_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: possibleCells(BREADCRUMB_SEPARATOR_MANIFEST),
    manifest: BREADCRUMB_SEPARATOR_MANIFEST,
  },
  {
    page: BREADCRUMB_PARTS_PAGE,
    previewCells: possibleCells(BREADCRUMB_TRAIL_MANIFEST),
    manifest: BREADCRUMB_TRAIL_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: possibleCells(SELECT_TRIGGER_MANIFEST),
    manifest: SELECT_TRIGGER_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: possibleCells(SELECT_FIELD_MANIFEST),
    manifest: SELECT_FIELD_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: possibleCells(MENU_GROUP_LABEL_MANIFEST),
    manifest: MENU_GROUP_LABEL_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: possibleCells(MENU_SEPARATOR_MANIFEST),
    manifest: MENU_SEPARATOR_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: possibleCells(SELECT_ITEM_MANIFEST),
    manifest: SELECT_ITEM_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: possibleCells(SELECT_POPUP_MANIFEST),
    manifest: SELECT_POPUP_MANIFEST,
  },
  {
    page: SELECT_PAGE,
    previewCells: possibleCells(SELECT_OPEN_MANIFEST),
    manifest: SELECT_OPEN_MANIFEST,
  },
  {
    page: POPOVER_PAGE,
    previewCells: possibleCells(POPOVER_CONTENT_MANIFEST),
    manifest: POPOVER_CONTENT_MANIFEST,
  },
  {
    page: POPOVER_PAGE,
    previewCells: possibleCells(POPOVER_OPEN_MANIFEST),
    manifest: POPOVER_OPEN_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_ITEM_MANIFEST),
    manifest: DROPDOWN_MENU_ITEM_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST),
    manifest: DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_RADIO_ITEM_MANIFEST),
    manifest: DROPDOWN_MENU_RADIO_ITEM_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_SUB_TRIGGER_MANIFEST),
    manifest: DROPDOWN_MENU_SUB_TRIGGER_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_POPUP_MANIFEST),
    manifest: DROPDOWN_MENU_POPUP_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_SUB_CONTENT_MANIFEST),
    manifest: DROPDOWN_MENU_SUB_CONTENT_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_OPEN_MANIFEST),
    manifest: DROPDOWN_MENU_OPEN_MANIFEST,
  },
  {
    page: DROPDOWN_MENU_PAGE,
    previewCells: possibleCells(DROPDOWN_MENU_SUBMENU_OPEN_MANIFEST),
    manifest: DROPDOWN_MENU_SUBMENU_OPEN_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: possibleCells(COMBOBOX_ITEM_MANIFEST),
    manifest: COMBOBOX_ITEM_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: possibleCells(COMBOBOX_EMPTY_MANIFEST),
    manifest: COMBOBOX_EMPTY_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: possibleCells(COMBOBOX_POPUP_MANIFEST),
    manifest: COMBOBOX_POPUP_MANIFEST,
  },
  {
    page: COMBOBOX_PAGE,
    previewCells: possibleCells(COMBOBOX_OPEN_MANIFEST),
    manifest: COMBOBOX_OPEN_MANIFEST,
  },
  {
    page: COMMAND_PAGE,
    previewCells: possibleCells(COMMAND_ITEM_MANIFEST),
    manifest: COMMAND_ITEM_MANIFEST,
  },
  {
    page: COMMAND_PAGE,
    previewCells: possibleCells(COMMAND_LIST_MANIFEST),
    manifest: COMMAND_LIST_MANIFEST,
  },
  // The palette and its open example, drawn from the Input group, Kbd and Command item sets above.
  {
    page: COMMAND_PAGE,
    previewCells: possibleCells(COMMAND_PALETTE_MANIFEST),
    manifest: COMMAND_PALETTE_MANIFEST,
  },
  {
    page: COMMAND_PAGE,
    previewCells: possibleCells(COMMAND_DIALOG_OPEN_MANIFEST),
    manifest: COMMAND_DIALOG_OPEN_MANIFEST,
  },
  {
    page: EMPTY_PAGE,
    previewCells: possibleCells(EMPTY_MANIFEST),
    manifest: EMPTY_MANIFEST,
  },
  {
    page: LINK_PAGE,
    previewCells: possibleCells(LINK_MANIFEST),
    manifest: LINK_MANIFEST,
  },
  {
    page: ITEM_PAGE,
    previewCells: possibleCells(ITEM_MANIFEST),
    manifest: ITEM_MANIFEST,
  },
  {
    page: ITEM_PAGE,
    previewCells: possibleCells(ITEM_LINK_MANIFEST),
    manifest: ITEM_LINK_MANIFEST,
  },
  { page: ALERT_PAGE, previewCells: possibleCells(ALERT_MANIFEST), manifest: ALERT_MANIFEST },
  {
    page: ACCORDION_PAGE,
    previewCells: possibleCells(ACCORDION_ITEM_MANIFEST),
    manifest: ACCORDION_ITEM_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_MENU_BUTTON_MANIFEST),
    manifest: SIDEBAR_MENU_BUTTON_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_MENU_SUB_BUTTON_MANIFEST),
    manifest: SIDEBAR_MENU_SUB_BUTTON_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_GROUP_LABEL_MANIFEST),
    manifest: SIDEBAR_GROUP_LABEL_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_MENU_BADGE_MANIFEST),
    manifest: SIDEBAR_MENU_BADGE_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_GROUP_MANIFEST),
    manifest: SIDEBAR_GROUP_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_HEADER_MANIFEST),
    manifest: SIDEBAR_HEADER_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_FOOTER_MANIFEST),
    manifest: SIDEBAR_FOOTER_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_MENU_SUB_MANIFEST),
    manifest: SIDEBAR_MENU_SUB_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_MENU_ITEM_WITH_BADGE_MANIFEST),
    manifest: SIDEBAR_MENU_ITEM_WITH_BADGE_MANIFEST,
  },
  {
    page: SIDEBAR_PAGE,
    previewCells: possibleCells(SIDEBAR_MANIFEST),
    manifest: SIDEBAR_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: possibleCells(NAVIGATION_MENU_BAR_TRIGGER_MANIFEST),
    manifest: NAVIGATION_MENU_BAR_TRIGGER_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: possibleCells(NAVIGATION_MENU_VERTICAL_TRIGGER_MANIFEST),
    manifest: NAVIGATION_MENU_VERTICAL_TRIGGER_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: possibleCells(NAVIGATION_MENU_BAR_LINK_MANIFEST),
    manifest: NAVIGATION_MENU_BAR_LINK_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: possibleCells(NAVIGATION_MENU_ROW_LINK_MANIFEST),
    manifest: NAVIGATION_MENU_ROW_LINK_MANIFEST,
  },
  {
    page: NAVIGATION_MENU_PAGE,
    previewCells: possibleCells(NAVIGATION_MENU_POPUP_MANIFEST),
    manifest: NAVIGATION_MENU_POPUP_MANIFEST,
  },
  {
    page: NUMBER_FIELD_PAGE,
    previewCells: possibleCells(NUMBER_FIELD_STEPPER_MANIFEST),
    manifest: NUMBER_FIELD_STEPPER_MANIFEST,
  },
  {
    page: NUMBER_FIELD_PAGE,
    previewCells: possibleCells(NUMBER_FIELD_MANIFEST),
    manifest: NUMBER_FIELD_MANIFEST,
  },
  {
    page: FILE_UPLOAD_PAGE,
    previewCells: possibleCells(FILE_UPLOAD_DROPZONE_MANIFEST),
    manifest: FILE_UPLOAD_DROPZONE_MANIFEST,
  },
  {
    page: TOOLBAR_PAGE,
    previewCells: possibleCells(TOOLBAR_MANIFEST),
    manifest: TOOLBAR_MANIFEST,
  },
  {
    page: TOOLTIP_PAGE,
    previewCells: possibleCells(TOOLTIP_CONTENT_MANIFEST),
    manifest: TOOLTIP_CONTENT_MANIFEST,
  },
  {
    page: TOOLTIP_PAGE,
    previewCells: possibleCells(TOOLTIP_OPEN_MANIFEST),
    manifest: TOOLTIP_OPEN_MANIFEST,
  },
  {
    page: ALERT_DIALOG_PAGE,
    previewCells: possibleCells(ALERT_DIALOG_CONTENT_MANIFEST),
    manifest: ALERT_DIALOG_CONTENT_MANIFEST,
  },
  {
    page: ALERT_DIALOG_PAGE,
    previewCells: possibleCells(ALERT_DIALOG_OPEN_MANIFEST),
    manifest: ALERT_DIALOG_OPEN_MANIFEST,
  },
  {
    page: DIALOG_PAGE,
    previewCells: possibleCells(DIALOG_CONTENT_MANIFEST),
    manifest: DIALOG_CONTENT_MANIFEST,
  },
  {
    page: DIALOG_PAGE,
    previewCells: possibleCells(DIALOG_OPEN_MANIFEST),
    manifest: DIALOG_OPEN_MANIFEST,
  },
  { page: CARD_PAGE, previewCells: possibleCells(CARD_MANIFEST), manifest: CARD_MANIFEST },
  { page: FRAME_PAGE, previewCells: possibleCells(FRAME_MANIFEST), manifest: FRAME_MANIFEST },
  {
    page: ACTION_BAR_PAGE,
    previewCells: possibleCells(ACTION_BAR_MANIFEST),
    manifest: ACTION_BAR_MANIFEST,
  },
  {
    page: SHEET_PAGE,
    previewCells: possibleCells(SHEET_CONTENT_MANIFEST),
    manifest: SHEET_CONTENT_MANIFEST,
  },
  {
    page: SHEET_PAGE,
    previewCells: possibleCells(SHEET_OPEN_MANIFEST),
    manifest: SHEET_OPEN_MANIFEST,
  },
  {
    page: CALENDAR_PAGE,
    previewCells: possibleCells(CALENDAR_DAY_MANIFEST),
    manifest: CALENDAR_DAY_MANIFEST,
  },
  {
    page: CALENDAR_PAGE,
    previewCells: possibleCells(CALENDAR_MANIFEST),
    manifest: CALENDAR_MANIFEST,
  },
  {
    page: CALENDAR_PAGE,
    previewCells: possibleCells(RANGE_CALENDAR_MANIFEST),
    manifest: RANGE_CALENDAR_MANIFEST,
  },
  {
    page: DATE_FIELD_PAGE,
    previewCells: possibleCells(DATE_FIELD_MANIFEST),
    manifest: DATE_FIELD_MANIFEST,
  },
  {
    page: DATE_PICKER_PAGE,
    previewCells: possibleCells(DATE_PICKER_MANIFEST),
    manifest: DATE_PICKER_MANIFEST,
  },
  {
    page: DATE_RANGE_PICKER_PAGE,
    previewCells: possibleCells(DATE_RANGE_PICKER_MANIFEST),
    manifest: DATE_RANGE_PICKER_MANIFEST,
  },
  {
    page: TABS_PAGE,
    previewCells: possibleCells(TABS_TRIGGER_MANIFEST),
    manifest: TABS_TRIGGER_MANIFEST,
  },
  { page: TABS_PAGE, previewCells: possibleCells(TABS_LIST_MANIFEST), manifest: TABS_LIST_MANIFEST },
  { page: TABS_PAGE, previewCells: possibleCells(TABS_CONTENT_MANIFEST), manifest: TABS_CONTENT_MANIFEST },
  {
    page: TIMELINE_LIST_PAGE,
    previewCells: possibleCells(TIMELINE_LIST_MANIFEST),
    manifest: TIMELINE_LIST_MANIFEST,
  },
  {
    page: TIMELINE_LIST_PAGE,
    previewCells: possibleCells(TIMELINE_LIST_LINKS_MANIFEST),
    manifest: TIMELINE_LIST_LINKS_MANIFEST,
  },
  {
    page: SELECTION_ITEM_PAGE,
    previewCells: possibleCells(SELECTION_ITEM_MANIFEST),
    manifest: SELECTION_ITEM_MANIFEST,
  },
  {
    page: ASPECT_RATIO_PAGE,
    previewCells: possibleCells(ASPECT_RATIO_MANIFEST),
    manifest: ASPECT_RATIO_MANIFEST,
  },
  { page: CODE_PAGE, previewCells: possibleCells(CODE_MANIFEST), manifest: CODE_MANIFEST },
  { page: TABLE_PAGE, previewCells: possibleCells(TABLE_HEAD_MANIFEST), manifest: TABLE_HEAD_MANIFEST },
  { page: TABLE_PAGE, previewCells: possibleCells(TABLE_CELL_MANIFEST), manifest: TABLE_CELL_MANIFEST },
  { page: TABLE_PAGE, previewCells: possibleCells(TABLE_ROW_MANIFEST), manifest: TABLE_ROW_MANIFEST },
  { page: TABLE_PAGE, previewCells: possibleCells(TABLE_CAPTION_MANIFEST), manifest: TABLE_CAPTION_MANIFEST },
  {
    page: TABLE_PAGE,
    previewCells: possibleCells(FRAME_TABLE_CELL_MANIFEST),
    manifest: FRAME_TABLE_CELL_MANIFEST,
  },
  {
    page: TABLE_PAGE,
    previewCells: FRAME_TABLE_ROW_PREVIEW_CELLS,
    manifest: FRAME_TABLE_ROW_MANIFEST,
  },
  {
    page: TABLE_PAGE,
    previewCells: possibleCells(FRAME_TABLE_BODY_MANIFEST),
    manifest: FRAME_TABLE_BODY_MANIFEST,
  },
  {
    page: ATTACHMENT_PAGE,
    previewCells: possibleCells(ATTACHMENT_MANIFEST),
    manifest: ATTACHMENT_MANIFEST,
  },
  {
    page: DESCRIPTION_LIST_PAGE,
    previewCells: possibleCells(DESCRIPTION_LIST_ITEM_MANIFEST),
    manifest: DESCRIPTION_LIST_ITEM_MANIFEST,
  },
  {
    page: DESCRIPTION_LIST_PAGE,
    previewCells: possibleCells(DESCRIPTION_LIST_MANIFEST),
    manifest: DESCRIPTION_LIST_MANIFEST,
  },
  {
    page: CHECKBOX_CARD_PAGE,
    previewCells: possibleCells(CHECKBOX_CARD_MANIFEST),
    manifest: CHECKBOX_CARD_MANIFEST,
  },
  {
    page: LIST_DETAIL_PAGE,
    previewCells: possibleCells(LIST_DETAIL_PANE_MANIFEST),
    manifest: LIST_DETAIL_PANE_MANIFEST,
  },
  {
    page: LIST_DETAIL_PAGE,
    previewCells: possibleCells(LIST_DETAIL_MANIFEST),
    manifest: LIST_DETAIL_MANIFEST,
  },
  {
    page: LIST_DETAIL_PAGE,
    previewCells: possibleCells(LIST_DETAIL_SHEET_MANIFEST),
    manifest: LIST_DETAIL_SHEET_MANIFEST,
  },
  {
    page: LIST_DETAIL_PAGE,
    previewCells: possibleCells(LIST_DETAIL_OPEN_MANIFEST),
    manifest: LIST_DETAIL_OPEN_MANIFEST,
  },
  {
    page: DATA_TABLE_FILTER_PAGE,
    previewCells: possibleCells(DATA_TABLE_FILTER_BAR_MANIFEST),
    manifest: DATA_TABLE_FILTER_BAR_MANIFEST,
  },
  {
    page: TOUR_PAGE,
    previewCells: possibleCells(TOUR_POPUP_MANIFEST),
    manifest: TOUR_POPUP_MANIFEST,
  },
  {
    page: TOUR_PAGE,
    previewCells: possibleCells(TOUR_STEP_MANIFEST),
    manifest: TOUR_STEP_MANIFEST,
  },
  { page: TOAST_PAGE, previewCells: possibleCells(TOAST_MANIFEST), manifest: TOAST_MANIFEST },
];
