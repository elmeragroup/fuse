/**
 * The renderer of the `toolbar` set: each cell as the docs Basic demo, the real Fuse
 * `<Toolbar.Root aria-label="Invoice">` in the cell's orientation, holding the File group's Download
 * and Duplicate buttons, the separator and the disabled Delete button, each a ghost small `Button`
 * with its start icon.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentType } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { Copy, Download, Trash } from "../../../fuse/dist/icons.js";
import type { ElmeraIconProps } from "../../../fuse/dist/icons.js";
import { Toolbar } from "../../../fuse/dist/toolbar.js";
import type { Cell } from "../components/component-spec.ts";
import { TOOLBAR_DISABLED_ACTION, TOOLBAR_GROUP_ACTIONS } from "../components/toolbar-kit.ts";
import { markedIcon } from "./cell-renderers.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The icon each action's `Start icon` property names, by that name. */
const ICONS = new Map<string, ComponentType<ElmeraIconProps>>([
  ["Download", Download],
  ["Copy", Copy],
  ["Trash", Trash],
]);

/** One toolbar button, as `<Toolbar.Button render={<Button variant="ghost" size="sm" />}>`. */
function toolbarButton(action: { readonly key: string; readonly label: string; readonly icon: string }) {
  const icon = ICONS.get(action.icon);
  if (icon === undefined) {
    throw new Error(`the toolbar renderer has no icon ${action.icon}`);
  }
  return {
    key: action.key,
    render: createElement(Button, { variant: "ghost", size: "sm" }),
    children: [markedIcon(icon, "inline-start"), action.label],
  };
}

/** A `toolbar` cell: the Basic demo's bar, horizontal or vertical. */
export const toolbar: CellRendering = {
  element: (cell: Cell) =>
    createElement(Toolbar.Root, {
      "aria-label": "Invoice",
      orientation: cell.orientation === "vertical" ? "vertical" : "horizontal",
      children: [
        createElement(Toolbar.Group, {
          key: "group",
          "aria-label": "File",
          children: TOOLBAR_GROUP_ACTIONS.map((action) =>
            createElement(Toolbar.Button, toolbarButton(action))
          ),
        }),
        createElement(Toolbar.Separator, { key: "separator" }),
        createElement(Toolbar.Button, { ...toolbarButton(TOOLBAR_DISABLED_ACTION), disabled: true }),
      ],
    }),
};
