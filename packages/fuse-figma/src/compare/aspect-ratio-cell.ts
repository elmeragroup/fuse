/**
 * The renderer of the `aspect-ratio` set: each cell as the real Fuse `<AspectRatio ratio>` with its
 * docs demo's width classes, around an `<img>` of the kit's portrait with the demos'
 * `size-full rounded-lg object-cover`, in a host as wide as the kit's preview width.
 *
 * Fuse's standalone `styles.css` holds `w-full`, `max-w-md` and `max-w-sm`, which Fuse's own source
 * uses, but not the demos' `max-w-60`, `max-w-52` or `max-w-44`. The renderer names the demos' width
 * classes as the host's own, so the page compiles the ones the standalone CSS lacks.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { AspectRatio } from "../../../fuse/dist/aspect-ratio.js";
import {
  ASPECT_RATIO_PREVIEW_WIDTH,
  aspectRatioLook,
  RATIO_CLASSES,
} from "../components/aspect-ratio-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import { portraitPng } from "../components/portrait.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** An `aspect-ratio` cell: the frame at the cell's ratio and its demo's width, holding the portrait. */
export const aspectRatio: CellRendering = {
  hostClasses: [...new Set([...RATIO_CLASSES.values()].flatMap((classes) => classes.split(" ")))],
  element: (cell: Cell) => {
    const { ratio, classes } = aspectRatioLook(cell);
    return createElement(
      "div",
      { style: { width: `${ASPECT_RATIO_PREVIEW_WIDTH}px` } },
      createElement(
        AspectRatio,
        { ratio, className: classes },
        createElement("img", {
          className: "size-full rounded-lg object-cover",
          alt: "",
          src: `data:image/png;base64,${Buffer.from(portraitPng()).toString("base64")}`,
        })
      )
    );
  },
};
