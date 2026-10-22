/**
 * The renderer of the `avatar` set: each cell as the real Fuse `<Avatar.Root>`, with the size a docs
 * demo gives it as a consumer class, as `avatar-kit.ts` draws it.
 *
 * - A fallback cell holds `<Avatar.Fallback>AL</Avatar.Fallback>`, which Base UI renders while no
 *   image has loaded, as in static markup.
 * - An image cell holds `<Avatar.Image keepMounted>` and no fallback. Base UI renders the `<img>` in
 *   static markup only with `keepMounted`, and a fallback beside it would put two filling parts in
 *   the circle. Its `src` is the portrait the kit draws, as a data URI, so the page needs no route
 *   for it and the browser draws the pixels Figma draws.
 *
 * Fuse's `styles.css` compiles only the classes Fuse's own source uses, so the renderer names every
 * size class as the host's own, which the page compiles.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Avatar } from "../../../fuse/dist/avatar.js";
import { AVATAR_INITIALS, portraitPng, SIZE_CLASSES, sizeClassFor } from "../components/avatar-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** An `avatar` cell: the initials or the portrait in a circle of one size. */
export const avatar: CellRendering = {
  hostClasses: [...SIZE_CLASSES.values()],
  element: (cell: Cell) =>
    createElement(
      Avatar.Root,
      { className: sizeClassFor(cell) },
      cell.content === "image"
        ? createElement(Avatar.Image, {
            keepMounted: true,
            src: `data:image/png;base64,${Buffer.from(portraitPng()).toString("base64")}`,
            alt: "",
          })
        : createElement(Avatar.Fallback, null, AVATAR_INITIALS)
    ),
};
