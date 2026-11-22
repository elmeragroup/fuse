/**
 * The renderer of the `frame` set: the real Fuse `Frame` in its default `gutter` layout, holding
 * the docs default demo's header, three panels and footer, in a host as wide as the kit's preview
 * width, the demo's `max-w-md`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Frame } from "../../../fuse/dist/frame.js";
import type { Cell } from "../components/component-spec.ts";
import {
  FRAME_DESCRIPTION_TEXT,
  FRAME_FOOTER_TEXT,
  FRAME_PANEL_TEXTS,
  FRAME_PREVIEW_WIDTH,
  FRAME_TITLE_TEXT,
  frameLayoutFor,
} from "../components/frame-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `frame` cell: the default demo's Frame. */
export const frame: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      "div",
      { style: { width: `${FRAME_PREVIEW_WIDTH}px` } },
      createElement(
        Frame.Root,
        { layout: frameLayoutFor(cell) },
        createElement(
          Frame.Header,
          null,
          createElement(Frame.Title, null, FRAME_TITLE_TEXT),
          createElement(Frame.Description, null, FRAME_DESCRIPTION_TEXT)
        ),
        ...FRAME_PANEL_TEXTS.map((panel) => createElement(Frame.Panel, { key: panel }, panel)),
        createElement(Frame.Footer, null, createElement("p", null, FRAME_FOOTER_TEXT))
      )
    ),
};
