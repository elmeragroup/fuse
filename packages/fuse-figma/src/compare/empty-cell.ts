/**
 * The renderer of the `empty` set: each cell as the real Fuse `Empty` in the cell's frame, holding
 * the docs Basic demo's header: the icon media around a Tray, the title and the description.
 *
 * - The root is block-level, so it fills its container, and the cell sits in a host as wide as the
 *   kit's preview width. The compare page's slot has no width of its own.
 * - The page is wider than `md:`, so the root takes its desktop padding, as the kit draws it.
 * - With the `Actions` property on, `<Empty.Content>` follows the header with the docs With actions
 *   demo's `<Button>Create order</Button>` and `<Button variant="secondary">Import orders</Button>`.
 *   An instance at the property's default, false, renders no content.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { Empty } from "../../../fuse/dist/empty.js";
import { Tray } from "../../../fuse/dist/icons.js";
import type { Cell } from "../components/component-spec.ts";
import {
  EMPTY_ACTIONS_PROPERTY,
  EMPTY_DESCRIPTION_PROPERTY,
  EMPTY_DESCRIPTION_TEXT,
  EMPTY_MEDIA_PROPERTY,
  EMPTY_PREVIEW_WIDTH,
  EMPTY_PRIMARY_ACTION_LABEL,
  EMPTY_SECONDARY_ACTION_LABEL,
  EMPTY_TITLE_TEXT,
  emptyVariantFor,
} from "../components/empty-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/**
 * An `empty` cell: the Basic demo's header in the cell's frame, its media where `Media` is on and its
 * description where `Description` is, and the With actions demo's content where `Actions` is.
 */
export const empty: CellRendering = {
  element: (cell: Cell, turnedOn: ReadonlySet<string>) =>
    createElement(
      "div",
      { style: { width: `${EMPTY_PREVIEW_WIDTH}px` } },
      createElement(
        Empty.Root,
        { variant: emptyVariantFor(cell) },
        createElement(
          Empty.Header,
          null,
          turnedOn.has(EMPTY_MEDIA_PROPERTY)
            ? createElement(Empty.Media, { variant: "icon" }, createElement(Tray, { "aria-hidden": true }))
            : null,
          createElement(Empty.Title, null, EMPTY_TITLE_TEXT),
          turnedOn.has(EMPTY_DESCRIPTION_PROPERTY)
            ? createElement(Empty.Description, null, EMPTY_DESCRIPTION_TEXT)
            : null
        ),
        turnedOn.has(EMPTY_ACTIONS_PROPERTY)
          ? createElement(
              Empty.Content,
              null,
              createElement(Button, null, EMPTY_PRIMARY_ACTION_LABEL),
              createElement(Button, { variant: "secondary" }, EMPTY_SECONDARY_ACTION_LABEL)
            )
          : null
      )
    ),
};
