/**
 * The renderer of the `loader` set: each cell as the real Fuse `<Loader size aria-label="Loading" />`,
 * as the docs demos label it. A Loader has no state, so the cell's size is its only prop. The
 * `aria-label` gives the visually hidden text, so the server markup holds no client child. The
 * page turns animations off, so the spinner sits unrotated, as the kit draws it.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Loader, loaderVariants } from "../../../fuse/dist/loader.js";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import type { CellRendering } from "./cell-renderers.ts";

type LoaderSize = keyof typeof loaderVariants.variants.size;

function isSize(value: string | undefined): value is LoaderSize {
  return ownKey(loaderVariants.variants.size, value);
}

/** A `loader` cell: a labelled Loader at one size. */
export const loader: CellRendering = {
  element: (cell: Cell) => {
    const { size } = cell;
    if (!isSize(size)) {
      throw new Error(`Loader has no size ${size ?? ""}`);
    }
    return createElement(Loader, { size, "aria-label": "Loading" });
  },
};
