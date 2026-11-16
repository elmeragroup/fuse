/**
 * The captures the repository keeps under `captures/`, one per set switched to the capture, parsed
 * once when the build first reads them.
 */

import type { Result } from "effect";

import accordionItem from "../../captures/accordion-item.json" with { type: "json" };
import alertDialogContent from "../../captures/alert-dialog-content.json" with { type: "json" };
import alertDialogOpen from "../../captures/alert-dialog-open.json" with { type: "json" };
import alert from "../../captures/alert.json" with { type: "json" };
import avatarGroup from "../../captures/avatar-group.json" with { type: "json" };
import avatar from "../../captures/avatar.json" with { type: "json" };
import badge from "../../captures/badge.json" with { type: "json" };
import breadcrumbEllipsis from "../../captures/breadcrumb-ellipsis.json" with { type: "json" };
import breadcrumbLink from "../../captures/breadcrumb-link.json" with { type: "json" };
import breadcrumbPage from "../../captures/breadcrumb-page.json" with { type: "json" };
import breadcrumbSeparator from "../../captures/breadcrumb-separator.json" with { type: "json" };
import breadcrumbTrail from "../../captures/breadcrumb-trail.json" with { type: "json" };
import button from "../../captures/button.json" with { type: "json" };
import checkbox from "../../captures/checkbox.json" with { type: "json" };
import comboboxEmpty from "../../captures/combobox-empty.json" with { type: "json" };
import comboboxItem from "../../captures/combobox-item.json" with { type: "json" };
import comboboxOpen from "../../captures/combobox-open.json" with { type: "json" };
import comboboxPopup from "../../captures/combobox-popup.json" with { type: "json" };
import commandDialogOpen from "../../captures/command-dialog-open.json" with { type: "json" };
import commandItem from "../../captures/command-item.json" with { type: "json" };
import commandList from "../../captures/command-list.json" with { type: "json" };
import commandPalette from "../../captures/command-palette.json" with { type: "json" };
import confirmButton from "../../captures/confirm-button.json" with { type: "json" };
import dialogContent from "../../captures/dialog-content.json" with { type: "json" };
import dialogOpen from "../../captures/dialog-open.json" with { type: "json" };
import dropdownMenuCheckboxItem from "../../captures/dropdown-menu-checkbox-item.json" with { type: "json" };
import dropdownMenuItem from "../../captures/dropdown-menu-item.json" with { type: "json" };
import dropdownMenuOpen from "../../captures/dropdown-menu-open.json" with { type: "json" };
import dropdownMenuPopup from "../../captures/dropdown-menu-popup.json" with { type: "json" };
import dropdownMenuRadioItem from "../../captures/dropdown-menu-radio-item.json" with { type: "json" };
import dropdownMenuSubContent from "../../captures/dropdown-menu-sub-content.json" with { type: "json" };
import dropdownMenuSubTrigger from "../../captures/dropdown-menu-sub-trigger.json" with { type: "json" };
import empty from "../../captures/empty.json" with { type: "json" };
import fieldDescription from "../../captures/field-description.json" with { type: "json" };
import fieldError from "../../captures/field-error.json" with { type: "json" };
import fieldLegend from "../../captures/field-legend.json" with { type: "json" };
import fieldTitle from "../../captures/field-title.json" with { type: "json" };
import fileUploadDropzone from "../../captures/file-upload-dropzone.json" with { type: "json" };
import iconButton from "../../captures/icon-button.json" with { type: "json" };
import iconToggle from "../../captures/icon-toggle.json" with { type: "json" };
import inputGroup from "../../captures/input-group.json" with { type: "json" };
import input from "../../captures/input.json" with { type: "json" };
import itemLink from "../../captures/item-link.json" with { type: "json" };
import item from "../../captures/item.json" with { type: "json" };
import kbdGroup from "../../captures/kbd-group.json" with { type: "json" };
import kbd from "../../captures/kbd.json" with { type: "json" };
import label from "../../captures/label.json" with { type: "json" };
import link from "../../captures/link.json" with { type: "json" };
import loader from "../../captures/loader.json" with { type: "json" };
import menuGroupLabel from "../../captures/menu-group-label.json" with { type: "json" };
import menuSeparator from "../../captures/menu-separator.json" with { type: "json" };
import meter from "../../captures/meter.json" with { type: "json" };
import paginationEdge from "../../captures/pagination-edge.json" with { type: "json" };
import paginationEllipsis from "../../captures/pagination-ellipsis.json" with { type: "json" };
import paginationLink from "../../captures/pagination-link.json" with { type: "json" };
import paginationRow from "../../captures/pagination-row.json" with { type: "json" };
import popoverContent from "../../captures/popover-content.json" with { type: "json" };
import popoverOpen from "../../captures/popover-open.json" with { type: "json" };
import radioGroup from "../../captures/radio-group.json" with { type: "json" };
import radioIconButton from "../../captures/radio-icon-button.json" with { type: "json" };
import radioRow from "../../captures/radio-row.json" with { type: "json" };
import radio from "../../captures/radio.json" with { type: "json" };
import selectField from "../../captures/select-field.json" with { type: "json" };
import selectItem from "../../captures/select-item.json" with { type: "json" };
import selectOpen from "../../captures/select-open.json" with { type: "json" };
import selectPopup from "../../captures/select-popup.json" with { type: "json" };
import selectTrigger from "../../captures/select-trigger.json" with { type: "json" };
import separator from "../../captures/separator.json" with { type: "json" };
import skeleton from "../../captures/skeleton.json" with { type: "json" };
import switchCapture from "../../captures/switch.json" with { type: "json" };
import textField from "../../captures/text-field.json" with { type: "json" };
import textareaField from "../../captures/textarea-field.json" with { type: "json" };
import textarea from "../../captures/textarea.json" with { type: "json" };
import toggleGroup from "../../captures/toggle-group.json" with { type: "json" };
import toggle from "../../captures/toggle.json" with { type: "json" };
import toolbar from "../../captures/toolbar.json" with { type: "json" };
import tooltipContent from "../../captures/tooltip-content.json" with { type: "json" };
import tooltipOpen from "../../captures/tooltip-open.json" with { type: "json" };
import { decodeCapture } from "./capture-format.ts";
import type { CaptureUnreadable, SetCapture } from "./capture-format.ts";

/** Each kept capture's parsed file, by set key. */
const FILES: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ["label", label],
  ["input", input],
  ["field-description", fieldDescription],
  ["field-error", fieldError],
  ["text-field", textField],
  ["button", button],
  ["alert", alert],
  ["select-trigger", selectTrigger],
  ["menu-group-label", menuGroupLabel],
  ["menu-separator", menuSeparator],
  ["select-item", selectItem],
  ["select-popup", selectPopup],
  ["select-open", selectOpen],
  ["popover-content", popoverContent],
  ["popover-open", popoverOpen],
  ["alert-dialog-content", alertDialogContent],
  ["alert-dialog-open", alertDialogOpen],
  ["icon-button", iconButton],
  ["tooltip-content", tooltipContent],
  ["tooltip-open", tooltipOpen],
  ["dialog-content", dialogContent],
  ["dialog-open", dialogOpen],
  ["input-group", inputGroup],
  ["combobox-item", comboboxItem],
  ["combobox-empty", comboboxEmpty],
  ["combobox-popup", comboboxPopup],
  ["combobox-open", comboboxOpen],
  ["dropdown-menu-item", dropdownMenuItem],
  ["dropdown-menu-checkbox-item", dropdownMenuCheckboxItem],
  ["dropdown-menu-radio-item", dropdownMenuRadioItem],
  ["dropdown-menu-sub-trigger", dropdownMenuSubTrigger],
  ["dropdown-menu-popup", dropdownMenuPopup],
  ["dropdown-menu-open", dropdownMenuOpen],
  ["kbd", kbd],
  ["kbd-group", kbdGroup],
  ["command-item", commandItem],
  ["command-palette", commandPalette],
  ["command-dialog-open", commandDialogOpen],
  ["badge", badge],
  ["separator", separator],
  ["skeleton", skeleton],
  ["loader", loader],
  ["field-legend", fieldLegend],
  ["field-title", fieldTitle],
  ["link", link],
  ["avatar", avatar],
  ["avatar-group", avatarGroup],
  ["meter", meter],
  ["empty", empty],
  ["confirm-button", confirmButton],
  ["toggle", toggle],
  ["icon-toggle", iconToggle],
  ["radio-icon-button", radioIconButton],
  ["radio", radio],
  ["checkbox", checkbox],
  ["switch", switchCapture],
  ["toggle-group", toggleGroup],
  ["radio-row", radioRow],
  ["radio-group", radioGroup],
  ["textarea", textarea],
  ["textarea-field", textareaField],
  ["select-field", selectField],
  ["file-upload-dropzone", fileUploadDropzone],
  ["pagination-link", paginationLink],
  ["pagination-edge", paginationEdge],
  ["pagination-ellipsis", paginationEllipsis],
  ["pagination-row", paginationRow],
  ["breadcrumb-link", breadcrumbLink],
  ["breadcrumb-page", breadcrumbPage],
  ["breadcrumb-ellipsis", breadcrumbEllipsis],
  ["breadcrumb-separator", breadcrumbSeparator],
  ["breadcrumb-trail", breadcrumbTrail],
  ["dropdown-menu-sub-content", dropdownMenuSubContent],
  ["command-list", commandList],
  ["item", item],
  ["item-link", itemLink],
  ["accordion-item", accordionItem],
  ["toolbar", toolbar],
]);

/**
 * The kept capture of a set.
 *
 * @param key - The set's key.
 * @returns The capture, `CaptureUnreadable` for a file the schema rejects, or undefined where the
 *   repository keeps none.
 */
export function keptCapture(key: string): Result.Result<SetCapture, CaptureUnreadable> | undefined {
  const known = parsed.get(key);
  if (known !== undefined) {
    return known;
  }
  const file = FILES.get(key);
  if (file === undefined) {
    return undefined;
  }
  const capture = decodeCapture(file);
  parsed.set(key, capture);
  return capture;
}

/** Each kept capture once parsed, so a build that reads a set's capture again reads it once. */
const parsed = new Map<string, Result.Result<SetCapture, CaptureUnreadable>>();
