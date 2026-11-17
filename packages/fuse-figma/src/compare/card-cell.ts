/**
 * The renderer of the `card` set: each cell as the real Fuse `Card` at the cell's size, holding the
 * docs default demo's header, content and footer.
 *
 * - The root is a flex column, so it fills its container, and the cell sits in a host as wide as
 *   the kit's preview width, the demo's `max-w-md`. The compare page's slot has no width of its own.
 * - The content and the footer each hold one `<p>`, as the demo writes them.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Card } from "../../../fuse/dist/card.js";
import {
  CARD_CONTENT_TEXT,
  CARD_DESCRIPTION_TEXT,
  CARD_FOOTER_TEXT,
  CARD_PREVIEW_WIDTH,
  CARD_TITLE_TEXT,
  cardSizeFor,
} from "../components/card-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `card` cell: the default demo's card at the cell's size. */
export const card: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      "div",
      { style: { width: `${CARD_PREVIEW_WIDTH}px` } },
      createElement(
        Card.Root,
        { size: cardSizeFor(cell) },
        createElement(
          Card.Header,
          null,
          createElement(Card.Title, null, CARD_TITLE_TEXT),
          createElement(Card.Description, null, CARD_DESCRIPTION_TEXT)
        ),
        createElement(Card.Content, null, createElement("p", null, CARD_CONTENT_TEXT)),
        createElement(Card.Footer, null, createElement("p", null, CARD_FOOTER_TEXT))
      )
    ),
};
