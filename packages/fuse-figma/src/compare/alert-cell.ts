/**
 * The renderer of the `alert` set: each cell as the real Fuse `Alert` in a host as wide as the kit's
 * preview width, which the row's `w-full` fills, as the docs Variants demo's `max-w-lg` column holds
 * it. The cell's tone sets `variant`, and the alert holds the demo's first title and, where the cell
 * is described, its first description. Alert renders its own icon for the tone.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Alert } from "../../../fuse/dist/alert.js";
import {
  ALERT_DESCRIPTION_TEXT,
  ALERT_PREVIEW_WIDTH,
  ALERT_TITLE_TEXT,
  alertLook,
} from "../components/alert-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** An `alert` cell: the Variants demo's first alert in the cell's tone, with or without its description. */
export const alert: CellRendering = {
  element: (cell: Cell) => {
    const look = alertLook(cell);
    return createElement(
      "div",
      { style: { width: `${ALERT_PREVIEW_WIDTH}px` } },
      createElement(
        Alert.Root,
        { variant: look.variant },
        createElement(Alert.Title, null, ALERT_TITLE_TEXT),
        look.described ? createElement(Alert.Description, null, ALERT_DESCRIPTION_TEXT) : null
      )
    );
  },
};
