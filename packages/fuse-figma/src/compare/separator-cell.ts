/**
 * The renderer of the `separator` set: each cell as the real Fuse `<Separator orientation>`, with
 * the length a docs demo gives it as consumer classes, as `separator-kit.ts` draws it: 256px
 * horizontal and 16px vertical. A Separator has no state, so the orientation is its only prop.
 * Fuse's `styles.css` compiles none of those classes, so the renderer names them as the host's
 * own, which the page compiles.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Separator } from "../../../fuse/dist/separator.js";
import type { Cell } from "../components/component-spec.ts";
import { DEMO_LENGTHS } from "../components/separator-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

function isOrientation(value: string | undefined): value is "horizontal" | "vertical" {
  return value === "horizontal" || value === "vertical";
}

/** A `separator` cell: a line in one orientation, at a length the host's own build compiles. */
export const separator: CellRendering = {
  hostClasses: DEMO_LENGTHS.split(" "),
  element: (cell: Cell) => {
    const { orientation } = cell;
    if (!isOrientation(orientation)) {
      throw new Error(`Separator has no orientation ${orientation ?? ""}`);
    }
    return createElement(Separator, { orientation, className: DEMO_LENGTHS });
  },
};
