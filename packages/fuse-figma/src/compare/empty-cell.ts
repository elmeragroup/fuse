/**
 * The renderer of the `empty` set: each cell as the real Fuse `Empty` in the cell's frame, holding
 * the docs Basic demo's header: the icon media around a Tray, the title and the description.
 *
 * - The root is block-level, so it fills its container, and the cell sits in a host as wide as the
 *   kit's preview width. The compare page's slot has no width of its own.
 * - The page is wider than `md:`, so the root takes its desktop padding, as the kit draws it.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Empty } from "../../../fuse/dist/empty.js";
import { Tray } from "../../../fuse/dist/icons.js";
import type { Cell } from "../components/component-spec.ts";
import {
  EMPTY_DESCRIPTION_TEXT,
  EMPTY_PREVIEW_WIDTH,
  EMPTY_TITLE_TEXT,
  emptyVariantFor,
} from "../components/empty-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** An `empty` cell: the Basic demo's header in the cell's frame. */
export const empty: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      "div",
      { style: { width: `${EMPTY_PREVIEW_WIDTH}px` } },
      createElement(
        Empty.Root,
        { variant: emptyVariantFor(cell) },
        createElement(
          Empty.Header,
          null,
          createElement(Empty.Media, { variant: "icon" }, createElement(Tray, { "aria-hidden": true })),
          createElement(Empty.Title, null, EMPTY_TITLE_TEXT),
          createElement(Empty.Description, null, EMPTY_DESCRIPTION_TEXT)
        )
      )
    ),
};
