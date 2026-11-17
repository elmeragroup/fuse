/**
 * The captures the repository keeps under `captures/`, one per set switched to the capture, parsed
 * once when the build first reads them.
 */

import type { Result } from "effect";

import alertDialogContent from "../../captures/alert-dialog-content.json" with { type: "json" };
import alertDialogOpen from "../../captures/alert-dialog-open.json" with { type: "json" };
import alert from "../../captures/alert.json" with { type: "json" };
import button from "../../captures/button.json" with { type: "json" };
import comboboxEmpty from "../../captures/combobox-empty.json" with { type: "json" };
import comboboxItem from "../../captures/combobox-item.json" with { type: "json" };
import comboboxOpen from "../../captures/combobox-open.json" with { type: "json" };
import comboboxPopup from "../../captures/combobox-popup.json" with { type: "json" };
import commandDialogOpen from "../../captures/command-dialog-open.json" with { type: "json" };
import commandItem from "../../captures/command-item.json" with { type: "json" };
import commandPalette from "../../captures/command-palette.json" with { type: "json" };
import dialogContent from "../../captures/dialog-content.json" with { type: "json" };
import dialogOpen from "../../captures/dialog-open.json" with { type: "json" };
import dropdownMenuCheckboxItem from "../../captures/dropdown-menu-checkbox-item.json" with { type: "json" };
import dropdownMenuItem from "../../captures/dropdown-menu-item.json" with { type: "json" };
import dropdownMenuOpen from "../../captures/dropdown-menu-open.json" with { type: "json" };
import dropdownMenuPopup from "../../captures/dropdown-menu-popup.json" with { type: "json" };
import dropdownMenuRadioItem from "../../captures/dropdown-menu-radio-item.json" with { type: "json" };
import dropdownMenuSubTrigger from "../../captures/dropdown-menu-sub-trigger.json" with { type: "json" };
import fieldDescription from "../../captures/field-description.json" with { type: "json" };
import fieldError from "../../captures/field-error.json" with { type: "json" };
import iconButton from "../../captures/icon-button.json" with { type: "json" };
import inputGroup from "../../captures/input-group.json" with { type: "json" };
import input from "../../captures/input.json" with { type: "json" };
import kbdGroup from "../../captures/kbd-group.json" with { type: "json" };
import kbd from "../../captures/kbd.json" with { type: "json" };
import label from "../../captures/label.json" with { type: "json" };
import menuGroupLabel from "../../captures/menu-group-label.json" with { type: "json" };
import menuSeparator from "../../captures/menu-separator.json" with { type: "json" };
import popoverContent from "../../captures/popover-content.json" with { type: "json" };
import popoverOpen from "../../captures/popover-open.json" with { type: "json" };
import selectItem from "../../captures/select-item.json" with { type: "json" };
import selectOpen from "../../captures/select-open.json" with { type: "json" };
import selectPopup from "../../captures/select-popup.json" with { type: "json" };
import selectTrigger from "../../captures/select-trigger.json" with { type: "json" };
import textField from "../../captures/text-field.json" with { type: "json" };
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
