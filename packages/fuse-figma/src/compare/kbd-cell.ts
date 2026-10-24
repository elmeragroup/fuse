/**
 * The renderers of the two Kbd sets.
 *
 * - A `kbd` cell renders the real Fuse `<Kbd>` around the label `K` in the text cell and around
 *   `<Backspace />` in the icon cell, the label and icon the kit's properties default to.
 * - The `kbd-group` cell renders `<KbdGroup>` around `<Kbd>Ctrl</Kbd>` and `<Kbd>K</Kbd>`, the docs
 *   Combination demo's first combination.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Backspace } from "../../../fuse/dist/icons.js";
import { Kbd, KbdGroup } from "../../../fuse/dist/kbd.js";
import type { Cell } from "../components/component-spec.ts";
import { KBD_GROUP_MODIFIER, KBD_LABEL } from "../components/kbd-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `kbd` cell: a key cap that holds the label or one icon. */
export const kbd: CellRendering = {
  element: (cell: Cell) => {
    switch (cell.content) {
      case "text":
        return createElement(Kbd, null, KBD_LABEL);
      case "icon":
        return createElement(Kbd, null, createElement(Backspace));
      default:
        throw new Error(`Kbd has no content ${cell.content ?? ""}`);
    }
  },
};

/** The `kbd-group` cell: the modifier cap and the key cap of one combination. */
export const kbdGroup: CellRendering = {
  element: () =>
    createElement(
      KbdGroup,
      null,
      createElement(Kbd, null, KBD_GROUP_MODIFIER),
      createElement(Kbd, null, KBD_LABEL)
    ),
};
