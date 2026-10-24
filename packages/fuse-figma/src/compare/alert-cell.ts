/**
 * The renderer of the `alert` set: each cell as the real Fuse `Alert` in a host as wide as the kit's
 * preview width, which the row's `w-full` fills, as the docs Variants demo's `max-w-lg` column holds
 * it. The cell's tone sets `variant`, and the alert holds the demo's first title and, where the cell
 * is described, its first description. Alert renders its own icon for the tone. With the `Action`
 * property on, it passes `onAction` and the docs Action demo's `actionLabel`, so Alert renders its
 * Button. A preview keeps the property at its default, false, so the compare page renders none.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Alert } from "../../../fuse/dist/alert.js";
import {
  ALERT_ACTION_LABEL,
  ALERT_ACTION_PROPERTY,
  ALERT_DESCRIPTION_TEXT,
  ALERT_PREVIEW_WIDTH,
  ALERT_TITLE_TEXT,
  alertLook,
} from "../components/alert-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/**
 * An `alert` cell: the Variants demo's first alert in the cell's tone, with or without its
 * description, and with the action where the `Action` property is on.
 */
export const alert: CellRendering = {
  element: (cell: Cell, turnedOn: ReadonlySet<string>) => {
    const look = alertLook(cell);
    const action = turnedOn.has(ALERT_ACTION_PROPERTY)
      ? { onAction: () => undefined, actionLabel: ALERT_ACTION_LABEL }
      : {};
    return createElement(
      "div",
      { style: { width: `${ALERT_PREVIEW_WIDTH}px` } },
      createElement(
        Alert.Root,
        { variant: look.variant, ...action },
        createElement(Alert.Title, null, ALERT_TITLE_TEXT),
        look.described ? createElement(Alert.Description, null, ALERT_DESCRIPTION_TEXT) : null
      )
    );
  },
};
