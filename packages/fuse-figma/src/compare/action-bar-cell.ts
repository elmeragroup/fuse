/**
 * The renderer of the `action-bar` set: the docs default demo's real Fuse `<ActionBar.Root count={2}>`
 * around its count, Clear, separator and the Export and Delete buttons, in a positioned host as wide
 * as the demo's `max-w-xl` column, so the bar floats at its bottom as the demo shows it. The host is
 * wider than one slot, so the renderer names its width in `hostWidth` and the cell spans two.
 *
 * The bar reads its count text from `LocaleProvider`, which throws without one, so the cell renders
 * in an en-US one. Its positioner centres the bar across the host, which puts a bar of fractional
 * width half a pixel off the grid the compare page crops on, so the host's own rule packs the bar at
 * the positioner's start instead. The set draws the bar alone, so where it sits in the host changes
 * nothing it draws.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { ActionBar } from "../../../fuse/dist/action-bar.js";
import { Download, Trash } from "../../../fuse/dist/icons.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { ACTION_BAR_ACTIONS, ACTION_BAR_COUNT, ACTION_BAR_HOST_WIDTH } from "../components/action-bar-kit.ts";
import { markedIcon } from "./cell-renderers.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The icon each action's `Start icon` property names, by that name. */
const ICONS = new Map([
  ["Download", Download],
  ["Trash", Trash],
]);

/** The host's rule that packs the bar at its positioner's start, on the pixel grid. */
const START_RULE = "[data-slot=action-bar-positioner]{justify-content:flex-start!important}";

/** An `action-bar` cell: the default demo's bar at the bottom of its host. */
export const actionBar: CellRendering = {
  hostWidth: ACTION_BAR_HOST_WIDTH,
  element: () =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        "div",
        { style: { position: "relative", width: `${String(ACTION_BAR_HOST_WIDTH)}px`, height: "64px" } },
        createElement("style", { key: "start" }, START_RULE),
        createElement(
          ActionBar.Root,
          { count: ACTION_BAR_COUNT },
          createElement(ActionBar.Count, { key: "count" }),
          createElement(ActionBar.Clear, { key: "clear", onClick: () => undefined }),
          createElement(ActionBar.Separator, { key: "separator" }),
          ...ACTION_BAR_ACTIONS.map((action) => {
            const icon = ICONS.get(action.icon);
            if (icon === undefined) {
              throw new Error(`the action bar renderer has no icon ${action.icon}`);
            }
            return createElement(
              ActionBar.Button,
              { key: action.key },
              markedIcon(icon, "inline-start"),
              createElement(ActionBar.ButtonLabel, null, action.label)
            );
          })
        )
      ),
    }),
};
