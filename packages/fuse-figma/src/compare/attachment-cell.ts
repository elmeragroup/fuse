/**
 * The renderer of the `attachment` set: each cell as the real Fuse `Attachment` row at the cell's
 * size and state, holding the docs default demo's FileArrowUp, title, description and remove action,
 * in a host as wide as the kit's preview width, which the row fills.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Attachment } from "../../../fuse/dist/attachment.js";
import { FileArrowUp, X } from "../../../fuse/dist/icons.js";
import {
  ATTACHMENT_ACTION_LABEL,
  ATTACHMENT_DESCRIPTION_TEXT,
  ATTACHMENT_PREVIEW_WIDTH,
  ATTACHMENT_TITLE_TEXT,
  attachmentLook,
} from "../components/attachment-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** An `attachment` cell: the default demo's row at the cell's size and state. */
export const attachment: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      "div",
      { style: { width: `${ATTACHMENT_PREVIEW_WIDTH}px` } },
      createElement(
        Attachment.Root,
        attachmentLook(cell),
        createElement(Attachment.Media, null, createElement(FileArrowUp, null)),
        createElement(
          Attachment.Content,
          null,
          createElement(Attachment.Title, null, ATTACHMENT_TITLE_TEXT),
          createElement(Attachment.Description, null, ATTACHMENT_DESCRIPTION_TEXT)
        ),
        createElement(
          Attachment.Actions,
          null,
          createElement(Attachment.Action, { "aria-label": ATTACHMENT_ACTION_LABEL }, createElement(X, null))
        )
      )
    ),
};
