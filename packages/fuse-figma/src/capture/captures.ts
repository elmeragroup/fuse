/**
 * The captures the repository keeps under `captures/`, one per set switched to the capture, parsed
 * once when the build first reads them.
 */

import type { Result } from "effect";

import alert from "../../captures/alert.json" with { type: "json" };
import button from "../../captures/button.json" with { type: "json" };
import fieldDescription from "../../captures/field-description.json" with { type: "json" };
import fieldError from "../../captures/field-error.json" with { type: "json" };
import input from "../../captures/input.json" with { type: "json" };
import label from "../../captures/label.json" with { type: "json" };
import menuGroupLabel from "../../captures/menu-group-label.json" with { type: "json" };
import menuSeparator from "../../captures/menu-separator.json" with { type: "json" };
import selectItem from "../../captures/select-item.json" with { type: "json" };
import selectPopup from "../../captures/select-popup.json" with { type: "json" };
import selectTrigger from "../../captures/select-trigger.json" with { type: "json" };
import textField from "../../captures/text-field.json" with { type: "json" };
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
