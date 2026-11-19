/**
 * The renderer of the `selection-item` set: the docs default demo's real Fuse `SelectionItem.Shell`
 * around a Checkbox, its title and its description, in a `Field.Root`, in a host as wide as the
 * kit's preview width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Checkbox } from "../../../fuse/dist/checkbox.js";
import { Field } from "../../../fuse/dist/field.js";
import { SelectionItem } from "../../../fuse/dist/selection-item.js";
import {
  SELECTION_ITEM_DESCRIPTION,
  SELECTION_ITEM_PREVIEW_WIDTH,
  SELECTION_ITEM_TITLE,
} from "../components/selection-item-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The `selection-item` cell: the default demo's row. */
export const selectionItem: CellRendering = {
  element: () =>
    createElement(
      "div",
      { style: { width: `${SELECTION_ITEM_PREVIEW_WIDTH}px` } },
      createElement(
        Field.Root,
        null,
        createElement(
          SelectionItem.Shell,
          { dataSlot: "checkbox-item", control: createElement(Checkbox, null) },
          createElement(
            SelectionItem.Content,
            null,
            createElement(SelectionItem.Title, null, SELECTION_ITEM_TITLE),
            createElement(SelectionItem.Description, null, SELECTION_ITEM_DESCRIPTION)
          )
        )
      )
    ),
};
